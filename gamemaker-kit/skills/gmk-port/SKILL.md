---
name: gmk-port
description: Port a double-validated HTML prototype (bot PASS + human PASS) into the user's main engine project — Godot first (MVP), Unity in Phase 2. Translates mechanics to GDScript/C#, integrates into the existing project structure following its conventions, and emits a port-checklist.md listing things that don't auto-translate and need human re-tuning (game feel numbers, physics, audio, art). Refuses to run unless both validation gates passed. Use when the user says "/gmk-port <name>", "port to godot", "convert to engine", "프로토타입 포팅", or wants the validated mechanic to live in the real engine. Run AFTER both /gmk-validate and /gmk-feedback have passed.
model: opus
---

# gmk-port — Cross the chasm to the real engine

The previous five skills protected the user from porting bad ideas. This one is the only step where validated ideas leave the throwaway HTML world and touch the real game project.

It's the most judgment-heavy step in the kit. Three reasons:

1. **API hallucination is constant.** Godot has ~850 classes; Unity has a package zoo. The right answer is "use this exact node + this exact signal," not a plausible-looking call that doesn't exist. Get this wrong and the user spends an afternoon decoding error messages.
2. **Game feel numbers don't survive translation.** A 0.3s hit-stop in JS is not 0.3s hit-stop in Godot. Frame timing, input pipeline, and physics tick differ. Naive porting destroys the very thing validation just confirmed worked.
3. **The host project has its own conventions.** Naming, folder structure, scene composition, decision: scenes vs. scripts as primary, signals vs. groups, Resource patterns. Ignoring these makes the port look like vendored junk and the user rewrites it anyway.

Use opus because all three of these need real judgment. Don't downgrade to sonnet to save tokens — the cost of a bad port is the user re-doing it.

## Preconditions

1. **Milestone exists** in `.gamemaker-kit/milestones.json`.
2. **Bot validation passed** — `validation.verdict === "PASS"`.
3. **Human feedback passed** — `human_feedback.verdict === "PASS"`.
   - If either failed: stop. *"This milestone hasn't passed both gates. Bot: {bot_verdict}, Human: {human_verdict}. The kit refuses to port unvalidated mechanics — that's the whole reason it exists. Fix and re-validate, or kill the milestone."*
   - `--force` override is allowed but stamped `forced: true` in the port record AND prints a 3-line warning before generating any code.
4. **Target engine declared** — read `pillars.json` `engine` field (set at `/gmk-init`). If not `godot` or `unity`:
   - For other engines (Love2D, GameMaker Studio, etc.), don't generate code. Generate a port-checklist only and tell the user: *"Auto-port for {engine} isn't supported in MVP. Outputting a manual port checklist instead — it lists every mechanic, feel parameter, and asset slot you'll need to translate by hand."*
5. **Engine project directory exists.** Look for:
   - `godot/` subfolder containing `project.godot`, OR
   - `unity/` subfolder containing `Assets/`, OR
   - The current working directory IS a Godot/Unity project (project.godot at root, etc.).
   - If none found: ask *"Where's the engine project? Either point me at the Godot/Unity project root, or run /gmk-init's engine step to set it up."*
6. **Phase 2 gate for Unity.** If engine is `unity`, MVP behavior:
   - Generate the port-checklist (always).
   - Skip code generation; tell the user *"MVP port skill targets Godot only. Unity code generation lands in Phase 2. The checklist below covers everything that needs to translate; the C# implementation is yours to write — kit will validate the result if you re-share an HTML prototype of any change."*
   - Continue this skill from Step 4 onward (checklist generation), skip Step 3 (code generation).

## Flow

### Step 1 — Read everything load-bearing

Read in order:

