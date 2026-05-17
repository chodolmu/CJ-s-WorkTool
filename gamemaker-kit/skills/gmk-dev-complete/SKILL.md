---
name: gmk-dev-complete
description: Check whether the project has reached gamemaker-kit's dev-complete checkpoint — all non-killed milestones double-validated and ported (RE_PASS), every Pillar covered by ≥1 shipped milestone, no merge-gate blockers — and emit a release-readiness report. Writes _workspace/dev-complete-report.md. Use when the user says "/gmk-dev-complete", "graduate", "끝났나", "ship-ready", "release readiness", or when gmk-loop signals the last milestone is shipped. This is the project-level release-readiness checkpoint of gamemaker-kit — past this point, ship / live-ops / external feedback live outside the kit.
model: sonnet
---

# gmk-dev-complete — Has the project reached gmk's release-readiness checkpoint?

This skill answers one question:

> *"Has the project crossed gamemaker-kit's promise — *"plugin 안에서 게임 개발을 끝낸다"* — to the point where the user can honestly say 'now I just need to ship it'?"*

The answer is **structural**, not vibes. The skill reads canonical state (`pillars.json` + `milestones.json` + the port checklists + the merge-gate records) and checks a small set of conditions. The output is a release-readiness report the user can read in 60 seconds.

This SKILL is the **project-level release-readiness checkpoint** of the kit. Marathon-style milestone gates (validate / self-test / port / merge-gate) check one milestone at a time. This one checks the project as a whole — and the verdict is recomputable: adding a milestone, reviving a killed one, or accepting a regression will re-open the project on the next run. Checkpoint, not terminus.

Past `gmk-dev-complete` returning PASS, gamemaker-kit has nothing more to do. **Steam pages, marketing, wishlist management, live-ops patch notes, external-human feedback collection — none of that lives in this plugin.** The kit's job is over.

## Preconditions

1. **`pillars.json` exists.** Without pillars, "dev-complete" has no meaning — there's nothing to verify coverage against.
   - Missing: *"No pillars.json. The release-readiness check needs a vision to verify against. Run `/gmk-init` first if you're starting a new project, or you're in the wrong directory."*

2. **`milestones.json` exists** with at least one non-killed milestone.
   - Missing or all-killed: *"No live milestones. Either the project hasn't started (run `/gmk-roadmap` + `/gmk-prototype`), or every milestone was killed (the project is in a re-design moment, not at the checkpoint). [Rule 14] /gmk-dev-complete → /gmk-roadmap → /gmk-prototype — verified targets' preconditions can be satisfied from current state."*

3. **`.gamemaker-kit/` exists.** (Sanity — same as `gmk-status`.)

Don't refuse on partially-shipped projects. The skill reports incomplete state honestly — that's its point.

_Standard preconditions (milestone-id resolution, empty/partial state, refuse-chain cycle guard) follow `gmk-prototype-rules` Rule 13-14._

## Flow

### Step 1 — Read canonical state

Read:
- `pillars.json` — pillar list + anti-examples
- `milestones.json` — every milestone, killed or live
- Optionally `.gamemaker-kit/merge-gates/<m>.md` files (for warnings)
- Optionally `.gamemaker-kit/port-checklists/<m>.md` files (for warnings)

Derive these facts:

| Fact | How |
|---|---|
| `live_milestones` | `killed !== true` |
| `killed_milestones` | `killed === true` |
| `shipped_milestones` | live AND `validation.verdict === 'PASS'` AND `self_test.latest_verdict === 'PASS'` AND `ported_to.re_validation.verdict === 'RE_PASS'` |
| `in_flight_milestones` | live AND NOT shipped |
| `pillar_coverage[pid]` | count of shipped milestones with `pid` in `pillars_targeted` |
| `pillars_with_zero_shipped` | pillars where `pillar_coverage[pid] === 0` |
| `unresolved_merge_gates` | shipped milestones where `merge_gate?.verdict !== 'PASS'` |
| `forced_gates` | shipped milestones with `forced: true` on any *single* gate |
| `double_forced_gates` | shipped milestones with `forced: true` on **both** validation AND self-test (the two evidence-bearing gates) |

### Step 2 — Run the dev-complete checks

