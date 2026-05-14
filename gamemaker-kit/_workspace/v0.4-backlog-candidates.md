# dogfood findings — gamemaker-kit v0.2 → v0.3 backlog

**Source**: dino-run dogfood, 2026-05-13. Game built m1 → m4 (m5 unbuilt). Findings logged at point of friction during real-time SKILL execution.

**Purpose**: v0.3 implementation backlog. Each finding is a **gamemaker-kit defect**, not a dino-run defect. The game is the test rig; the findings are the artifact.

**How to read this**: findings are grouped by priority (Critical / Major / Minor), not by discovery order. Each entry names the SKILL or shared file with the defect, sketches the change, and points to dino-run evidence so a v0.3 implementer can reproduce.

---

## Critical — defects that produce wrong verdicts or block legitimate work

### C1 — Bot-row targets are authored against bot capability, not game design

**Symptom**: `m4-collision-and-speed` produced bot FAIL (`session_ticks_p50: 270 vs target 600`) while user hands-on play said "이 정도 난이도면 OK, 가속도 안 빠르게 느껴짐". The hypothesis target `> 600 ticks (10 seconds)` was chosen as a human-readable design intent ("the game should run ~10s into the acceleration window") but the bot's reaction substrate is 16ms/tick — a Random bot dies in 3s, a Survivor bot dies in 4.3s. The 10-second target is achievable only by a non-random policy, so the metric tests *whether the bot is competent at this game*, not *whether the game holds up*. Human and bot operate on different reaction-time scales; absolute-tick targets confuse the two.

**Affected SKILL**: `gmk-prototype` Step 3 (`measured_by` schema), `gmk-validate` Step 4 (hypothesis row evaluation).

**Change sketch (v0.3)**:
- `gmk-validate` runs a **Random baseline pass** (e.g. 20 runs uniform-random) before persona-mix, and stores `metrics.random_baseline.*`. Bot-row targets must be expressible as ratios over baseline (`session_ticks_p50 > 1.5 × random_p50`) OR absolute with an explicit `_target_scale: 'bot'` declaration that the SKILL doesn't auto-interpret as design-level.
- `gmk-prototype` Step 3 prompts: *"This metric's target — is it a number a human can predict, or a ratio over what a random bot would do? Bot rows usually want a ratio."* If the user authors an absolute number, write `_target_authored_against: 'bot|human|unspecified'` to milestones.json so `gmk-validate` can format the verdict in matching units.

**Repro**: `dino-run/.gamemaker-kit/milestones.json` → `m4-collision-and-speed.validation.hypothesis_rows`. Two FAIL rows, both with bot-authored absolute targets. Game was hands-on confirmed PASS by user.

**Priority**: Critical. This single defect produces a verdict that is *worse than no verdict* — it tells the user the game is broken when the game is fine, while also masking real bot issues (like C2 below).

---

### C2 — Determinism check compares wall-clock fields, false-positives on prototypes whose runs end at varying ticks

**Symptom**: `m4-collision-and-speed` failed the validate-runner determinism check on first invocation. Root cause: the runner's check compared `JSON.stringify(summary())` between two seed-0 runs, and `summary().duration_ms` is wall-clock (set in `_bot_hook_lib.js` line 117/179 via `performance.now()`). m1–m3 happened to never die mid-action-loop (they all timed out at SESSION_TICKS), so duration_ms was tick-bounded and looked deterministic. m4 dies on collision at varying *real-time* moments, exposing the wall-clock leak.

**Affected file**: `templates/_bot_hook_lib.js` (the `duration_ms` field in `summary()` is intentionally wall-clock for some downstream uses, so the fix may need to live in the harness rather than the library). Practical fix lives in `gmk-validate`'s runner — the determinism check should compare `{score, custom}` only, not the full summary.

**Change sketch (v0.3)**:
- `gmk-validate` Step 0 (smoke check) determinism comparison: explicitly project to `{score, custom}` before stringifying. Document in `gmk-prototype-rules` §3 (determinism rules) which summary fields are part of the deterministic contract and which are observational metadata.
- Consider splitting `summary()` into `state()` (deterministic — score, custom, over_reason) and `metadata()` (non-deterministic — wall-clock, actions_taken). Backward-compat: `summary()` returns both merged for v0.1 callers.

