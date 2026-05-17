---
name: gmk-port
description: Port a milestone that passed both /gmk-validate (bot) and /gmk-self-test (the user's own playtest) into the main engine project — Godot first, Unity in Phase 2 — and re-validate the port through 5 stages: Generate, Compile, Smoke-run, Metric-diff (HTML 200 vs Engine 200), and human RE-PASS. Translates HTML mechanics to GDScript/C# following the host project's conventions, emits a port-checklist with re-tuning items, and refuses to run without both validation gates. Use when the user says "/gmk-port <name>", "port to godot", "convert to engine", "프로토타입 포팅", or after a milestone is double-validated and ready to leave HTML. Run AFTER /gmk-validate PASS AND /gmk-self-test PASS AND ideally after /gmk-merge-gate.
model: opus
---

# gmk-port — Cross the chasm to the real engine, and re-prove it

Every prior skill protected the user from porting bad ideas. This one is the only step where validated ideas leave the throwaway HTML world and touch the real game project. It's also the only step where validation has to be *re-done* — the HTML PASS verdict doesn't carry into Godot/Unity automatically. Engine frame timing, input pipeline, physics tick, and audio bus all change the answer.

Three reasons this is the most judgment-heavy skill in the kit:

1. **API hallucination is constant.** Godot has ~850 classes; Unity has a package zoo. The right answer is "use this exact node + this exact signal," not a plausible-looking call that doesn't exist. Get this wrong and the user spends an afternoon decoding error messages.
2. **Game feel numbers don't survive translation.** A 0.3s hit-stop in JS is not 0.3s hit-stop in Godot. Naive porting destroys the very thing validation just confirmed.
3. **The host project has its own conventions.** Naming, folder structure, scene composition, signals vs. groups, Resource patterns. Ignoring these makes the port look like vendored junk and the user rewrites it anyway.

Opus because all three need real judgment. Don't downgrade to sonnet to save tokens — the cost of a bad port is the user re-doing it.

The 5-stage re-validation (Stages 2-6 below) is what makes this skill different from "port and pray." The HTML prototype was validated by a bot and the user; the engine port has to clear the same bars.

## Preconditions

1. **Milestone exists** in `.gamemaker-kit/milestones.json`.
2. **Bot validation passed** — `validation.verdict === "PASS"`.
   - If FAIL or INCONCLUSIVE: stop. *"This milestone hasn't passed bot validation. The kit refuses to port — that's the whole reason it exists. Fix and re-validate, or kill the milestone. [Rule 14] /gmk-port → /gmk-validate OR /gmk-kill-milestone — verified target's preconditions can be satisfied from current state."*
3. **Self-test passed** — `self_test.latest_verdict === "PASS"`.
   - If FAIL or INCONCLUSIVE: stop. *"Bot PASS but your own self-test {verdict}. The bot can't catch feel; if you didn't agree it's worth porting, don't port. Replay suspicious runs or re-tune the prototype first. [Rule 14] /gmk-port → /gmk-self-test (replay suspicious seeds) OR /gmk-prototype (re-tune) — verified target's preconditions can be satisfied from current state."*
   - `--force` override is allowed for either gate but stamps `forced: true` in the port record AND prints a 3-line warning before generating any code.
4. **Merge gate ran recently (recommended).** Look for `.gamemaker-kit/merge-gates/<milestone-id>.md` with `verdict: PASS` modified ≤24h ago. If missing or FAIL or stale, warn but allow:
   - *"No recent merge-gate PASS for this milestone. Stages 2-5 still run, but you're porting code that may have shared-file conflicts or pre-existing regressions. /gmk-merge-gate first is recommended."*
5. **Target engine declared** — read `pillars.json` `engine` field (set at `/gmk-init`). If not `godot` or `unity`:
   - For other engines (Love2D, GameMaker Studio, etc.), don't generate code. Generate a port-checklist only. *"Auto-port for {engine} isn't supported in MVP. Outputting a manual port checklist instead — it lists every mechanic, feel parameter, and asset slot you'll need to translate by hand. Stages 2-6 also don't run for unsupported engines."*
6. **Engine project directory exists.** Look for `godot/` with `project.godot`, OR `unity/` with `Assets/`, OR a project root with those at top-level. If none: ask *"Where's the engine project? Either point me at the Godot/Unity project root, or run /gmk-init's engine step to set it up."*
7. **Phase 2 gate for Unity.** If engine is `unity`, MVP behavior:
   - Generate the port-checklist (always).
   - Skip Stage 1 code generation; tell the user *"MVP port skill targets Godot only. Unity code generation lands in Phase 2."*
   - Stages 2-6 still run if the user manually writes the C# (re-invoke with `--re-validate-only` after writing).
8. **Engine CLI on PATH for Stages 2-3.** For Godot: `godot --version` works. For Unity: `Unity -version` works. If missing, Stage 2 prints the install command and stops the re-validation at Stage 1.
9. **Playwright available for Stage 4** (same dep as `/gmk-validate`). Missing Playwright skips Stage 4 with a warning.

_Standard preconditions (milestone-id resolution, empty/partial state, refuse-chain cycle guard, kit_version read contract) follow `gmk-prototype-rules` Rule 13-14, 16._

## Flow

The skill runs **Stage 1 (generate)** then a **6-step re-validation** (Stages 2-6) end-to-end by default. Each stage can be re-run in isolation via `--stage N`. Stage 6 (human RE-PASS) is interactive.

```
Stage 1 — Generate          (this skill; calls `systems-designer` agent for the engine-side plan when system spec is non-trivial)
Stage 2 — Compile           (engine CLI; 1 retry)
Stage 3 — Smoke-run         (engine bot; 5 runs; 1 retry)
Stage 4 — Metric diff       (HTML 200 runs vs Engine 200 runs; routes to `playtest-analyst` on outside-threshold diff)
Stage 5 — (port checklist)  (always written; not a verdict)
Stage 6 — Human RE-PASS     (user plays the engine port; routes to `feel-engineer` / `economy-balancer` on NEEDS_TUNING)
```

---

### Stage 1 — Generate

Three sub-steps. Don't skip the conventions read.

#### 1a — Read everything load-bearing

Read in order:

1. `.gamemaker-kit/milestones.json` → milestone entry (hypothesis, validation metrics, self_test themes, pillar bindings).
2. `prototypes/<name>.html` → the actual code being ported. Parse:
   - Game state shape (variables, constants).
   - Action handlers (what happens on each `act()` case).
   - Render code (what gets drawn, when, in response to what).
   - Animation/feel timings (hit-stop durations, particle counts, easing curves).
   - The `__gmk_botHook__` block — discardable in the port; was scaffolding.
3. `.gamemaker-kit/pillars.json` → pillar IDs and anti-examples (used for Stage 5 checklist).
4. **Host project conventions:**
   - **Godot:** look for existing `scripts/`, `scenes/`, `resources/` layout. Read 2-3 existing `.gd` files to learn naming (snake_case vs CamelCase for resources), signal style (`signal foo_happened` connected explicitly vs. autoloaded bus), node tree depth preferences. If `_workspace/conventions.md` exists, read it.
   - **Unity:** look for existing `Assets/Scripts/`, `Assets/Scenes/`. Read 2-3 existing `.cs` files for naming, MonoBehaviour patterns, ScriptableObject usage.
   - If the project is empty, use engine defaults: Godot 4.x → snake_case files/signals, PascalCase scenes/class names; Unity 6 → PascalCase for class names + methods, camelCase for fields.

Do NOT skip the conventions step. Generated code that ignores existing conventions is worse than asking.

#### 1a.5 — Invoke `systems-designer` for the engine-side structural plan

The `systems-designer` agent's second entry point (per its SKILL.md) is `/gmk-port` Stage 1 — produce the engine-side structural plan before code generation. Routing rule:

| Condition | Action |
|---|---|
| `_workspace/milestones/<id>/system-spec.md` exists | Read it; use it as the input to step 1b's plan. Don't re-invoke the agent. |
| Spec missing AND mechanic is non-trivial (≥ 3 systems in `design-system.md`, OR any state machine with ≥ 4 states, OR ≥ 3 coupling lines) | Invoke `@systems-designer <id>` and **wait for its output** before proceeding to 1b. Print: *"Invoking systems-designer for engine-side plan — non-trivial system needs strict spec before code. Once it writes `system-spec.md`, re-run `/gmk-port <id>` to continue. [Rule 14] /gmk-port → /gmk-port (re-entry after @systems-designer writes system-spec.md) — verified target's preconditions can be satisfied from current state."* Stop. |
| Spec missing AND mechanic is trivial (single state machine, ≤ 2 couplings) | Skip — proceed to step 1b. The HTML prototype + `design-system.md` (if present) is enough context. |
| User explicitly passes `--no-systems-designer` | Skip — proceed straight to 1b. The user owns the choice. |

This is the **only** stage where this skill blocks on an agent. The block is intentional: porting non-trivial systems without an engine-side spec is exactly when API-hallucinated code wastes the most time. The agent's `system-spec.md` (which it writes to `_workspace/milestones/<id>/system-spec.md`) gives this skill a strict structural target before any GDScript / C# is generated.

#### 1b — Plan the port (don't write code yet)

Output a plain-language plan and **wait for user confirmation** before generating any code:

```
Port plan for m1-merge-feel → godot/

  Mechanic: tile-grid merge with hit-stop + screen shake + particles on merge.

  Files I'll create:
    godot/scripts/merge/merge_grid.gd       — board state, merge logic
    godot/scripts/merge/tile.gd             — single tile node script
    godot/scenes/merge/merge_grid.tscn      — root scene with grid layout
    godot/scenes/merge/tile.tscn            — tile prefab w/ Sprite2D + AnimationPlayer

  Files I'll modify:
    godot/project.godot                     — register input action 'tile_drag' if missing
    godot/autoload/event_bus.gd             — add signal 'tile_merged' if you use a bus
                                              (will skip if you don't)

  Engine systems used:
    Node2D + Tween (for hit-stop & shake)
    GPUParticles2D (for the burst)
    InputEventScreenDrag / InputEventMouseMotion (for drag)

  Things I will NOT auto-translate (port-checklist will list them):
    1. Hit-stop duration (0.3s in JS)  — Godot's frame timing is different; re-tune by feel.
    2. Screen shake amplitude/decay    — viewport size/DPI changes the perception.
    3. Particle visuals                — JS used filled circles; Godot will need a real texture.
    4. Sound (none in HTML prototype)  — pillar 'tactile-satisfaction' is half-broken without it.
    5. Difficulty curve, score scaling — needs re-tuning against actual target devices.

  Coupling to existing project:
    - Found existing scene 'godot/scenes/main.tscn'. Will NOT auto-add the merge_grid
      scene to it; you decide where it lives.
    - Found existing 'event_bus.gd' with signals — will register 'tile_merged' there
      following the same naming pattern.

  Re-validation plan after generate:
    Stage 2 Compile     — godot --headless --check-only
    Stage 3 Smoke       — 5 runs via engine bot hook (Godot autoload, no UI render)
    Stage 4 Metric diff — HTML 200 runs vs Engine 200 runs, clear_rate / dominant_strategy
                          / action_entropy compared
    Stage 5 Checklist   — port-checklists/m1-merge-feel.md
    Stage 6 You RE-PASS — open Godot, play it, type your verdict back to me

Proceed?
```

If the user says no or wants changes, iterate. Don't generate code under a wrong plan.

#### 1c — Generate the code

Once the plan is confirmed, write the files. Rules:

**General:**

- **Idiomatic to the engine, not the prototype.** A prototype's `for` loops over flat arrays might want to become signals + groups in Godot. A monolithic state object might split into a `Resource`-backed `GameState`. Use engine primitives.
- **Don't transcribe magic numbers.** When the HTML has `const HITSTOP = 300` (ms), don't translate to `const HITSTOP = 0.3` and call it done. Mark it `# TUNE: hit-stop duration — re-feel after first run` and put it in the checklist. The number is a placeholder until human re-tuning.
- **Comments at the top of each generated file:**
  ```gdscript
  # Ported from gamemaker-kit milestone m1-merge-feel
  # Validated: bot PASS (200 runs), self-test PASS (user verdict 2026-05-09)
  # Pillars targeted: tactile-satisfaction
  # See port-checklists/m1-merge-feel.md for re-tuning items.
  ```
  This is the only multi-line comment block the kit allows. Future-you reads this when finding the file in 6 months.
- **No `__gmk_botHook__` block, but DO emit an engine-side bot hook** — see Stage 3 below. The HTML hook was JS; the engine hook is a small autoload (Godot) or static class (Unity) that exposes `state_signature()` / `legal_actions()` / `apply(action)` for headless smoke runs.
- **Determinism.** The HTML prototype was deterministically seeded for the bot. Production game probably wants `randomize()` on game start. Default to `randomize()` but leave a comment `# DEV: replace with seeded RandomNumberGenerator if you want deterministic playthroughs`. The engine bot hook injects a seed at Stage 3.

**HTML → Godot translation map:**

| HTML/JS pattern | Godot 4.x idiom |
|---|---|
| `<canvas>` 2D draw via `ctx.fillRect` | `Node2D` with `_draw()` override, OR `Sprite2D` per visual element if mostly textures |
| `setInterval(loop, 16)` game loop | `_process(delta)` on a Node |
| `setTimeout(fn, 300)` for feel | `await get_tree().create_timer(0.3).timeout` OR `Tween` |
| Manual collision check between rects | `Area2D` + `CollisionShape2D` + signal connections |
| `addEventListener('pointerdown')` | `_input(event)` or `_unhandled_input(event)` checking `InputEventMouseButton`/`InputEventScreenTouch` |
| Drag with `pointermove` | `InputEventMouseMotion` / `InputEventScreenDrag` |
| Inline `<style>` CSS animations | `AnimationPlayer` track OR `Tween` for one-off |
| `localStorage.setItem` | `ResourceSaver.save()` to `user://savegame.tres` |
| Vanilla `class` for game state | `class_name GameState extends Resource` |
| Particle burst (manual loop drawing dots) | `GPUParticles2D` with a one-shot emitter |
| Screen shake (translate canvas) | `Camera2D` + `Tween` on `offset` |
| Audio (HTMLAudioElement, WebAudio) | `AudioStreamPlayer` or `AudioStreamPlayer2D` |
| Game loop step counter | `_process(delta)` accumulator OR `Timer` node |

When the prototype uses something not in this table: pick the simplest Godot equivalent and document the choice as a comment. Don't reach for plugins.

**Action interface translation:**

The prototype's `legalActions()` / `act(action)` API was for the bot. In production code:

- For input-driven mechanics: real input events (`_input`, `_unhandled_input`).
- For state-machine / turn-based: a state machine on the relevant Node, with methods named after the action types.

Don't preserve the `legalActions/act` shape in production code — it's a test harness, not a game architecture. But **do** emit a parallel hook for Stage 3 (see below).

**Engine-side bot hook (for Stage 3 smoke + Stage 4 metric diff):**

In addition to the production code, generate a `bot_hook.gd` autoload (Godot) or `BotHook.cs` static class (Unity) that exposes the same surface as `__gmk_botHook__`:

```gdscript
# godot/autoload/_gmk_bot_hook.gd — DO NOT modify; regenerated by /gmk-port
extends Node

const _gmk_api_version: int = 1

func reset(seed: int) -> void:
    # Set up the mechanic deterministically. Call into MergeGrid.reset_with_seed(seed).
    ...

func legal_actions() -> Array:
    ...

func apply(action) -> void:
    ...

func is_terminal() -> bool:
    ...

func state_signature() -> String:
    # Optional. Return null-string if not implemented.
    return ""

# (Other optional callbacks: risk_estimate, progress_estimate, novelty_score)
```

The engine bot hook is **a separate file** from the production code. The user's normal game flow doesn't touch it; only Stages 3-4 do.

**Pillar-aware code comments:**

For each major function/scene that strengthens a specific pillar, add ONE comment line:

```gdscript
func _on_merge() -> void:
    # Pillar: tactile-satisfaction — hit-stop + shake + particles. Re-tune by feel.
    _hit_stop()
    _camera_shake()
    _spawn_burst_particles()
```

This makes the pillar binding survive into the codebase.

---

### Stage 2 — Compile

Run the engine's headless compile check.

**Godot:**

```bash
godot --headless --path godot/ --check-only
```

Exit code 0 = pass. Non-zero or stderr contains "Parser Error" / "Failed to load" → FAIL.

**Unity:**

```bash
Unity -batchmode -projectPath unity/ -quit -logFile -
```

Parse log for compile errors. Exit code 0 + no "error CS" lines = pass.

**Retry policy:** on first failure, re-read the failure output, attempt one targeted fix to the generated files (typo, missing import, wrong API name), then re-run. **One retry, that's it.** If still failing, stop Stages 3-4 and print:

```
Stage 2 (Compile) — FAIL after 1 retry.
  Last error:
    res://scripts/merge/merge_grid.gd:42 — Function "tween_property" not found in base "Tween".

  Likely cause: Godot 4 renamed `Tween.tween_property` parameters between 4.0 and 4.3.
  This isn't auto-fixable from the prototype alone. Hand-fix the generated file
  (or the translation map in this skill's source if this is a systemic miss),
  then re-run /gmk-port --stage 2 to resume from here.

Stages 3-5 skipped. Stage 6 (you RE-PASS) is still available — but probably
moot until the code compiles.
```

Don't auto-revert generated files. The user's hand-fix is the floor; treat it as authoritative.

---

### Stage 3 — Smoke-run

Boot the engine in headless mode and run **5 trials** of the engine bot hook. Each trial: reset(seed=i), step through `legal_actions` / `apply` with the same persona-mix sampler `/gmk-validate` uses, until `is_terminal()` or a step cap (1000).

**Godot:**

```bash
godot --headless --path godot/ --script res://_gmk_smoke.gd -- --runs 5 --seeds 1,2,3,4,5
```

The skill writes `godot/_gmk_smoke.gd` once (a temporary entry point that calls into `_gmk_bot_hook`). Keep it small; don't depend on it long-term.

**Crash detection:**

- Any non-zero exit: crash.
- Any step throws an exception: counts as crash for that trial.
- Hard timeout (60s per trial): kill, count as stuck.

**Retry policy:** on first crash (any trial), re-run the entire 5 once. If second pass also crashes, FAIL Stage 3:

```
Stage 3 (Smoke) — FAIL after 1 retry.
  Trial results (retry pass):
    seed=1   PASS, 124 steps, terminal
    seed=2   CRASH at step 47 — NullReferenceException in _on_merge (tile.tscn)
    seed=3   PASS, 89 steps, terminal
    seed=4   PASS, 132 steps, terminal
    seed=5   STUCK at step 1000 — no terminal reached

  The crash on seed=2 looks like a missing-null-check in the merge handler.
  The stuck on seed=5 may be a soft lock; check legal_actions() returns at least
  one action even in edge states.

Stage 4 (metric diff) skipped — meaningful comparison needs all 5 trials clean.
Stage 5 (checklist) still written. Stage 6 (you RE-PASS) is still available
but probably premature; fix the crash first.
```

If all 5 pass on first or second try, Stage 3 PASS.

---

### Stage 4 — Metric diff

The expensive check. Run **HTML 200 runs** and **Engine 200 runs** with matching persona-mix configs, then compare three load-bearing metrics:

| Metric | Why it matters | Threshold |
|---|---|---|
| `clear_rate` | Did the bot finish the mechanic the same fraction of the time? | ±10 pp drift → ⚠ flag, ±25 pp → FAIL |
| `dominant_strategy_ratio` | Did the engine port accidentally introduce or remove an exploit? | ±15 pp drift → ⚠ flag, ±30 pp → FAIL |
| `action_entropy` | Is the bot doing roughly the same variety of things? | ±25% relative → ⚠ flag, ±50% → FAIL |

(Thresholds are the same as `/gmk-regression`'s drift thresholds for clear_rate, looser for the others because engine input/timing differences can move them more without breaking the mechanic.)

**Procedure:**

1. Re-run HTML 200 via `/gmk-validate`'s runner against `prototypes/<name>.html` (read fresh, not cached — feel timings may have edited since baseline).
2. Run Engine 200 by booting the engine 200 times, each time invoking the bot hook with the persona-mix index 0..199. (For Godot: 200 `godot --headless --script _gmk_metric.gd -- --seed N` calls, in a sequential loop — Chromium-level parallelism isn't safe here.)
3. Aggregate into the same `aggregated.json` shape as `/gmk-validate`, but tagged `source: html` and `source: engine`.
4. Compute deltas per metric. Apply thresholds.

**Wall time:** roughly 2× a `/gmk-validate` run plus engine startup overhead. Tell the user upfront (~10-30 min for typical prototypes). Allow `--metric-runs 50` for a quick check (looser thresholds because of smaller N).

**Result:**

```
Stage 4 (Metric diff) — FLAG (1 metric drifted past warning threshold)

  Metric                       HTML         Engine       Delta       Status
  ----------------------------------------------------------------------------
  clear_rate                   67%          61%          -6 pp        OK (<10pp)
  dominant_strategy_ratio      31%          48%          +17 pp       FLAG (>15pp)
  action_entropy               4.2 bits     4.0 bits     -5%          OK (<25%)

  The dominant_strategy drift suggests the engine port introduced (or made
  easier) a path the bot now favors. Common causes:
    - Input timing differs — a feature was hard to trigger in HTML, easy in engine
    - State machine ordering — Godot's _process call order surfaced a frame-1 exploit
    - Tween/easing made a previously-hard action reliable

  Stage 4 verdict: FLAG (not FAIL). User judgment from Stage 6 settles whether
  the drift is acceptable.
```

The FLAG vs FAIL distinction matters: FAIL means the mechanic isn't recognizably the same; FLAG means it's drifted but might still be fine — your eyes (Stage 6) decide.

#### Stage 4 routing — `playtest-analyst` on FLAG / FAIL

When Stage 4 produces **FLAG** or **FAIL**, surface a `playtest-analyst` route in the report. Per the analyst's own entry-point spec, `/gmk-port` Stage 4 metric diff outside thresholds is a canonical trigger:

| Stage 4 verdict | Recommend | Why |
|---|---|---|
| FAIL (mechanic drifted past hard threshold on any metric) | `@playtest-analyst <id>` | The mechanic is no longer recognizably the same — analyst diagnoses which metric pattern (state starvation, dominant strategy, persona-specific) and routes to the right fix agent. |
| FLAG (1 metric in warning band) | `@playtest-analyst <id>` (optional, recommended before Stage 6) | Get a focused diagnosis of *which* metric drifted and *why* before the user spends 15 minutes playing. Sharpens what to watch for in Stage 6. |
| PASS (all metrics within thresholds) | (none) | Proceed to Stage 5. |

The route is a recommendation; the user invokes `@playtest-analyst <id>` themselves. The analyst's preconditions (validation result, structured hypothesis) are already satisfied; it will read both the HTML baseline and the engine trial and produce one diagnosis doc.

_The routing output follows `gmk-prototype-rules` Rule 15 (agent routing block format)._

---

### Stage 5 — Port checklist

Always written. Path: `.gamemaker-kit/port-checklists/<name>.md`. (Earlier kit versions used `port-checklists/<name>-port.md` — the new path is the simpler one. If the older file exists, leave it; write the new one.)

Template:

```markdown
# Port checklist: m1-merge-feel → godot

Generated 2026-05-12. Source: prototypes/m1-merge-feel.html.
Validation: bot PASS (200 runs), self-test PASS (2026-05-09).
Re-validation so far: Stage 2 PASS, Stage 3 PASS, Stage 4 FLAG (1 metric drifted).

## Stage 6 — what YOU re-verify by playing

This is the human RE-PASS. Open Godot, run merge_grid.tscn (F6), play for 5 minutes.

- [ ] **Feel parity**: does the Godot version feel like the HTML version, or different?
      The pillar 'tactile-satisfaction' depends on this. If it feels weightless / silent
      / instant — that's the anti-example, and the port half-failed.
- [ ] **Metric-drift gut-check**: Stage 4 flagged dominant_strategy_ratio +17pp.
      Try to play *against* the strategy the bot favored. If it's now trivially exploitable,
      that's why it drifted; tune before declaring PASS.
- [ ] **Anti-example check (last)**: pillar 'tactile-satisfaction' anti-example:
      "Merging two dragons feels like clicking a button on a spreadsheet — silent,
      instant, weightless." Play the Godot port. Does it match? If yes, re-tune
      timings and audio before considering this milestone done.

After playing, run `/gmk-port <id> --stage 6 --verdict RE_PASS|RE_FAIL|NEEDS_TUNING` to record.

## DO NOT auto-translate — these need human re-tuning

### Game feel timings
- [ ] Hit-stop duration. JS prototype used 300ms. Godot version uses placeholder 0.3s — re-feel.
      Test with `Engine.time_scale = 0` for true freeze, vs. `0.05` for slow-mo.
- [ ] Screen shake amplitude. JS used canvas translate ±4px. Godot's Camera2D offset is in
      world units; tune against actual viewport size.
- [ ] Tween easing curves. JS used `cubic-bezier`. Godot Tweens default to linear; pick
      `Tween.TRANS_BACK / EASE_OUT` for chunky-feel decay, then re-feel.

### Physics
- [ ] (List physics-affecting mechanics here. For pure grid games, write "none".)

### Audio
- [ ] HTML prototype had no audio. Pillar 'tactile-satisfaction' is incomplete without sound.
      Suggested: 1 short chunky merge SFX (~150ms), 1 ambient bed loop, 1 fail/clear sound.

### Art
- [ ] HTML prototype used canvas-drawn shapes. Replace with sprites/textures per your
      visual direction. Don't ship placeholders to testers in v2 — they'll respond to
      art, not mechanic, and pollute your next feedback round.

## Integration with existing project

- [ ] Decide where `merge_grid.tscn` is instanced. The port did NOT auto-attach it to
      `main.tscn`. Likely candidates: a level select, a debug menu, or main directly.
- [ ] If using `event_bus.gd` autoload: confirm `tile_merged` signal is registered there.
- [ ] Naming: ported files use snake_case to match existing project. Verify your team's
      convention if working with collaborators.

## What the bot validated (Stages 3-4 confirmed mostly intact)

- [x] Bot reached terminal in 5/5 smoke trials (Stage 3 PASS).
- [x] clear_rate: 67% (HTML) vs 61% (Engine) — within threshold.
- [ ] dominant_strategy_ratio drifted +17pp. **Investigate during Stage 6.**
```

---

### Stage 6 — Human RE-PASS (interactive)

Two modes:

**Default**: the skill prints what to do, then halts.

```
Port complete for m1-merge-feel.

  Re-validation summary:
    Stage 2 Compile      PASS
    Stage 3 Smoke (5)    PASS
    Stage 4 Metric diff  FLAG (dominant_strategy_ratio +17pp)
    Stage 5 Checklist    written → port-checklists/m1-merge-feel.md

  Stage 6 is on you. Open Godot:
    cd godot/
    godot --editor

  Play merge_grid.tscn (F6) for ~5 minutes. Walk the checklist's
  "Stage 6" section. Then come back and run:

    /gmk-port m1-merge-feel --stage 6 --verdict RE_PASS
    /gmk-port m1-merge-feel --stage 6 --verdict RE_FAIL --reason "feel lost in port"
    /gmk-port m1-merge-feel --stage 6 --verdict NEEDS_TUNING --reason "hit-stop needs +20ms"

  The kit doesn't pretend to know which one fits. You play; you call it.
```

**With `--verdict`**: directly record the verdict and exit.

```
Recorded m1-merge-feel Stage 6 — RE_PASS at 2026-05-12T23:55Z.

milestones.json updated:
  ported_to.re_validation.verdict = RE_PASS
  ported_to.re_validation.tuned_at = (unset — RE_PASS implies no further tuning needed)

If RE_PASS: the port is considered double-validated. Move on.
            If this was the last in-flight milestone, run /gmk-dev-complete
            to check whether the project has reached gmk's project-level
            release-readiness checkpoint (all milestones shipped + every pillar covered).
If RE_FAIL: this port is broken. Either /gmk-port --force-rebuild (re-runs Stage 1)
            or hand-edit the generated files and re-run --stage 4 to re-measure.
If NEEDS_TUNING: the port is conceptually right but needs feel work. The checklist
                 is your map. When done tuning, re-run --stage 6 --verdict RE_PASS.

                 Tuning route (recommended):
                   - If your --reason mentions sensation words (hit-stop, shake,
                     particle, easing, lerp, juicy, weak, 둔탁):
                       @feel-engineer <id> — agent re-runs feel pass against the
                       engine port, producing feel-numbers.md + feel-edits.md you
                       apply to the engine code.
                   - If your --reason mentions balance words (dominant, too easy,
                     too hard, drop rate, XP, curve, pacing):
                       @economy-balancer <id> — agent re-balances against the
                       engine port's measured metrics.
                   - If both, route feel-engineer first then economy-balancer.
```

#### Stage 6 routing — `feel-engineer` / `economy-balancer` on NEEDS_TUNING

NEEDS_TUNING is the canonical "the port works structurally but needs domain-agent work" verdict. Apply routing automatically when recording the verdict:

| `--reason` content | Recommended agent | Why |
|---|---|---|
| Sensation words: hit-stop, shake, particle, easing, lerp, juicy, weak, limp, 둔탁, 미적지근, 휙 | `feel-engineer` | Agent's catalog of feel parameters maps directly. Engine-side tuning is its Stage 6 entry point per its own SKILL.md. |
| Balance words: dominant strategy, too easy, too hard, drop rate, XP, curve, pacing, cap, tier | `economy-balancer` | Agent re-balances the engine port using engine-side measured metrics. |
| Structural words: state, transition, invariant, missing, broken | `systems-designer` (then `--force-rebuild` Stage 1) | The port has structural drift — usually means the engine-side spec was incomplete. |
| Unclear / mixed | `playtest-analyst` (read engine smoke + Stage 4 logs, diagnose, route) | Same as Stage 4 FLAG/FAIL routing. |

Print the route in the verdict-recorded message. Do not auto-invoke.

---

### Stage 5 (continued) — Update milestone record

Write the complete `ported_to` block to `milestones.json`:

```json
{
  "id": "m1-merge-feel",
  "ported_to": {
    "ported_at": "2026-05-12T23:30:00Z",
    "engine": "godot",
    "files_created": [
      "godot/scripts/merge/merge_grid.gd",
      "godot/scripts/merge/tile.gd",
      "godot/scenes/merge/merge_grid.tscn",
      "godot/scenes/merge/tile.tscn",
      "godot/autoload/_gmk_bot_hook.gd",
      "godot/_gmk_smoke.gd"
    ],
    "files_modified": ["godot/project.godot"],
    "checklist": ".gamemaker-kit/port-checklists/m1-merge-feel.md",
    "forced": false,
    "re_validation": {
      "compile_ok": true,
      "smoke_run_ok": true,
      "smoke_trials": 5,
      "smoke_retried": false,
      "metric_diff": {
        "html_metrics": { "clear_rate": 0.67, "dominant_strategy_ratio": 0.31, "action_entropy": 4.2 },
        "engine_metrics": { "clear_rate": 0.61, "dominant_strategy_ratio": 0.48, "action_entropy": 4.0 },
        "delta": { "clear_rate": -0.06, "dominant_strategy_ratio": +0.17, "action_entropy": -0.05 },
        "warnings": ["dominant_strategy_ratio drifted +17pp (> 15pp threshold)"]
      },
      "verdict": "RE_PASS",
      "verdict_reason": "feel parity OK; the drifted strategy is exploitable but doesn't break the mechanic.",
      "tuned_at": null
    }
  }
}
```

`re_validation.verdict` reflects Stage 6's user input. Until Stage 6 runs, the field is `null`. The port isn't considered done until `verdict in {RE_PASS}`.

---

### Final summary print

After all stages run (whether interactive or not):

```
m1-merge-feel — PORTED to godot/

  Files created (6):
    godot/scripts/merge/merge_grid.gd
    godot/scripts/merge/tile.gd
    godot/scenes/merge/merge_grid.tscn
    godot/scenes/merge/tile.tscn
    godot/autoload/_gmk_bot_hook.gd     — DO NOT modify (regenerated)
    godot/_gmk_smoke.gd                  — temp; safe to delete after Stage 6 done

  Files modified (1):
    godot/project.godot   — registered input action 'tile_drag'

  Re-validation:
    Stage 2 Compile       PASS
    Stage 3 Smoke         PASS (5/5 trials)
    Stage 4 Metric diff   FLAG (dominant_strategy_ratio +17pp)
    Stage 5 Checklist     written
    Stage 6 You RE-PASS   pending — see above

  Port checklist: .gamemaker-kit/port-checklists/m1-merge-feel.md

The HTML prototype at prototypes/m1-merge-feel.html stays put — it's the
reference for "what the validated version felt like." Don't delete it.
```

## Edge cases & policy

### Re-porting a milestone

User edits the HTML prototype, re-validates, re-self-tests (all PASS again), re-ports. The skill:

1. Detects existing `ported_to` entry.
2. Diffs the previously generated files against current generation.
3. Shows the user *which files would change* before overwriting.
4. **Never silently overwrites user edits** to the ported files. If the user has touched a generated file (detect via git status or content hash), warn loudly: *"You've edited godot/scripts/merge/merge_grid.gd since the last port. Re-porting will OVERWRITE your edits. Options: (a) commit your edits and re-port, (b) skip re-porting that file and only update the others, (c) abort."*
5. Re-runs Stages 2-6 from scratch. Prior `re_validation` is **overwritten** with the new result. (v0.4 deprecation: `re_validation_history[]` is no longer written — see `structure.md` § v0.4 deprecated fields. The git commit history of milestones.json is the authoritative trace for re-port cycles.)

### Multiple milestones porting to the same engine project

Allowed. The model should be aware that prior milestones may have created `merge_grid.gd`; if porting a new milestone that also wants to write `merge_grid.gd`, **don't collide** — name the new one after the new milestone (`merge_grid_v2.gd` or `merge_grid_chained.gd`) and tell the user. Asset-conflict detection is `/gmk-merge-gate`'s job; this skill just doesn't overwrite without naming.

### Prototype using web-only APIs

If the prototype used Web Speech, WebGL shaders, WebSockets, etc., flag in the plan: *"Prototype uses {API} which has no direct Godot equivalent. Options: (a) skip this feature in port and replace with placeholder, (b) write a Godot-native equivalent (more work — out of MVP port scope), (c) defer milestone until Godot has the capability."* Wait for user choice.

### Engine project has its own conventions file

If the project has `_workspace/conventions.md` or a CLAUDE.md, read it before generating code. Conventions there override the defaults in this skill.

### Unity port (Phase 2 placeholder)

Generate the checklist; print: *"MVP doesn't auto-generate C#. Here's the checklist; the implementation is your hour. Once you write it, /gmk-port <id> --stage 2 will run Stages 2-6 against it."* Don't apologize repeatedly.

### Stage 4 wall-time bites

Allow `--skip-stage-4` if the user explicitly says so. The Stage 5 checklist notes the skip; Stage 6's verdict still applies. The kit's contract is "the bot validated the prototype; you validate the port" — Stage 4 is the bot's port-side check, and skipping it means you're trusting your eyes alone. Allowed but flagged in the milestone record (`re_validation.metric_diff = null, skipped_stages: ["4"]`).

### Failed / killed milestones

The skill refuses to port FAIL/INCONCLUSIVE milestones unless `--force`. If forced, stamps `forced: true` and includes a reason field:

```json
"ported_to": { "forced": true, "force_reason": "User overrode FAIL — wants to keep the rough shape and rebuild" }
```

### Sub-flags

Complete flag catalog. Any `--<flag>` referenced elsewhere in this file that is not in this table is a documentation bug.

| Flag | Default | Effect | Side-effect |
|---|---|---|---|
| `--stage N` | (full run) | Re-runs a single stage. Reads existing artifacts from prior stages. `--stage 1` regenerates the engine code spec; `--stage 2` re-runs compile; `--stage 3` re-runs smoke (5 trials); `--stage 4` re-runs metric diff (200×2); `--stage 5` regenerates checklist; `--stage 6 --verdict X` records Stage 6 verdict. The skill validates that prior stages are recorded as PASS (or FLAG) before allowing later stages. | `ported_to.re_validation.<stage>` updated. |
| `--force-rebuild` | — | **Alias for `--stage 1`.** Regenerates the engine code spec from the HTML prototype. Does *not* delete existing hand-edits in the engine project — the user merges manually. The alias exists because the failure-recovery path in Stage 6 verdict output suggests this name; both invocations do the same thing. | Same as `--stage 1`. |
| `--verdict X` | — | Used only with `--stage 6`. `X` ∈ `RE_PASS` / `RE_FAIL` / `NEEDS_TUNING`. | Writes `re_validation.verdict`. |
| `--reason "<text>"` | — | Required with `--stage 6 --verdict RE_FAIL` or `NEEDS_TUNING`. Free text. | Writes `re_validation.verdict_reason`. |
| `--skip-stage-4` | `off` | Allows the user to bypass Stage 4 (metric diff). The Stage 5 checklist notes the skip; Stage 6's verdict still applies. Trusting eyes alone. | `re_validation.metric_diff = null`, `skipped_stages: ["4"]`. |
| `--re-validate-only` | — | Skips Stage 1 (generate) and starts at Stage 2 (compile). Used when the user manually wrote the engine code (e.g., for engines other than Godot/Unity where auto-port is unsupported). | None — same writes as a normal run starting at Stage 2. |
| `--force` | — | Override for the input gates (validation must be PASS, self-test must be PASS). Stamps `forced: true` on the port record + prints a 3-line warning before generating any code. Forced ports cannot regain `forced: false` later. | `ported_to.forced = true`, `ported_to.forced_reason` from prompt. |
| `--to <engine>` | (auto-detect) | Engine target — `godot` / `unity` / `other`. Default reads the project's host engine config; this flag is for milestones being ported to a different engine than the project default. For `other`, only the checklist runs (no code generation). | `ported_to.engine`. |
| `--no-systems-designer` | — | Skips the optional `@systems-designer` consultation at Stage 1a even when the heuristics (complex system, ≥4 systems, ≥5 named states) would otherwise recommend it. Use when the user has already written the system spec by hand or accepts the simpler routing. | None. |

`--force-rebuild` is *not* a separate behavior — it is exactly `--stage 1` under a more memorable name. Engine hand-edits made after the previous Stage 1 are *not* deleted by either invocation; the user is responsible for resolving any drift between the regenerated spec and the engine project.

### Determinism mismatch between HTML and Engine bot hooks

If Stage 4 metric diff produces wildly different results (e.g., HTML clear_rate 0.67 vs Engine clear_rate 0.04), suspect a determinism break first, not a mechanic break. Surface: *"Engine clear_rate is implausibly low. Likely cause: engine bot hook isn't seeded properly, OR `apply()` reads from `randf()` / time-based input. Check `_gmk_bot_hook.gd` and the production code's RNG; align before trusting Stage 4."*

## What this skill does NOT do

- **Doesn't auto-commit to git.** The user reviews and commits. Auto-commits hide what changed.
- **Doesn't refactor existing project code.** Only adds new files (and registers signals/inputs in existing autoloads when the user confirmed in Stage 1b).
- **Doesn't generate art assets.** Placeholder shapes/textures only. `/gmk-art-gen` is a separate skill if the user wants generated art.
- **Doesn't generate audio.** Same — placeholder silence; `/gmk-sound-plan` for the spec.
- **Doesn't write production game tests.** GameTest / GUT setup is out of scope. The Stage 3 smoke is throwaway scaffolding, not unit tests.
- **Doesn't suppress Stage 6.** The interactive RE-PASS is the whole reason this skill is opus and not sonnet. Eyes-on is non-negotiable.

## Notes for the model running this skill

- **API hallucination is the #1 way to lose the user's afternoon.** When in doubt about a Godot 4.x API, prefer well-known paths: `Node2D`, `Tween`, `AnimationPlayer`, `AudioStreamPlayer`, `Area2D`, `CollisionShape2D`, `GPUParticles2D`. If you're tempted to use something exotic, stop and ask: is this in Godot 4.x specifically? Was it renamed from 3.x?
- **Read existing project files before generating.** The user's existing code is your style guide. Mimic it.
- **Game feel is sacred.** Every translated timing/easing/value gets a `# TUNE` comment AND a checklist entry.
- **Pillar comments survive into prod.** The one-line `# Pillar: <id> — <intent>` comment per critical function is the breadcrumb trail back. Don't strip them in "cleanup."
- **The checklist is the most under-valued deliverable.** Treat it with the same care as the code.
- **One milestone, one port.** Don't try to "while we're here, also port m2." The skill ports one milestone at a time.
- **`--force` is the user's call to override, not yours to recommend.** Don't suggest forcing through a FAIL gate. The kit's discipline is the value prop.
- **Stages 2-6 are the kit's only re-validation surface.** Take them seriously — the FLAG vs PASS distinction in Stage 4, the retry policies in Stages 2-3, and the verdict capture in Stage 6 all exist to make "ported and works" mean something beyond "ported and compiles."
- **When the prototype is small and the host project is empty**, a port can be 60 lines. Resist the urge to add menus, settings, save systems. Ports preserve mechanic; they don't expand scope.
- **The Stage 4 thresholds are calibrated for grid/continuous shapes**, the kit's bread and butter. Dialogue shape metrics are different (clear_rate becomes branches_visited; entropy is replaced by branch_distribution). Shader shape Stage 4 is partial in v0.2 — surface the limitation in the report and let Stage 6 do more of the work for shader ports.