1. `.gamemaker-kit/milestones.json` → milestone entry (hypothesis, validation metrics, human feedback themes, pillar bindings).
2. `prototypes/<name>.html` → the actual code being ported. Parse for:
   - Game state shape (variables, constants).
   - Action handlers (what happens on each `act()` case).
   - Render code (what gets drawn, when, in response to what).
   - Animation/feel timings (hit-stop durations, particle counts, easing curves).
   - The `__gmk_botHook__` block — discardable in the port; was scaffolding.
3. `.gamemaker-kit/pillars.json` → pillar IDs and anti-examples (used for Step 5 checklist).
4. **Host project conventions:**
   - **Godot:** look for any existing `scripts/`, `scenes/`, `resources/` layout. Read 2-3 existing `.gd` files to learn naming (snake_case vs CamelCase for resources), signal style (`signal foo_happened` connected explicitly vs. autoloaded bus), node tree depth preferences. If `_workspace/conventions.md` exists, read it.
   - If the project is empty (no .gd files yet), use Godot 4.x defaults: snake_case files and signals, PascalCase scene/class names, `scripts/<feature>/` and `scenes/<feature>/` layout.

Do NOT skip the conventions step. Generated code that ignores existing conventions is worse than asking.

### Step 2 — Plan the port (don't write code yet)

Output a plain-language port plan and **wait for user confirmation** before generating any code:

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
    1. Hit-stop duration (0.3s in JS)  — Godot's frame timing is different;
                                          re-tune by feel.
    2. Screen shake amplitude/decay    — viewport size/DPI changes the perception.
    3. Particle visuals                — JS used filled circles; Godot will
                                          need a real texture or a Shader.
    4. Sound (none in HTML prototype)  — pillar 'tactile-satisfaction' is
                                          half-broken without it. Add SFX
                                          before the next playtest.
    5. Difficulty curve, score scaling — needs re-tuning against actual
                                          target devices.

  Coupling to existing project:
    - Found existing scene 'godot/scenes/main.tscn'. Will NOT auto-add the
      merge_grid scene to it; you decide where it lives.
    - Found existing 'event_bus.gd' with signals — will register 'tile_merged'
      there following the same naming pattern.

Proceed?
```

If the user says no or wants changes, iterate. Don't generate code under a wrong plan.

### Step 3 — Generate the code

Once the plan is confirmed, write the files. Rules:

#### General

- **Idiomatic to the engine, not the prototype.** A prototype's `for` loops over flat arrays might want to become signals + groups in Godot. A prototype's monolithic state object might split into a `Resource`-backed `GameState`. Use the engine's primitives.
- **Don't transcribe magic numbers.** When the HTML has `const HITSTOP = 300` (ms), don't translate to `const HITSTOP = 0.3` and call it done. Mark it with a comment `# TUNE: hit-stop duration — re-feel after first run` and put it in the checklist. The number is a placeholder until human re-tuning.
- **Comments at the top of each generated file** that name the source milestone:
  ```gdscript
  # Ported from gamemaker-kit milestone m1-merge-feel
  # Validated: bot PASS (200 runs), human PASS (4/5 said "satisfying")
  # Pillars targeted: tactile-satisfaction
  # See port-checklists/m1-merge-feel-port.md for re-tuning items.
  ```
  This is the only multi-line comment block the kit allows. Future-you reads this when finding the file in 6 months.
- **No `__gmk_botHook__`.** That was scaffolding. Drop it.
- **Determinism.** The HTML prototype was deterministically seeded for the bot. Production game probably wants `randomize()` on game start. Default to `randomize()` but leave a comment `# DEV: replace with seeded RandomNumberGenerator if you want deterministic playthroughs`.

#### HTML → Godot translation map (quick reference for the model)