**Repro**: `dino-run/.gamemaker-kit/.validate-runner.cjs` line 137 (before fix) failed with `DETERMINISM_FAIL` on m4. Manual fix applied in the runner for this dogfood; the canonical fix needs to be in v0.3 gmk-validate.

**Priority**: Critical. Blocks all validation on prototypes with variable-length runs. Without C2 fixed, m4-class games can't be validated at all.

---

### C3 — `gmk-self-test` precondition refuses without `validation`, blocking the "bot doesn't apply here" case

**Symptom**: `gmk-self-test` SKILL.md preconditions §2 require `validation` block exists or refuse with *"Run /gmk-validate first."* For m1-jump (no obstacles, no death — bot has no signal to give), this routed me to either (a) burn 200 bot runs that prove nothing, or (b) bypass the SKILL precondition manually and lose the structured flow. There is currently no `--skip-bot` or "this milestone is bot-trivial" path.

**Affected SKILL**: `gmk-self-test` preconditions §2.

**Change sketch (v0.3)**:
- Add `--skip-bot` flag with required `--reason "<text>"` argument. The reason is appended to `self_test.bot_skipped_reason` in milestones.json and printed in the verdict report so the user can't silently bypass.
- Companion: `gmk-validate` learns to write a `validation: {skipped: true, skipped_reason}` block when the user invokes `/gmk-validate <m> --skip --reason "..."` so `gmk-self-test`'s precondition is satisfied by an explicit skip rather than a missing field.

**Repro**: `dino-run/.gamemaker-kit/milestones.json` m1-jump / m2-cactus / m3-duck all show manually-written `validation: {skipped: true, ...}` because the SKILL has no formal way to express "skipped on purpose."

**Priority**: Critical for any non-action game; gates the skill flow.

---

## Major — defects that produce friction or waste user time but don't poison verdicts

### M4 — `gmk-validate` 200-run default is the wrong order of magnitude for most milestones

**Symptom**: SKILL.md Step 1 fixes `--runs 200` as the default. For dino-run m1 (no obstacles, no death), 200 runs would have proven the same thing as 3 runs: the prototype doesn't crash, the bot's action set has the expected cardinality. User asked: *"정말로 이 간단한거에 200번의 테스트가 필요하다고?"* — and the honest answer was no.

For m4 (collision + acceleration, real bot signal), 50 runs gave a clear answer (Survivor 1.35× Random — far enough from 1.5× target to be meaningful, far enough from 1.0× to suggest the riskEstimate has *some* signal). The 200-run default would have added ~3 minutes of wall time for no additional certainty.

**Affected SKILL**: `gmk-validate` Step 1 defaults.

**Change sketch (v0.3)**:
- Default `--runs 50` (4 personas × ~12). Add `--runs 200` as the explicit "tight CI" mode. Keep the 0.80/0.90/0.95 confidence levels — at 50 runs and confidence 0.80 the binomial CI is still useful for most rates.
- `gmk-validate` Step 1 (run plan) prints estimated CI width given the chosen `--runs` and `confidence`, so the user sees the trade-off: *"50 runs × 0.80 conf: ±0.11 on rate-style metrics. 200 runs × 0.90 conf: ±0.07. Bump to 200 if you need that tighter bound."*

**Repro**: m1-jump skipped entirely (200 ÷ runs ratio = ∞). m4 used 50 and got actionable signal.

**Priority**: Major. Wastes user time on every validate call; doesn't poison verdicts.

---

### M5 — `gmk-prototype-rules` doesn't separate "is my mechanic bot-tractable" check from the smoke check

**Symptom**: m2-cactus and m3-duck both went through the full SKILL flow (hypothesis with bot rows, full `riskEstimate` callback authoring) before I noticed — *as the prototype author* — that the bot rows were tautological: collision is non-fatal in both, so the Survivor persona's risk-driven choice doesn't affect outcome. The bot is *measuring my authored riskEstimate function*, not the game.

