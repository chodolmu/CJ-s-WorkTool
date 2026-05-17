---
name: gmk-regression
description: Re-run /gmk-validate's bot trials against every previously-PASS milestone and compare verdicts to flag regressions — a milestone that used to PASS but now FAILs after the latest changes. Reads .gamemaker-kit/validations/<m>/aggregated.json for the baseline and re-runs the bot trial with the same config. Writes a roll-up report to _workspace/regression-report-{date}.md and per-milestone deltas. Use when the user says "/gmk-regression", "regression check", "회귀 검증", "did anything break", or before /gmk-merge-gate. Reads many milestones; writes a single roll-up + per-milestone trial files.
model: sonnet
---

# gmk-regression — Did anything that used to pass stop passing?

Each milestone in `milestones.json` carries a `validation` block with the trial that produced its current verdict. Once a milestone is PASS, the kit *assumes* it stays PASS — but a later milestone often changes shared code (a library tweak, a global config, a refactor) that breaks an earlier mechanic. Without re-running, the regression is invisible until the user trips on it at port time.

This skill iterates every PASS milestone, re-runs its bot trial with the **same config that originally passed**, and flags any verdict that changed. PASS → FAIL is a regression; INCONCLUSIVE → PASS is a recovery; PASS → INCONCLUSIVE is borderline and surfaced too.

Output: a single roll-up markdown report + updated `.gamemaker-kit/validations/<m>/aggregated.json` for each re-run milestone.

## Preconditions

1. **`.gamemaker-kit/milestones.json` exists** with at least one PASS milestone.
2. **Playwright is installed** (same check `/gmk-validate` runs). If absent, stop with the same install message.
3. **Prototypes still exist** at the paths each milestone declares. If a prototype file is missing, skip that milestone with a noted reason (`prototype-deleted`).

_Standard preconditions (milestone-id resolution, empty/partial state, refuse-chain cycle guard) follow `gmk-prototype-rules` Rule 13-14._

## Flow

### Step 1 — Build the regression target list

Iterate `milestones[]`. Include a milestone iff:

- `validation.verdict === 'PASS'`, AND
- `prototype` path exists on disk, AND
- `killed !== true`

