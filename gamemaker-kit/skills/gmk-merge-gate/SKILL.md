---
name: gmk-merge-gate
description: Run a 3-check pre-merge gate over a milestone branch — regression (re-run prior PASS bots), asset conflict (same file touched by two milestones), and secret scan (gitleaks). Reuses a recent /gmk-regression report when fresh (<24h) and invokes /gmk-regression itself when stale or missing. Writes a single merge-gate report to .gamemaker-kit/merge-gates/<m>.md with PASS or FAIL. Use when the user says "/gmk-merge-gate", "merge gate", "ready to merge", "머지 게이트", "이거 머지해도 돼?", or before merging any milestone branch that touched shared code or assets.
model: sonnet
---

# gmk-merge-gate — Three checks between a milestone and the trunk

A milestone branch can pass its own bot and self-test but still break the project on merge. Three classes of problem:

1. **Regression** — the milestone changed shared code (`_bot_hook_lib.js`, a config, a refactored helper) and an earlier PASS milestone now FAILs. `/gmk-validate` only ever tested *this* milestone; only `/gmk-regression` knows about the rest.
2. **Asset conflict** — two milestones independently edited the same file (a tuning JSON, a shared helper, a level config). Merging without noticing means one set of edits silently wins.
3. **Secret** — a `.env`, API key, or token slipped into a committed file. Cheap to catch pre-merge, expensive to revoke after a public push.

This skill runs all three and outputs a single PASS/FAIL verdict with the failing rows quoted. It's the last bot-side check before the user merges; after this, the only remaining gate is `/gmk-port`'s 5-stage re-validation (if porting).

## Preconditions