| HTML/JS pattern | Godot 4.x idiom |
|---|---|
| `<canvas>` 2D draw via `ctx.fillRect` | `Node2D` with `_draw()` override, OR `Sprite2D` per visual element if mostly textures |
| `setInterval(loop, 16)` game loop | `_process(delta)` on a Node |
| `setTimeout(fn, 300)` for feel | `await get_tree().create_timer(0.3).timeout` OR `Tween` |
| Manual collision check between rects | `Area2D` + `CollisionShape2D` + signal connections |
| `addEventListener('pointerdown')` | `_input(event)` or `_unhandled_input(event)` checking `InputEventMouseButton`/`InputEventScreenTouch` |
| Drag with `pointermove` | `InputEventMouseMotion` / `InputEventScreenDrag`, or `Draggable` pattern with `_input` |
| Inline `<style>` CSS animations | `AnimationPlayer` track OR `Tween` for one-off |
| `localStorage.setItem` | `ResourceSaver.save()` to `user://savegame.tres` (Resource-based save) |
| Vanilla `class` for game state | `class_name GameState extends Resource` (saveable, inspector-editable) |
| Particle burst (manual loop drawing dots) | `GPUParticles2D` with a one-shot emitter |
| Screen shake (translate canvas) | `Camera2D` + `Tween` on `offset`, OR shader on viewport |
| Audio (HTMLAudioElement, WebAudio) | `AudioStreamPlayer` (UI/non-positional) or `AudioStreamPlayer2D` (positional) |
| Game loop step counter | `_process(delta)` accumulator OR `Timer` node |

When the prototype uses something not in this table: pick the simplest Godot equivalent and document the choice as a comment. Don't reach for plugins.

#### Action interface translation

The prototype's `legalActions()`/`act(action)` API was for the bot. In Godot, this becomes:

- For input-driven mechanics: real input events (`_input`, `_unhandled_input`).
- For state-machine / turn-based: a state machine on the relevant Node, with methods named after the action types.

Don't preserve the `legalActions/act` shape in production code — it's a test harness, not a game architecture.

#### Pillar-aware code comments

For each major function/scene that strengthens a specific pillar, add ONE comment line:

```gdscript
func _on_merge() -> void:
    # Pillar: tactile-satisfaction — hit-stop + shake + particles. Re-tune by feel.
    _hit_stop()
    _camera_shake()
    _spawn_burst_particles()
```

This makes the pillar binding survive into the codebase, so future-you doesn't refactor the feel out of it without realizing what was load-bearing.

### Step 4 — Generate the port checklist

Always write `port-checklists/<name>-port.md` (in the gamemaker-kit folder, not the engine project). Even for Unity / unsupported engines, the checklist is the deliverable.

Template:

```markdown
# Port checklist: m1-merge-feel → godot

Generated 2026-05-09. Source: prototypes/m1-merge-feel.html. Validation: bot PASS, human PASS.

## DO NOT auto-translate — these need human re-tuning

### Game feel timings
- [ ] Hit-stop duration. JS prototype used 300ms. Godot version uses placeholder 0.3s — re-feel.
      Test with `Engine.time_scale = 0` for true freeze, vs. `0.05` for slow-mo. The pillar
      'tactile-satisfaction' depends on this — get it wrong, you broke the milestone.
- [ ] Screen shake amplitude. JS used canvas translate ±4px. Godot's Camera2D offset is in
      world units; tune against actual viewport size, not pixel count.
- [ ] Tween easing curves. JS used `cubic-bezier`. Godot Tweens default to linear; pick
      `Tween.TRANS_BACK / EASE_OUT` for chunky-feel decay, then re-feel.

### Physics
- [ ] (List physics-affecting mechanics here, if any. For pure grid games, write "none".)

### Audio
- [ ] HTML prototype had no audio. Pillar 'tactile-satisfaction' is incomplete without sound.
      Suggested: 1 short chunky merge SFX (~150ms), 1 ambient bed loop, 1 fail/clear sound.
      Generate via Phase 3 ElevenLabs integration, or use freesound.org for MVP.

### Art
- [ ] HTML prototype used canvas-drawn shapes. Replace with sprites/textures per your
      visual direction. Don't ship the placeholder shapes to testers in v2 — they'll
      tester-respond to art, not mechanic, and pollute your next feedback round.

## Integration with existing project

- [ ] Decide where `merge_grid.tscn` is instanced. The port did NOT auto-attach it to
      `main.tscn`. Likely candidates: a level select, a debug menu, or main directly.
- [ ] If using `event_bus.gd` autoload: confirm `tile_merged` signal is registered there.
      Other features (achievements, score, juice) may want to subscribe.
- [ ] Naming: ported files use snake_case to match existing project. Verify your team's
      convention if working with collaborators.

## Things the bot validated, that the human-played port should re-verify

- [ ] Bot reached 4m47s avg session length on random play. Manual playtest the Godot port:
      can YOU sustain a 4-min session, or does input lag / Godot tween difference make it
      feel different?
- [ ] No dominant strategy detected by bot. Quickly check that the Godot port hasn't
      introduced one accidentally (e.g. an exploit from `_process` timing differences).

## Anti-example check (last before merging this branch)

The pillar 'tactile-satisfaction' anti-example: "Merging two dragons feels like clicking
a button on a spreadsheet — silent, instant, weightless."

- [ ] Play the Godot port. Does it match the anti-example? If yes, re-tune timings and
      audio before considering this milestone shipped. The HTML version cleared this gate;
      losing it in port is the most common kit-failure mode.
```