The checkpoint resolves to PASS when **all** of the following pass. The checks are deliberately strict because the user is about to declare a transition (gmk → ship/live-ops); false positives here are expensive. (The checkpoint is recomputable — a later change can flip the verdict back to NOT_COMPLETE; that's the point of the "checkpoint, not endpoint" framing.)

| Check | Pass condition | If fails |
|---|---|---|
| **C1 — Live milestones non-empty** | `len(live_milestones) > 0` | FAIL — project has no live work; nothing to declare complete |
| **C2 — All live milestones are shipped** | `len(in_flight_milestones) === 0` | FAIL — list which milestones are at which gate (Plan / Build / Validate / Integrate) |
| **C3 — Every pillar has ≥1 shipped milestone** | `pillars_with_zero_shipped.length === 0` | FAIL — name the uncovered pillars; suggest `/gmk-roadmap` to plan or `/gmk-kill-milestone` if the pillar is being abandoned |
| **C4 — No unresolved merge-gates** | `unresolved_merge_gates.length === 0` | WARN — shipped milestones with FAIL or missing merge-gate. User decides whether to override |
| **C5 — No forced overrides on critical gates** | `forced_gates.length === 0` AND `double_forced_gates.length === 0` | Two sub-cases: (a) `double_forced_gates.length > 0` → **FAIL** (cannot be acknowledged via `--accept-warnings` — a milestone whose *both* validation and self-test were forced has zero evidence behind it; reaching DEV_COMPLETE on it would be vacuous). (b) `forced_gates.length > 0` AND `double_forced_gates.length === 0` → **WARN** (one gate was forced, the other holds; user acknowledges via `--accept-warnings`). |
| **C6 — Pillars file lock** | `pillars.json.created_at` is set AND no `skipped: true` flag | WARN — pillars were skipped at init; the dev-complete declaration is on shaky ground |

**Verdict aggregation**:
- **DEV_COMPLETE** — all C1-C3 PASS AND C5 not in FAIL state AND no C4-C6 active WARN that the user hasn't acknowledged
- **NOT_COMPLETE** — any C1-C3 FAIL, OR C5 in FAIL state (double-forced milestone present)
- **COMPLETE_WITH_WARNINGS** — C1-C3 PASS AND C5 not in FAIL state, but C4 / C5-WARN / C6 has unresolved warnings; user can mark `--accept-warnings` to upgrade to DEV_COMPLETE

### Step 3 — Write the release-readiness report

Path: `_workspace/dev-complete-report.md`. **Overwrite** every run (latest state is the only state that matters; git keeps history).

Template:

```markdown
# Dev-complete report — {project_name}

> Generated: {timestamp} by /gmk-dev-complete
> Verdict: **{DEV_COMPLETE | COMPLETE_WITH_WARNINGS | NOT_COMPLETE}**

## What this means

{One paragraph, verdict-specific. Examples below.}

## Pillar coverage

| Pillar | Shipped milestones | Anti-example seen? |
|---|---|---|
| tactile-satisfaction | m1-merge-feel | no |
| discovery-joy | m2-dragon-evo, m3-egg-spawn | no |
| {pillar} | (none) | n/a |

## Milestone status

| ID | Name | Pillars | Gate state | Verdicts |
|---|---|---|---|---|
| m1-merge-feel | Merge feel | tactile | Shipped | bot PASS · self-test PASS · merge-gate PASS · port RE_PASS |
| m2-dragon-evo | Dragon evolution | discovery | Validate (self-test missing) | bot PASS · self-test — · merge-gate — · port — |
| m4-killed | Roguelike graft | — | KILLED | reason: violated tactile pillar |

## Check results

| Check | Result | Detail |
|---|---|---|
| C1 — Live milestones non-empty | ✓ PASS | 3 live, 1 killed |
| C2 — All live milestones shipped | ✗ FAIL | m2-dragon-evo at Validate gate (self-test missing) |
| C3 — Every pillar has ≥1 shipped milestone | ✗ FAIL | uncovered: frictionless-restart |
| C4 — No unresolved merge-gates | ✓ PASS | — |
| C5 — No forced overrides | ⚠ WARN | m1 port had `forced: true` on self-test gate |
| C6 — Pillars locked, not skipped | ✓ PASS | — |

## What's left (only present when NOT_COMPLETE)

1. **m2-dragon-evo** — run `/gmk-self-test m2-dragon-evo` (bot PASS already; just the user playtest left)
2. **frictionless-restart pillar uncovered** — `/gmk-roadmap` to plan a milestone targeting this pillar, OR honestly decide it's being abandoned and remove from pillars.json

## What happens past DEV_COMPLETE (only present when DEV_COMPLETE)

gamemaker-kit's job ends here. Past this point:

- **Steam page, marketing, wishlist, social** — outside gmk's scope. The kit deliberately doesn't help with these.
- **Live-ops, patch notes, A/B testing in prod** — outside scope.
- **External-human feedback collection** — outside scope (gmk's only validation channels are bot + your own self-test).

Recommended handoff:
- Read CONCEPT.md §1 "What gmk doesn't do" if you want the rationale.
- The project's `_workspace/` and `.gamemaker-kit/` directories are now your release artifact for future-you (or a teammate who picks this up later).
- `git tag dev-complete-{date}` if you want a marker.

## Forced / warned items (present when warnings exist)

| Milestone | Type | Detail |
|---|---|---|
| m1-merge-feel | forced self-test | self-test was bypassed on 2026-05-09 with reason "bot signal already convincing" |

Acknowledge these with `/gmk-dev-complete --accept-warnings` to upgrade verdict to DEV_COMPLETE.
```

### Step 4 — Print summary to chat

Don't dump the report into the chat. Print the verdict + the one-screen summary; tell the user to open the report for the full picture.

PASS example:

```
{project_name} — DEV_COMPLETE ✓

  Pillars covered:    3 / 3
  Milestones shipped: 4 / 4   (0 killed, 0 in flight)
  No unresolved warnings.

Full report: _workspace/dev-complete-report.md

gamemaker-kit is done with this project. Past this point, shipping /
live-ops / external feedback live outside the plugin (CONCEPT.md §1).

If you want a git marker: git tag dev-complete-{date}
```

NOT_COMPLETE example:

```
{project_name} — NOT_COMPLETE

  Failing checks:
    ✗ C2 — m2-dragon-evo at Validate gate (self-test missing)
    ✗ C3 — frictionless-restart pillar uncovered

  Pillars covered:    2 / 3
  Milestones shipped: 1 / 3

Full report: _workspace/dev-complete-report.md

What's left:
  1. /gmk-self-test m2-dragon-evo
  2. Decide on frictionless-restart pillar:
     - /gmk-roadmap to plan a milestone, OR
     - remove from pillars.json if abandoned

Re-run /gmk-dev-complete after either.
```

COMPLETE_WITH_WARNINGS example:

```
{project_name} — COMPLETE_WITH_WARNINGS ⚠

  Core checks PASS (C1-C3), but warnings need acknowledgment:
    ⚠ C5 — m1-merge-feel: forced self-test bypass on 2026-05-09

  Full report: _workspace/dev-complete-report.md

To accept the warnings and mark DEV_COMPLETE:
  /gmk-dev-complete --accept-warnings

To address them: open the milestone's record, decide whether to re-run
the bypassed gate or document why the override is acceptable.
```

### Step 5 — Don't touch milestones.json or pillars.json

This skill is **read-only on `milestones.json` / `pillars.json`** (canonical state). It writes `_workspace/dev-complete-report.md` always, and `warnings_acknowledged_at` into merge_gate / port-checklist files when invoked with `--accept-warnings`. The verdict isn't persisted into the canonical JSON files — it's recomputed every run from primary sources. (If the project state changes after a DEV_COMPLETE verdict, the next run re-computes correctly.)

If the user wants persistence (e.g., a git tag), suggest `git tag` — don't write to milestones.json.

## Sub-flags

| Flag | Default | Effect | Side-effect |
|---|---|---|---|
| `--accept-warnings` | — | Upgrades `COMPLETE_WITH_WARNINGS` verdict to `DEV_COMPLETE` and **persists** the acknowledgment. Each warned milestone gets `warnings_acknowledged_at: "<iso>"` written to its merge_gate or port checklist record (whichever produced the warning). Subsequent runs read the timestamp and skip the warning *if* no new warning has appeared since. If C1-C3 are failing, the flag is a no-op (cannot override structural failures). | `<warned-milestone>.<gate>.warnings_acknowledged_at` written. The dev-complete report is overwritten with the upgraded verdict. |

## Edge cases & policy

### `--accept-warnings` details

As of v0.4 the acceptance is **persisted**: each warned milestone's gate record gets `warnings_acknowledged_at` written. On subsequent runs, the skill reads the timestamp and only re-prints the warning if a *new* warning has appeared since (e.g., the merge-gate was re-run and produced a new warning row). Pre-v0.4 the flag was per-invocation only; users upgrading from v0.3 will see warnings re-emerge once, on first run after upgrade.

If C1-C3 are failing, `--accept-warnings` does nothing — it can't override structural failures. Same for C5 in its FAIL state (double-forced milestone): `--accept-warnings` does nothing, the user must un-force at least one of the two gates (re-run `/gmk-validate` or `/gmk-self-test` without `--force`) before dev-complete can resolve.

### Project with `killed_milestones` and zero `shipped_milestones`

If the user killed every milestone they tried, the project is in a re-design moment. Return NOT_COMPLETE with a specific message: *"Every milestone is killed. The project is in re-design, not at the checkpoint. Either revive a killed milestone (`/gmk-kill-milestone --revive`) or start fresh with new pillars (`/gmk-roadmap`)."*

### Pillar with only killed milestones

If a pillar's only milestones got killed, C3 fails for that pillar. Surface specifically: *"Pillar `tactile-satisfaction` has 2 milestones, both killed (m0-roguelike, m4-experiment). No shipped milestone covers this pillar. Either start a new milestone or honestly remove the pillar."*

### Re-running after dev-complete

After DEV_COMPLETE, if the user adds a new milestone, the next run shows NOT_COMPLETE again (correct behavior — the project re-opened). The previous report is overwritten; git history preserves it.

### Project with engine = "other" (Love2D, GameMaker Studio, etc.)

`/gmk-port` doesn't auto-generate code for non-Godot/Unity engines, but the user may still hand-port and update `ported_to.re_validation.verdict` to `RE_PASS`. C2 accepts that — the verdict field is what matters, not how the port happened.

### No `_workspace/` directory

Create it. The skill always writes `_workspace/dev-complete-report.md`.

## What this skill does NOT do

- **Doesn't ship the game.** External release is outside scope. The skill stops at the checkpoint.
- **Doesn't write to milestones.json or pillars.json.** Read-only on canonical state; writes only the dev-complete report and `warnings_acknowledged_at` into merge_gate / port-checklist files when `--accept-warnings` is used.
- **Doesn't auto-tag git.** Suggests `git tag` if the user wants a marker; doesn't run it.
- **Doesn't override C1-C3 failures.** `--accept-warnings` only handles C4-C6.
- **Doesn't call any agent.** This is a state-aggregation skill; no domain agents are needed.
- **Doesn't update CHANGELOG, README, or marketing assets.** Those concerns are explicitly outside gmk's scope.
- **Doesn't validate ported binaries.** If the engine port re-validates (Stages 2-5), the kit considers the port done. Whether the .exe / .pck / .ipa actually works in production hands is outside the kit.

## Notes for the model running this skill

- **The verdict is structural, not encouraging.** Don't soften NOT_COMPLETE into "almost there!". The user is about to make a release-readiness decision; honest is better than nice.
- **C3 (pillar coverage) is load-bearing.** Many projects look DEV_COMPLETE on the milestone axis but have a pillar with no shipped milestone — usually because the user pivoted mid-project and never updated pillars.json. Surface it.
- **Forced overrides aren't bad by default.** A `forced: true` from a justified user decision is fine. The WARN exists so the user re-reads their own decision before declaring done.
- **The report is the deliverable.** Chat summary is one screen; the full table lives in `_workspace/dev-complete-report.md`. Don't pad chat output to compete with the report.
- **No vibes language in the verdict.** "DEV_COMPLETE" / "NOT_COMPLETE" / "COMPLETE_WITH_WARNINGS" — no "ready to ship" / "looking good" softening. The user owns the ship call; the kit owns the dev-complete call.
- **Past dev-complete is not the kit's problem.** Resist the urge to suggest "next steps" beyond the canonical handoff text. CONCEPT.md §1 is the authority on scope.