There's no SKILL step that asks "does this milestone produce real bot signal?" — i.e., is there a survival/score pressure that the personas' biases actually move?

**Affected SKILL**: `gmk-prototype` Step 3 (Fun Hypothesis section).

**Change sketch (v0.3)**:
- Add a checklist to `gmk-prototype` Step 3 hypothesis writing, run after `measured_by` rows are drafted: *"For each bot row, does the prototype have a state where the bot's choice between actions affects the metric? If not, the bot row will produce a tautological measurement of your own bias code. Tag the row `_bot_tautology_risk: yes|no|maybe` so `gmk-validate` can warn."*
- `gmk-validate` Step 4 verdict report: if any row has `_bot_tautology_risk: yes` and PASSed, surface a warning: *"This row's bot-tractability was self-flagged at authoring time. Treat PASS with caution."*

**Repro**: `dino-run/.gamemaker-kit/milestones.json` m2-cactus.measured_by[0] (`jump_success_rate`) — the `_note` field even self-documents the tautology, but the SKILL didn't catch it at authoring time.

**Priority**: Major. Without this, half the milestones in a game like dino-run get bot rows that are placeholders dressed up as gates.

---

### M6 — `gmk-roadmap` doesn't ask "is this game well-served by milestone decomposition?"

**Symptom**: dino-run is a strict clone of a known-working game (~200-line implementation). The natural shape is a single-prototype build. `gmk-roadmap` proposed 5 milestones (one per pillar-mechanic combination); the user then asked: *"애초에 이 구현이 점프부터 한번에 진행되어도 문제가 없을 분량인데 나눠놓은 이유는 있는거야? 이렇게 소규모로 나누면 구현이 더 잘돼?"* — the honest answer was no.

Milestone decomposition's value is **disposability**: "if this mechanic doesn't land, throw it out and start over without engine-side regret." Clones of known-working games gain nothing from this — every mechanic is pre-validated by the original. Yet the SKILL has no opt-out path; it always proposes 3–8 milestones.

**Affected SKILL**: `gmk-roadmap` Step 1.

**Change sketch (v0.3)**:
- Step 0 prompt: *"Before decomposing, what kind of project is this? (a) original design with unproven mechanics, (b) port/clone of an existing game, (c) tutorial/learning project, (d) other"*. For (b)/(c), recommend single-milestone or 2-milestone path: *"This is a clone — the mechanics are pre-validated. Consider one prototype that covers the whole game, validated as a single milestone. Decomposition's value (disposability) doesn't apply here."*
- Don't refuse to decompose if the user insists — just register the choice in `pillars.json` `project_type` so the decomposition recommendation is in the audit trail.

**Repro**: `dino-run/_workspace/roadmap.md` — 5 milestones for a clone. m1-jump (no obstacle) → m2-cactus (cactus added) → m3-duck (duck added) — each prototype carries the previous one verbatim plus one new constant. The chain is linear with no "kill this and restart" branching point.

**Priority**: Major. Wastes ~80% of milestone authoring time on clone-like projects.

---

### M7 — `gmk-init` Step 3 (anti-examples) runs too early — destabilizes pillar text

**Symptom**: dino-run's Pillar 1 was originally `one-button reflex`. The anti-example step prompted me to write what would violate it; the user replied with *"숙이기도 있을텐데"* — and Pillar 1's body had to be rewritten on the spot (`one-button` → `hand-locked-input`, scope `everything` → `during active state`). Same thing happened to Pillar 2 (`sub-second-restart` → `frictionless-restart`) where the anti-example check surfaced that the *time* part of the pillar was wrong; the *friction* part was right.

Anti-examples are *commitments against future drift*. They only become valid commitments when the pillar text itself is stable. Eliciting them at init time, before any milestone exists, gets the user to commit against language they're still drafting.

**Affected SKILL**: `gmk-init` Step 3.

**Change sketch (v0.3)**:
- Move anti-example elicitation to a *deferred* step: after the first milestone passes self-test (so the pillar has been operationalized at least once), or as an explicit user-invoked `/gmk-pillar-stress-test`. Keep Step 3 in `gmk-init` for users who want it upfront — but with an "or skip and come back later" exit that doesn't downgrade the pillars to skipped status.
- Alternative: Step 3 prompts for *one* anti-example per pillar — the smallest possible commitment — and explicitly notes that more can be added after first-milestone learning.