The checklist is the **deliverable** alongside code. Without it, the user has the mechanic but not the re-tuning map.

### Step 5 — Update milestone record

```json
{
  "id": "m1-merge-feel",
  "ported_to": {
    "ported_at": "2026-05-09T18:30:00Z",
    "engine": "godot",
    "files_created": [
      "godot/scripts/merge/merge_grid.gd",
      "godot/scripts/merge/tile.gd",
      "godot/scenes/merge/merge_grid.tscn",
      "godot/scenes/merge/tile.tscn"
    ],
    "files_modified": ["godot/project.godot"],
    "checklist": "port-checklists/m1-merge-feel-port.md",
    "forced": false
  }
}
```

### Step 6 — Print the port report

```
m1-merge-feel — PORTED to godot/

  Files created (4):
    godot/scripts/merge/merge_grid.gd
    godot/scripts/merge/tile.gd
    godot/scenes/merge/merge_grid.tscn
    godot/scenes/merge/tile.tscn

  Files modified (1):
    godot/project.godot   — registered input action 'tile_drag'

  Port checklist: port-checklists/m1-merge-feel-port.md
    11 items to manually re-tune. The first 5 are game-feel critical
    (hit-stop, shake, ease curves, audio, art). Don't skip.

Next:
  1. Open the Godot project. Run merge_grid.tscn directly (F6) to feel it.
     Compare to the HTML prototype side-by-side — feel parity is the goal.
  2. Walk the port checklist. The pillar's anti-example check is the
     last item — if it fails, re-tune before integrating.
  3. /gmk-status   — see all milestones at a glance.

The HTML prototype at prototypes/m1-merge-feel.html stays put. Don't delete
it — it's the reference for "what the validated version felt like."
```

## Edge cases & policy

### Re-porting a milestone

User edits the HTML prototype, re-validates, re-shares, re-feedbacks (all PASS again), re-ports. The skill should:

1. Detect existing `ported_to` entry.
2. Diff the previously generated files against current generation.
3. Show the user *which files would change* before overwriting.
4. **Never silently overwrite user edits** to the ported files. If the user has touched a generated file (detect via git status or content hash), warn loudly: *"You've edited godot/scripts/merge/merge_grid.gd since the last port. Re-porting will OVERWRITE your edits. Options: (a) commit your edits and re-port (likely what you want), (b) skip re-porting that file and only update the others, (c) abort."*

### Multiple milestones porting to the same engine project