1. **`milestones.json` exists** with at least one milestone in `in-progress` or `review` status (the "candidate"). If the user didn't say which milestone, default to the most recently-modified entry whose status isn't `done`.
2. **Git is available.** All three checks need it (regression for culprit hints, asset conflict for the diff, secret scan for staged-vs-tracked discrimination).
3. **`/gmk-regression` is callable** (it's a sibling skill; same Playwright dependency). If Playwright is missing, the regression check stops with the same install message `/gmk-regression` prints — the gate stays FAIL until install completes.

`gitleaks` is *not* required. Section 3 has a fallback. The skill prefers `gitleaks` when available because pattern coverage is broader.

_Standard preconditions (milestone-id resolution, empty/partial state, refuse-chain cycle guard, kit_version read contract) follow `gmk-prototype-rules` Rule 13-14, 16._

## Flow

### Step 1 — Show the gate plan

```
Merge gate plan for m4-merchant
  Check 1 (regression): /gmk-regression last ran 2026-05-12T22:45Z (38 min ago).
                        Report fresh — will reuse.
  Check 2 (asset conflict): diff candidate branch against main.
                            Excludes prototypes/*.html (every milestone gets its own).
  Check 3 (secret scan): gitleaks detected (v8.18.4). Will scan staged + tracked files.
                         If you'd rather skip secret scan, --no-secret.

Proceed?
```

If the regression report is missing or older than 24h, say so and offer:

```
  Check 1 (regression): no recent report. Will invoke /gmk-regression first.
                        Estimated +8-20 min. Or --skip-regression if you just ran
                        it manually and the report is elsewhere.
```

If `gitleaks` is missing:

```
  Check 3 (secret scan): gitleaks not found on PATH. Falling back to a small
                         built-in pattern list (AWS keys, common token shapes,
                         .env-file shapes). Narrower than gitleaks — install
                         gitleaks for production use (https://github.com/gitleaks/gitleaks).
```

### Step 2 — Check 1: regression

Look for the most recent file matching `_workspace/regression-report-*.md`. Parse its timestamp from the filename or first line.

- **Fresh** (≤24h, no PASS milestones added since the report ran): reuse. Read the report's Summary section; extract the REGRESSION count.
  - REGRESSION count == 0: check passes.
  - REGRESSION count > 0: check fails. Quote each REGRESSION line.
- **Stale or missing**: invoke `/gmk-regression` directly (no flags — let it use defaults). When it finishes, parse the new report.

Don't re-run a fresh report — that's the contract `/gmk-regression` and this skill share. Wall-time matters.

If `/gmk-regression`'s plan step shows 0 PASS milestones (nothing to regress against), Check 1 is **N/A**, not FAIL. Note in the report: *"No prior PASS milestones to regress against — this is the project's first."*

### Step 3 — Check 2: asset conflict

The candidate milestone has a branch (current branch or `--branch <name>` override). Compare against `main` (or `--base <branch>` override):

```bash
git diff --name-only main...HEAD
```

For each file in that diff:

1. **Skip** if the path matches:
   - `prototypes/*.html` — each milestone has its own prototype; not a conflict.
   - `.gamemaker-kit/validations/<this-milestone-id>/**` — milestone's own trial output.
   - `.gamemaker-kit/self-tests/<this-milestone-id>/**` — milestone's own self-test notes.
   - `_workspace/milestones/<this-milestone-id>/**` — milestone's own kanban/notes.
2. **Check** every *other* path against the other milestones' file lists:
   - Read `milestones.json`. For each milestone whose `ported_to.files_created` or `ported_to.files_modified` (or `merge_gate.touched_files` from a prior gate) includes a file also in the diff, record a conflict.
   - Also check `git log --since=<30 days ago> --name-only --pretty=format:` for shared files recently touched on other branches.

For each conflict, output:

```
Conflict on godot/scripts/merge/merge_grid.gd
  This milestone (m4-merchant) modified it.
  m1-merge-feel created it on 2026-05-09 (port).
  Decide: is m4's edit replacing m1's logic, or adding to it? If replacing,
  confirm m1's bot still passes after merge. If adding, factor out the shared
  bit so neither milestone owns the file alone.
```

Asset conflicts are FAIL only when the diff touches a non-prototype shared file *and* another milestone wrote to it. Diffs that only touch this milestone's own files are not conflicts.

### Step 4 — Check 3: secret scan

If `gitleaks` is on PATH:

```bash
gitleaks detect --no-banner --no-git --redact --report-format=json --report-path=<tmp>
```

(`--no-git` scans the working tree directly, including untracked. Use `--no-banner` and `--redact` so the JSON report doesn't leak the actual secret values into the merge-gate.md output.)

Parse the JSON. For each finding:

```
Secret detected (redacted)
  File: src/config.js:12
  Rule: aws-access-key
  Match: AKIA****************
  Fix: move to .env (and add .env to .gitignore), or read from environment
       variable. If this key is real and was committed, revoke it on AWS first;
       removing from git history doesn't unbreak the leak.
```

If `gitleaks` is missing, use a fallback pattern set. The fallback is intentionally narrow — it's a backstop, not a replacement:

| Pattern | Trigger |
|---|---|
| `AKIA[0-9A-Z]{16}` | AWS access key |
| `-----BEGIN .* PRIVATE KEY-----` | private key file content |
| `(api[_-]?key|secret|token)\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']` | generic key=value with long opaque value |
| Filename ends in `.env`, `.pem`, `id_rsa`, `credentials` | suspicious file shape |
| `Bearer\s+[A-Za-z0-9._\-]{20,}` | inlined bearer token |

Scan tracked + untracked files in the working tree. Skip `node_modules/`, `.git/`, `dist/`, `build/`, anything in `.gitignore`. Cap each file read at 200KB.

Any match is a FAIL row. Print redacted (first 4 chars + asterisks) — never the full secret.

### Step 5 — Compute verdict

```
verdict = PASS if (check1 in {PASS, N/A}) and check2 == PASS and check3 == PASS
        else FAIL
```

There's no soft FAIL. The whole point of the gate is binary.

Edge: if Check 1 is N/A (no prior PASS milestones) and Check 2 + 3 PASS, overall is PASS. Note the N/A explicitly so it doesn't read as a skipped check.

### Step 5.5 — Save-schema check (warning-only)

If the candidate milestone has a `_workspace/milestones/<id>/save-migration.md` file (produced by `gmk-save-migrate`), check whether it's been updated since the milestone's `ported_to.ported_at` timestamp.

- **Missing migration file** AND milestone touches persistent fields (heuristic: `files_modified` includes `save.gd` / `save_data.cs` / save-schema.json) → emit a warning row: *"Milestone changes persistence layer but no save-migration plan exists. Either run `/gmk-save-migrate <id>` or confirm the change is non-breaking by adding a `_save_breaking: false` note to the milestone."*
- **Migration file older than ported_at** → warning: *"save-migration plan was written before the latest port. Re-validate the migration is still applicable."*

This is a **warning, not a gate failure** — save-migrate runs late (after port) and merge-gate shouldn't block on a doc the user can write next. The warning lands in the report's "Warnings" section and surfaces in dev-complete's C4 check until acknowledged.

### Step 6 — Write the report

Always write `.gamemaker-kit/merge-gates/<milestone-id>.md`. Overwrite if it exists (most recent gate run is the one that matters). Template:

```markdown
# Merge gate — m4-merchant — 2026-05-12 23:17

Verdict: **PASS** (or **FAIL** — N reasons)

## Summary

| Check | Result | Detail |
|---|---|---|
| 1. Regression | PASS | 4 milestones checked, 0 regressions (report 38 min old) |
| 2. Asset conflict | PASS | 7 files in diff, 0 conflicts |
| 3. Secret scan | PASS | gitleaks v8.18.4, 0 findings |

## Diff covered
  godot/scripts/merchant/merchant_state.gd        (new)
  godot/scripts/merchant/merchant_dialog.gd       (new)
  godot/scenes/merchant/merchant.tscn             (new)
  prototypes/m4-merchant.html                     (new — excluded from conflict check)
  _bot_hook_lib.js                                (mod — flagged for Check 1 culprit hints)
  ...

## Failing rows (if any)

(only present when verdict == FAIL — list each Check's failures here, with the same
 format as the per-check Step above)

## Next

- (PASS) Merge to main. If porting follows, run /gmk-port <id>.
- (FAIL) Fix the failing rows above. Re-run /gmk-merge-gate.
```

Also write the milestone's `merge_gate` record back to `milestones.json`:

```json
{
  "merge_gate": {
    "ran_at": "2026-05-12T23:17:00Z",
    "regression_ok": true,
    "regression_report": "_workspace/regression-report-2026-05-12-2245.md",
    "asset_conflicts": [],
    "secrets_detected": [],
    "touched_files": ["godot/scripts/merchant/merchant_state.gd", "..."],
    "verdict": "PASS",
    "warnings": []
  }
}
```

`touched_files` is the asset-conflict diff list (without prototypes/etc.). Future merge gates of *other* milestones use this list when computing Check 2 against this one.

### Step 7 — Print the summary

```
Merge gate: m4-merchant — PASS

  Check 1 regression       PASS (4 milestones, 0 regressions, report 38 min old)
  Check 2 asset conflict   PASS (7 files diff, 0 conflicts)
  Check 3 secret scan      PASS (gitleaks v8.18.4, 0 findings)

  Report: .gamemaker-kit/merge-gates/m4-merchant.md
  milestones.json: merge_gate block updated.

Next:
  - Merge the branch.
  - /gmk-port m4-merchant — only if you also want to bring this into the engine.
```

For FAIL, lead with the count and the first row of each failing check:

```
Merge gate: m4-merchant — FAIL (3 reasons)

  Check 1 regression       FAIL (1 regression: m2-dragon-evo PASS → FAIL)
                                  see _workspace/regression-report-2026-05-12-2317.md
  Check 2 asset conflict   FAIL (1 conflict on godot/scripts/merge/merge_grid.gd
                                  also touched by m1-merge-feel)
  Check 3 secret scan      FAIL (1 finding: aws-access-key in src/config.js:12)

  Report: .gamemaker-kit/merge-gates/m4-merchant.md
  milestones.json: merge_gate.verdict = FAIL.

Don't merge until these clear. Walk the report; fix in order. Re-run /gmk-merge-gate.
```

## Edge cases & policy

### What counts as "main" / "base branch"

Default is `main`. If the repo's default differs (`master`, `trunk`), the skill detects via `git symbolic-ref refs/remotes/origin/HEAD` and uses that. `--base <branch>` overrides.

If the candidate branch *is* main (user committed directly), Check 2 has no diff. Report **N/A** for asset conflict and explain in one line: *"Candidate branch is main — no diff to check. Run gate before committing instead, on a feature branch."*

### Regression report points at a different `validations/` set

The regression report's milestone-id list should equal the set of PASS milestones in `milestones.json` (other than the candidate). If they diverge — a milestone was added since the regression run — that's stale. Re-run regression. The threshold is "same set of PASS milestones," not just "≤24h."

### Asset conflict — generated files

Engine ports auto-generate files (`/gmk-port` writes scripts/scenes). Two milestones porting separately to the same engine target *will* touch overlapping paths if they refactor a shared system. That's exactly the case Check 2 catches. The fix isn't to suppress the warning — it's for the user to decide whether the second port replaces or extends the first.

### Secret scan — false positives

`gitleaks` flags `.env.example` files because they often have placeholder keys shaped like real ones. The skill doesn't try to filter — it surfaces every match, redacted, and the user judges. If the user runs the gate repeatedly with the same known-safe placeholder, suggest adding the file to `.gitleaks.toml`'s allowlist; don't bake an allowlist into this skill.

### `--no-regression` / `--no-asset` / `--no-secret`

Each check can be skipped with the matching flag. The skill warns once per skip:

> *"Check 3 skipped (--no-secret). The merge-gate verdict reflects 2 of 3 checks; a skipped check isn't a passed check. Document why in the milestone notes if this is a deliberate decision."*

Skipping all three is allowed but pointless — the gate prints PASS with N=0 and an unusually loud warning that the user just ran an empty gate.

### Re-running after a fix

Each run is fresh. The report gets overwritten. The user fixes, re-runs, sees PASS, merges. No state carries between runs except via `milestones.json`.

### Multiple milestones in review at once

The gate runs per milestone. If three are in review, the user calls `/gmk-merge-gate m1`, then `/gmk-merge-gate m2`, then `m3`. Each gets its own report. Don't try to combine — interleaving the checks across three candidates makes the failing rows ambiguous.

### Candidate milestone has no `ported_to` yet

That's the common case (port comes after merge in this kit's flow). Asset conflict still works — it uses the raw git diff, not `ported_to.files_*`. The `ported_to` lookup is for *other* milestones, to know what they previously generated.

### `gitleaks` is on PATH but errors out

If `gitleaks detect` exits non-zero with no findings, fall through to the built-in pattern set and note: *"gitleaks present but failed (exit N). Used fallback pattern set instead."* Don't hard-fail the gate on tool-error alone — secrets that gitleaks would have found will also trip the (narrower) fallback.

## What this skill does NOT do

- **Doesn't actually merge.** It checks; the user merges via git.
- **Doesn't run `/gmk-port`.** That's the next step after PASS for porting milestones.
- **Doesn't read .env files.** It scans them for secret patterns; it doesn't load them.
- **Doesn't auto-fix conflicts or remove secrets.** Surfaces them; the user resolves.
- **Doesn't rebase or fetch.** Caller is responsible for being on the right branch with up-to-date refs.
- **Doesn't post the report anywhere.** The file goes on disk. The user pushes / shares as they see fit.

## Notes for the model running this skill

- **Reuse `/gmk-regression` reports aggressively.** The wall-time of a 4-milestone regression run is meaningful (8-20 min). 24h freshness + same PASS set = trust it.
- **Redact, never echo.** A real secret in the merge-gate.md is itself a leak (git, IDE history, screenshare). Always show first-4-chars + asterisks.
- **Asset conflict is the quiet one.** Regression FAILs are obvious (bot says so). Secrets are obvious (gitleaks says so). Asset conflicts are the case where everything *looks* fine and merge silently overwrites — surface them clearly with the "who touched it" annotation.
- **One milestone per gate.** Resist the urge to batch. Each run, one candidate, one report file.
- **N/A is not PASS.** When Check 1 has nothing to regress against, say N/A, not PASS. The user reads three results; conflating N/A with PASS misleads them on coverage.
- **Don't lecture on secret hygiene.** A redacted match and a one-line fix-direction is enough. The user already knows secrets are bad.
- **The report is the deliverable.** The print summary is for the terminal; the markdown is for git / review / coming back to it tomorrow. Both must agree on the failing rows.