**Repro**: dino-run session log, gmk-init step 3 → "Pillar 1 reframe" exchange.

**Priority**: Major. Drives user-side rework right after a moment that should be settling, not opening.

---

## Minor — defects that are real but lower-impact

### N8 — SKILL.md mechanical-follow-through risk: AI runs every step even when user already gave verdict signal

**Symptom**: After m1-jump's HTML opened in the browser and the user said *"잘 되네"*, the AI (me) attempted to invoke `gmk-self-test` with `--record` flag and walk the user through a 15–25 minute structured session, three times. The user pushed back: *"내가 괜찮다고 했는데 이걸 또 해야돼? 순서가 이상하잖아"*. The user's two words already constituted a self-test PASS signal — the SKILL's Step 2 template was the wrong granularity for the milestone.

This is partly an AI behavior issue (run-the-script-by-default) and partly a SKILL issue (the template doesn't have a "user already signaled — short-circuit" path).

**Affected SKILL**: `gmk-self-test` Step 2 / `gmk-prototype` "Next" block.

**Change sketch (v0.3)**:
- `gmk-prototype` "Next" block: add an *intuition-check pause* explicitly: *"Open the prototype, click around 30-60s. If you say a one-line verdict ('잘 되네' / '이상해' / 'failed instantly'), I'll log that as the self-test for this milestone unless you ask for the structured session. Otherwise: /gmk-self-test for the longer flow."*
- `gmk-self-test` Step 2: add a `--quick "<verdict>"` flag that takes the user's one-liner, codes it, and writes the session note without the template prompt. Reserves `--record` for ≥10-minute sessions.

**Repro**: dino-run conversation log m1-jump self-test exchange.

**Priority**: Minor. Annoyance, not blocker; user can route around manually.

---

### N9 — Validation output directory is not auto-created

**Symptom**: First m4 `gmk-validate` run completed 50 trials and then crashed at `fs.writeFileSync(...)` with `ENOENT: no such file or directory, open '.gamemaker-kit/validations/m4-collision-and-speed/trial-raw.json'`. The output directory was never created — only m1's was, manually, when I set up the dogfood. 50 minutes of validation wall-time discarded.

**Affected file**: `.gamemaker-kit/.validate-runner.cjs` (or wherever `gmk-validate`'s output directory creation lives in v0.3 SKILL).

**Change sketch (v0.3)**:
- `gmk-validate` Step 6 (write back to disk): `fs.mkdirSync(path.dirname(outputPath), { recursive: true })` before any write. One-line fix; defensive.

**Repro**: dino-run m4 first run, output ended with `ENOENT: no such file or directory, open 'C:\GameMaking\dino-run\.gamemaker-kit\validations\m4-collision-and-speed\trial-raw.json'`.

**Priority**: Minor (clear fix, but wastes user wall time when hit).

---

### N10 — `gmk-roadmap` Step 2 (per-pillar milestone elicitation) is bypassable by AI batch-proposal

**Symptom**: SKILL.md Step 2 instructs *"Walk the user through milestone proposals **one pillar at a time**, in the order pillars appear in `pillars.json`. For each pillar [ask the user]."* The AI (me) shortcut this and proposed all 5 milestones in one batch, which the user accepted with a single "그대로". The structured per-pillar elicitation never happened. SKILL.md has no enforcement against batching.

**Affected SKILL**: `gmk-roadmap` Step 2 / "Notes for the model running this skill".

**Change sketch (v0.3)**:
- Add a "shortcut mode" explicitly: `--all-at-once` flag that documents the bypass and notes which structured prompts were skipped. Default flow forces per-pillar elicitation.
- Or: tighten the "Notes for the model" section to call out batching as a known anti-pattern.

**Repro**: dino-run gmk-roadmap session — user response "다 괜찮아" to a batched 5-milestone proposal.

**Priority**: Minor (low harm here; could matter more on larger projects where the user really does need the per-pillar pacing).

---

### N11 — Linear-chain dependency graphs should trigger a sanity check

**Symptom**: dino-run's roadmap produced a 5-step linear chain (m1 → m2 → m3 → m4 → m5). Every milestone depends on the previous one's PASS. This is allowed (Step 3 only refuses *circular* dependencies) but linear chains are usually a smell — they often indicate the user has decomposed an integrated mechanic into "steps of building one thing" rather than "separable mechanics."

**Affected SKILL**: `gmk-roadmap` Step 3 (priority + dependencies).

**Change sketch (v0.3)**:
- Step 3 post-check: if dependency graph is linear (every milestone except m1 has exactly one parent, every milestone except mN has exactly one child), warn: *"Linear chain detected — m1 → m2 → ... → mN. Linear chains often indicate one mechanic decomposed as build steps rather than separable bets. Worth checking: would killing m3 leave you with m4 as a still-coherent prototype? If not, m3 and m4 may belong together."* Don't refuse; surface and let the user decide.

**Repro**: `dino-run/_workspace/roadmap.md` § Dependencies — 4 entries, all linear: m2→m1, m3→m2, m4→m3, m5→m4.

**Priority**: Minor. Mostly informational; some users will rightly ignore.

---

## Summary table

| # | Title | SKILL / file | Priority |
|---|---|---|---|
| C1 | Bot-row targets authored against bot capability, not design | gmk-prototype Step 3 / gmk-validate Step 4 | **Critical** |
| C2 | Determinism check compares wall-clock fields | _bot_hook_lib.js + gmk-validate runner | **Critical** |
| C3 | gmk-self-test refuses without validation, blocking bot-trivial milestones | gmk-self-test preconditions | **Critical** |
| M4 | 200-run default is wrong magnitude | gmk-validate Step 1 | Major |
| M5 | No bot-tautology check at hypothesis-authoring time | gmk-prototype Step 3 | Major |
| M6 | gmk-roadmap doesn't ask if decomposition is appropriate | gmk-roadmap Step 1 | Major |
| M7 | Anti-examples elicited too early (init time, pre-stable pillars) | gmk-init Step 3 | Major |
| N8 | AI runs full SKILL template even when user already gave verdict | gmk-self-test Step 2 / gmk-prototype "Next" | Minor |
| N9 | Validation output directory not auto-created | gmk-validate Step 6 | Minor |
| N10 | gmk-roadmap per-pillar elicitation bypassable | gmk-roadmap Step 2 | Minor |
| N11 | Linear-chain dependency graphs deserve a sanity check | gmk-roadmap Step 3 | Minor |

---

## What this dogfood did NOT cover (for the next round)

Milestones not built — coverage gaps:
- `m5-game-over` not built → `frictionless-restart` pillar untested by dogfood. `gmk-self-test` on a *frictionless-restart* metric (death → next-attempt < 2s) is the kind of metric where bot + human disagree in interesting ways.
- `/gmk-port` not exercised → Stage 1-6 (Generate → Compile → Smoke → Metric diff → Checklist → Human RE-PASS) entirely untested by dogfood.
- `/gmk-merge-gate`, `/gmk-regression`, `/gmk-mechanic-merge`, `/gmk-portability-check` — all untested.
- 4 domain agents (`systems-designer`, `feel-engineer`, `economy-balancer`, `playtest-analyst`) — none invoked during dogfood.
- `/gmk-art-spec` / `/gmk-art-gen` / `/gmk-sound-plan` / `/gmk-ux-flow` — none invoked.
- `/gmk-brainstorm`, `/gmk-kill-milestone`, `/gmk-task-split`, `/gmk-status`, `/gmk-loop` — none invoked.

Domain coverage from this dogfood: **mechanic-authoring + bot-validation half**. The integration half (port, merge gate, regression) and the team-of-disciplines half (agents) are unaddressed. A v0.3 dogfood should target one of those two halves explicitly.

---

*Dino-run evidence directory: `C:\GameMaking\dino-run\` — prototypes/, .gamemaker-kit/{pillars,milestones,validations,self-tests}/, _workspace/. Not part of the gamemaker-kit repository.*