Skip silently for verdict ≠ PASS (regression checking on already-failed milestones produces no signal). Skip killed milestones (they're not part of the live surface).

If the resulting list is empty: *"No PASS milestones to regress. Run /gmk-validate first to establish at least one baseline. [Rule 14] /gmk-regression → /gmk-validate — verified target's preconditions can be satisfied from current state."* Stop.

### Step 2 — Show the run plan

```
Regression check plan
  Milestones to re-run: 4
    m1-merge-feel    (last PASS 2026-05-09, trial t-2026-05-09-01)
    m2-dragon-evo    (last PASS 2026-05-10, trial t-2026-05-10-02)
    m3-egg-spawn     (last PASS 2026-05-11, trial t-2026-05-11-01)
    m4-merchant      (last PASS 2026-05-12, trial t-2026-05-12-01)
  Each re-runs with its original config (policy, runs, seed_offset).
  Estimated wall time: ~8-20 min (depends on per-prototype speed).

Proceed?  Or --milestones m1,m3 to limit set.
```

If user passes `--milestones m1,m3`, restrict the list to those (still must be PASS).

### Step 3 — Re-run each milestone

For each milestone, invoke the same Playwright-based runner `/gmk-validate` uses, with the **exact same config** that produced the baseline PASS (read from `validation.config` or, fallback, from the most recent `trial-{id}.json`).

Crucial detail: do NOT alter the config. If the baseline used `policy: persona-mix, runs: 200`, the regression re-runs with `persona-mix, 200`. Changing the config (e.g., upgrading to a newer persona-mix definition) would conflate "the prototype broke" with "the test surface changed."

Run trials sequentially (not in parallel) — Playwright Chromium uses meaningful RAM/CPU per instance. Print progress between milestones: `[regression] 2/4 done, m2-dragon-evo still PASS.`

### Step 4 — Compare verdicts

For each re-run, compare:

```
| Milestone     | Baseline verdict | Regression verdict | Status     |
|---------------|------------------|--------------------|------------|
| m1-merge-feel | PASS             | PASS               | unchanged  |
| m2-dragon-evo | PASS             | FAIL               | REGRESSION |
| m3-egg-spawn  | PASS             | INCONCLUSIVE       | DRIFT      |
| m4-merchant   | PASS             | PASS               | unchanged  |
```

Beyond pass/fail, also compute the **metric delta** for each always-on metric (clear_rate, crash_rate, dominant_strategy_ratio, action_entropy, session_length_avg_ms). Flag drift even where the verdict didn't change:

```
m1-merge-feel — verdict unchanged (PASS → PASS), but:
  clear_rate            : 67% → 54%   (-13 pp)   ⚠ drift > 10pp
  dominant_strategy_ratio: 31% → 42%   (+11 pp)   ⚠ drift > 10pp
```

Drift thresholds (advisory, not gating):
- ±10 percentage points on rates → ⚠ flag
- ±25% relative change on durations / counts → ⚠ flag

### Step 5 — Categorize each result

| Status | Meaning | What to do |
|---|---|---|
| **unchanged** | Verdict same, no drift flags | Nothing. |
| **drift** | Verdict same, but metrics moved past threshold | User reviews; may indicate hidden regression that hasn't quite tripped the verdict. |
| **REGRESSION** | PASS → FAIL or PASS → INCONCLUSIVE | **Investigate immediately.** A recently-merged change probably broke this milestone. |
| **recovery** | (rare) — wasn't in scope (we only re-run PASS) | Not applicable here; would surface if INCONCLUSIVE milestones were optionally re-run. |
| **stuck** | Same FAIL reason; not a regression but a stale check | Skip if we restricted to PASS-only — wouldn't reach here. |

### Step 6 — Surface likely culprits (best-effort)

For each REGRESSION, scan recent git history (best-effort — skip if git unavailable):

```bash
git log --oneline --since="<baseline_pass_date>" -- prototypes/<m>.html templates/_bot_hook_lib.js
```

Surface the commits that touched the prototype's file OR the shared library file since baseline. The user reads the list and zeros in:

```
m2-dragon-evo — REGRESSION: PASS → FAIL
  Most recent changes since baseline (2026-05-10):
    - 2026-05-11 ad32e94 "tweak merge resolver for tier-2"  (prototype)
    - 2026-05-12 (uncommitted local changes to _bot_hook_lib.js)

  Investigate the 2026-05-11 commit first.
```

Don't claim certainty about cause — just list candidates. The user's eyes are faster than heuristics here.

### Step 7 — Write to disk

For each re-run milestone:

- Write the new trial: `.gamemaker-kit/validations/<m>/trial-{new-trial-id}.json` (immutable, per `/gmk-validate`'s convention).
- Update `.gamemaker-kit/validations/<m>/aggregated.json` (overwrite with latest roll-up).
- For REGRESSIONs only: surface the conflict in the report. **Don't downgrade PASS → FAIL without explicit user consent on regressions.** Default behavior: the new trial is written to disk (`trial-{id}.json`), but milestones.json's top-level `validation` block is *not* modified. The user runs `/gmk-validate <m> --accept-regression` to commit the downgrade (which then overwrites the top-level `validation` with `regression_of_trial: <baseline_trial_id>` recorded inline). (v0.4 deprecation: `validation_history[]` is no longer written — see `structure.md` § v0.4 deprecated fields. The disk-level `trial-{id}.json` files are the authoritative trace.)

(This split exists because regression runs can have false-positive FAILs — a Playwright timeout on a flaky network, a transient browser issue. We capture the data but don't auto-downgrade a milestone.)

Write the roll-up: `_workspace/regression-report-{YYYY-MM-DD-HHMM}.md`:

```markdown
# Regression report — {timestamp}

## Summary
- Milestones checked: 4
- Unchanged:    2
- Drift:        1
- REGRESSION:   1

## Verdict table
{table from Step 4}

## Drift details
m1-merge-feel
  clear_rate: 67% → 54% (-13 pp)
  ...

## REGRESSIONS
m2-dragon-evo — PASS → FAIL
  Baseline trial: t-2026-05-10-02
  Regression trial: t-2026-05-12-regr-01
  Failing rows:
    ✗ session_length_avg_ms  target: > 240000  actual: 138000
  Likely culprits (git):
    - 2026-05-11 ad32e94 "tweak merge resolver for tier-2"

## Next
- For each REGRESSION: investigate the named commits; if the regression is real,
  fix the prototype or revert the change.
- /gmk-validate m2-dragon-evo --accept-regression — only if the regression is
  intentional / acceptable, this commits the FAIL verdict to milestones.json.
- /gmk-validate m2-dragon-evo — re-run individually after fixing.
```

### Step 8 — Print the summary

```
Regression check complete
  Milestones checked: 4
  Unchanged:  2  (m1, m4)
  Drift:      1  (m1 — clear_rate -13pp, watch this)
  REGRESSION: 1  (m2-dragon-evo — PASS → FAIL)

  Trial data written:
    .gamemaker-kit/validations/m1-merge-feel/trial-t-2026-05-12-regr-01.json
    .gamemaker-kit/validations/m2-dragon-evo/trial-t-2026-05-12-regr-02.json
    ...
  Report: _workspace/regression-report-2026-05-12-2245.md

  NOTE: m2-dragon-evo's verdict in milestones.json is still PASS. The regression
  trial is captured but not auto-applied. Investigate, then either fix and
  /gmk-validate m2 — OR /gmk-validate m2 --accept-regression to commit FAIL.

Next:
  - Read the report for the REGRESSION's likely culprits.
  - @playtest-analyst <regressing-milestone-id> — diagnose the drift / regression
    pattern (which persona, which metric, which suspicious cluster). The analyst
    is the only agent allowed to read trial-level logs, so this is the cleanest
    next step for "what does this drift mean?"
  - /gmk-merge-gate reads this report as part of the merge decision.
```

### Step 8.5 — Route to `playtest-analyst` on REGRESSION or significant drift

When any milestone shows **REGRESSION** (PASS → FAIL) OR a metric drift > 25% of baseline, the "Next:" block must recommend `playtest-analyst`. The analyst is the *only* agent allowed to read trial-level logs (one-way verification — MAST FM-2.x), and its "Time-to-clear drift" pattern is the canonical match.

Routing rules:

| Condition | Recommended agent | Notes |
|---|---|---|
| Any milestone went PASS → FAIL | `playtest-analyst` | Full diagnosis run on the regressing milestone — the analyst correlates baseline trials with the regression trial and routes downstream (systems-designer for invariant breaks, economy-balancer for balance drift, etc.). |
| Drift > 25% on a metric without verdict change | `playtest-analyst` (optional) | Capture-but-don't-apply is in effect, but the user may want a diagnosis before deciding to `--accept-regression`. |
| Multiple milestones drift together | `playtest-analyst` (high-value) | Often signals a shared-file change (`_bot_hook_lib.js`) — the analyst can spot the cross-milestone pattern faster than the user. |
| All milestones unchanged | (none) | No agent needed; the regression report is the deliverable. |

The route is a recommendation; do not auto-invoke. The analyst's preconditions (`milestones.json` validation summary, structured hypothesis rows) are satisfied automatically since this skill just wrote them.

_The routing output follows `gmk-prototype-rules` Rule 15 (agent routing block format)._

## Edge cases & policy

### Non-determinism shows up at regression time

If two consecutive regression runs of the same milestone produce different verdicts, the prototype's determinism broke (per `gmk-prototype-rules` §3). Surface specifically: *"m3 produced PASS then FAIL across two consecutive regression runs. The prototype is non-deterministic — likely Math.random crept into game logic. Fix per gmk-prototype-rules §3."*

The skill doesn't try to repeat by default (wall-time cost). If the user wants double-check, run `/gmk-regression --milestones m3 --repeat 2` (extension, not default).

### Prototype file is gone

Skip silently with one line in the report: *"m3-egg-spawn: prototype file missing (`prototypes/m3-egg-spawn.html`). Was the milestone renamed or moved?"* Don't fail the whole regression check.

### Persona-mix calibration changed

If `/gmk-validate`'s persona definitions change (future Wave change), regressing old PASS milestones against the new personas conflates two signals. The skill warns once: *"Persona definitions may have changed since baseline trials. Differences may reflect the new persona set, not prototype regression. Consider /gmk-validate <m> --rebaseline to update each baseline against current personas first."*

The skill doesn't auto-detect persona changes; it warns conservatively whenever any milestone was last validated more than 30 days ago.

### User wants to limit time

`--max-wall-time 5m` cuts the run after the named duration. Skip remaining milestones; report what was done.

### Drift without verdict change

Drift is advisory. The skill notes it; the user decides whether to act. A 13-percentage-point drop in clear_rate is a flag but not a blocker.

### Wave C: integration with /gmk-merge-gate

`/gmk-merge-gate` (lands in Wave C) reads the most recent regression report as one of its three checks. If the report is more than 24 hours old, `/gmk-merge-gate` re-runs regression itself. Don't worry about that integration here — just write a fresh report each call.

## What this skill does NOT do

- **Doesn't auto-fix regressions.** Surfaces likely culprits; the user fixes (or reverts, or accepts).
- **Doesn't auto-downgrade verdicts.** Captures regression-trial data; user explicitly accepts via `/gmk-validate <m> --accept-regression`.
- **Doesn't re-run FAIL milestones.** Out of scope — they aren't part of the "live surface" we're checking for regression.
- **Doesn't run in parallel.** Sequential only; Playwright Chromium is RAM-heavy.
- **Doesn't account for ported milestones.** Engine-side regression is a different question; `/gmk-port`'s metric diff handles it.
- **Doesn't auto-rebaseline.** That's a deliberate `/gmk-validate <m> --rebaseline` call by the user.

## Notes for the model running this skill

- **The capture-but-don't-apply pattern is load-bearing.** Auto-downgrading PASS to FAIL on a single re-run breeds false positives and erodes trust in the verdict. The skill writes the data and surfaces the conflict; the user commits.
- **Drift is the early warning.** Verdict changes are loud; metric drift is quiet. Surface drift clearly — it's often the actionable signal before the next round.
- **Cite git, don't run linters.** Identifying "what changed" is a git-log call. Don't try to AST-diff the prototype.
- **Don't claim causation.** "Likely culprit: this commit" is right; "this commit broke m2" is overreach. The user reads the candidates.
- **Wall-time honesty.** Tell the user upfront how long this will take. 200 runs × 4 milestones × 2s/run = ~25 minutes. Don't surprise them.
- **The regression report is read in 30 seconds.** If the user has 4 milestones and 0 changes, the report should be 10 lines, not 200. Calibrate to actual content; don't pad.
- **No external services.** All data stays in the project. No telemetry, no upload.