The kit allows it. The model should be aware that prior milestones may have created a `merge_grid.gd` already; if porting a new milestone that also wants to write `merge_grid.gd`, **don't collide** — name the new one after the new milestone (`merge_grid_v2.gd` or `merge_grid_chained.gd`) and tell the user.

### Prototype using web-only APIs

If the prototype used Web Speech, WebGL shaders, WebSockets, etc., flag in the plan: *"Prototype uses {API} which has no direct Godot equivalent. Options: (a) skip this feature in port and replace with placeholder, (b) write a Godot-native equivalent (more work — out of MVP port scope), (c) defer milestone until Godot has the capability."* Wait for user choice; don't assume.

### Engine project has its own conventions file

If the project has `_workspace/conventions.md` (TaskForge Pro convention) or a CLAUDE.md, read it before generating code. Conventions there override the defaults in this skill.

### Unity port (Phase 2 placeholder)

Generate the checklist; print: *"MVP doesn't auto-generate C#. Here's the checklist; the implementation is your hour. The kit will revalidate any HTML prototype changes the same way."* Don't apologize repeatedly — one mention is enough.

### Test the port?

This skill writes code; it doesn't run the engine. The user opens Godot and tests by hand. The Phase 2 vision includes "Godot headless playtest harness" — out of scope for MVP.

### Failed / killed milestones

The skill refuses to port FAIL/INCONCLUSIVE milestones unless `--force`. If forced, stamps `forced: true` and includes a reason field for the audit trail. Lifecycle:

```json
"ported_to": {
  "forced": true,
  "force_reason": "User overrode FAIL — wants to keep the rough shape and rebuild from there"
}
```

## What this skill does NOT do

- **Doesn't run the engine.** No `godot --headless` calls, no `unity -batchmode`. Compile errors from the generated code surface when the user runs it.
- **Doesn't generate art assets.** Placeholder shapes/textures only. ComfyUI integration is Phase 2.
- **Doesn't generate audio.** Same — placeholder silence; ElevenLabs integration is Phase 3.
- **Doesn't write tests.** GameTest / GUT setup is out of scope; generated code is unit-test-friendly but no tests are written.
- **Doesn't auto-commit to git.** The user reviews and commits. Auto-commits hide what changed.
- **Doesn't refactor existing project code.** Only adds new files (and registers signals/inputs in existing autoloads when the user confirmed in Step 2).

## Notes for the model running this skill

- **API hallucination is the #1 way to lose the user's afternoon.** When in doubt about a Godot 4.x API, prefer well-known paths: `Node2D`, `Tween`, `AnimationPlayer`, `AudioStreamPlayer`, `Area2D`, `CollisionShape2D`, `GPUParticles2D`. If you're tempted to use something exotic, stop and ask: is this in Godot 4.x specifically? Was it renamed from 3.x?
- **Read existing project files before generating.** The user's existing code is your style guide. Mimic it. If they use `class_name` everywhere, you use `class_name`. If they prefer signals over groups, you prefer signals.
- **Game feel is sacred.** Every translated timing/easing/value gets a `# TUNE` comment AND a checklist entry. The whole reason the prototype passed validation is the feel — losing it in port is the worst-case failure.
- **Pillar comments survive into prod.** The one-line `# Pillar: <id> — <intent>` comment per critical function is the breadcrumb trail back to why the code looks this way. Don't strip them in "cleanup."
- **The checklist is the most under-valued deliverable.** Treat it with the same care as the code. It's the user's manual re-tuning map; if it's terse or vague, the port half-fails.
- **One milestone, one port.** Don't try to "while we're here, also port m2." The skill ports one milestone at a time. If the user wants both, they run twice.
- **`--force` is the user's call to override, not yours to recommend.** Don't suggest forcing through a FAIL gate. The kit's discipline is the value prop.
- **When the prototype is small and the host project is empty**, a port can be 60 lines. Resist the urge to add menus, settings, save systems. Ports preserve mechanic; they don't expand scope.
