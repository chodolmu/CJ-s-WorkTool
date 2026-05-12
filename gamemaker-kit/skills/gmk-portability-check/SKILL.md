---
name: gmk-portability-check
description: Inspect an HTML prototype's mechanic against a catalog of port-risk patterns BEFORE the user invests in /gmk-port. Surfaces specific risk categories — RNG drift, timing-driven feel, browser-only APIs, async assumptions — with severity and mitigation per category. Read-only. Use when the user says "/gmk-portability-check", "will this port cleanly", "포팅 위험도", "is this safe to port", or after a milestone passes bot+self-test, before deciding to port.
model: sonnet
---

# gmk-portability-check — Will this prototype survive the engine port?

The kit's most expensive failure mode is: bot says PASS, self-test says PASS, you port to Godot, and **the engine version feels wrong**. The mechanic is technically the same, but the *game feel* — the load-bearing thing — is different. The user has now spent days porting something they'll have to throw away.

This skill catches that **before** `/gmk-port` runs. It inspects the HTML prototype against a catalog of known port-risk patterns and reports severity + mitigation per category.

Output is a risk report, not a verdict. *"Port at your own informed risk"* is the kit's default; this skill informs the risk.

## When this skill is the right tool

✅ Use:
- After a milestone passes bot validation, **before** running `/gmk-port`
- When the user is choosing **which** of several PASS milestones to port first (port the safer one)
- When a previous port produced bad metric-diff at Stage 4 — to retroactively understand why

❌ Skip:
- Before bot validation passes (you'd be checking a prototype that might be wrong)
- If the user has already ported and accepts whatever drift happens (this skill is preventive, not corrective)

## Preconditions

1. **Milestone exists** in `milestones.json` and `prototype` field points to an HTML file that exists.
2. **Milestone passed bot validation** — `validation?.verdict === 'PASS'`. If not, warn:
   - *"Milestone {id} hasn't passed bot validation yet. Port-risk analysis is most useful after a PASS verdict — before, the prototype might still be wrong. Continue anyway?"*

## Flow

### Step 1 — Load and scan the prototype

Read `prototypes/<milestone-id>.html`. The check inspects:

- The full text of the file (string-pattern matches for risk markers)
- The hypothesis header (what the mechanic claims to test)
- The bot-hook implementation (the spec callbacks the user wrote)
- The metric_by rows (what bot validates — engine has to reproduce these)

### Step 2 — Run the catalog (12 risk categories)

For each category below, check the prototype and assign severity:

- **🔴 High** — likely to cause noticeable feel drift or porting failure
- **🟡 Medium** — possible drift; depends on engine-side care
- **🟢 Low** — minor cleanup; rarely material
- **⚪ N/A** — pattern not present; nothing to mitigate

#### Category 1 — RNG implementation

**Check**: Is the prototype using `__gmk.createRng()` from the library, or a custom RNG?

- Library LCG: 🟢 — Godot/Unity have equivalent integer-math LCGs; trivial to mirror.
- Custom but seedable: 🟡 — port needs to reproduce the exact algorithm.
- `Math.random()` anywhere: 🔴 — non-deterministic; port can't match.

#### Category 2 — Timing-driven feel

**Check**: Does the hypothesis or hook reference specific millisecond constants for *feel* (hit-stop, animation, decay)?

- No timing constants: 🟢
- 1-2 timing constants, well-named: 🟡 — engine must reproduce; usually doable with `await get_tree().create_timer()` in Godot.
- 3+ timing constants, or constants in the millisecond range without comments: 🟡-🔴 — engine frame timing (60fps = 16.67ms per frame) may quantize the feel away. The 80ms hit-stop becomes 5 frames; that's fine. The 17ms decoration becomes 1 frame; that might be invisible.
- `requestAnimationFrame`-coupled state: 🔴 — gmk-prototype-rules forbids this for state; flag as a Rule 3 violation if present.

#### Category 3 — Floating-point math in state

**Check**: Does game state use `Number` arithmetic that might differ between JS and the target engine (especially `Math.atan2`, `Math.sin`/`cos`, division-then-floor)?

- State is integer-only: 🟢
- Floats used but only for visuals: 🟢
- Floats used for state comparisons (`if (score > 1.5)`): 🟡 — IEEE 754 differences across runtimes can be material near boundaries. Port should normalize to fixed-point if comparisons are tight.
- Floats used for player position with sub-pixel precision in continuous shape: 🟡-🔴 — Godot's `_physics_process` uses delta time; ported continuous mechanics often drift here. Mitigation: discrete-grid-tick the player position even in continuous shape.

#### Category 4 — Browser-only APIs

**Check**: pattern-match for browser-only APIs in the prototype:

| API | Severity | Why |
|---|---|---|
| `localStorage`, `sessionStorage` | 🔴 if used for state, 🟡 if used for visual config only — already forbidden by gmk-prototype-rules for state |
| `fetch`, `XMLHttpRequest` | 🔴 — kit forbids network calls; flag as a Rule 6 violation |
| `canvas.getContext('2d')` rendering | 🟢 — port substitutes engine's canvas; mechanic-side fine |
| `canvas.getContext('webgl2')` | 🟡 — shader mechanic; engine equivalent needed |
| `WebAudio` for game-state-driving timing | 🔴 — WebAudio's clock is wall-time; port can't reliably match |
| `WebAudio` for sound playback only | 🟢 — engine's audio bus replaces it |
| Pointer/touch events with multi-touch state | 🟡 — engine input mapping differs; document carefully |
| `document.elementFromPoint`, hit-testing via DOM | 🟡 — engine uses Area2D / collision shapes; needs deliberate port |
| `setTimeout` / `setInterval` for state | 🔴 — already Rule 3 violation |

#### Category 5 — Action space size & shape

**Check**: `legalActions()` returns how many entries per state on average?

- 1-20 actions, fixed shape: 🟢 — direct port; engine's enums or arrays mirror it
- 1-20 actions, variable shape (different action types per state): 🟡 — engine port needs polymorphism; doable but careful
- 20-100 actions per state: 🟡 — engine bot's MCTS becomes slow; port to engine is still fine, but Stage 4 metric diff (Engine 200 runs) takes longer
- > 100 actions per state: 🟡-🔴 — usually means the action space is over-fine-grained; consider reducing in the prototype first

#### Category 6 — State that isn't easily serializable

**Check**: Does game state include things that don't survive JSON.stringify cleanly?

- Plain objects, arrays, numbers, strings: 🟢
- Maps, Sets, Symbols: 🟡 — engine doesn't have direct equivalents; port maps to Dictionary/Array
- DOM nodes, canvas references in state: 🔴 — engine port can't reproduce; refactor to separate visual from state
- Closures stored in state: 🔴 — Godot/Unity functions aren't first-class state; refactor

#### Category 7 — Coordinate systems

**Check**: How are positions represented?

- Discrete grid `[row, col]` integers: 🟢
- Continuous `[x, y]` floats, screen-space pixels: 🟡 — engine may use world-space; port needs a scale factor + careful axis convention (Godot Y-down vs Unity Y-up)
- Polar coordinates: 🟡 — engine math libs differ in conventions; document
- Mixed (some state in pixels, some in grid cells): 🔴 — port introduces conversion bugs

#### Category 8 — Game loop assumptions

**Check**: Does the prototype assume a specific tick rate / frame budget?

- Turn-based (grid/dialogue): no loop assumption — 🟢
- Continuous with `tickRate = 60`: 🟢 if engine matches; 🟡 if engine runs at variable framerate (Unity `Update` vs `FixedUpdate`)
- Continuous with implicit "60fps" baked into magic numbers: 🟡 — porter needs to find and parameterize
- Shader with timestep coupling: 🟡 — engine shader runs in engine's time; same constants may produce different visuals

#### Category 9 — Player input model

**Check**: How does the prototype handle input?

- Discrete actions enumerated in `legalActions`: 🟢 — engine binds 1:1
- Continuous input (mouse drag, joystick): 🟡 — engine's input axis system differs; map carefully
- Mouse-position-dependent (hover effects, drag-and-drop): 🟡-🔴 — engine hit-testing differs significantly; expect Stage 3 smoke-run issues

#### Category 10 — Save/load state

**Check**: Is the mechanic stateful across runs (carries state from one playthrough to the next)?

- Each run fresh: 🟢 — gmk-prototype-rules requires this anyway
- Run-to-run persistence in `localStorage`: 🔴 — already a Rule 6 violation; port can't reproduce; refactor first

#### Category 11 — Async/await in game logic

**Check**: Does the hook implementation use `async` functions or Promises in game state transitions?

- Sync `apply(action)`: 🟢
- `async apply(action)` because of animation waits: 🟡 — gmk-prototype-rules notes timers-for-feel are OK, but if they gate state transitions, port has to mirror the await pattern in Godot (`await get_tree().create_timer(...).timeout`)
- Promise-based game logic that *waits* on external events (e.g., `await network`): 🔴 — already a Rule 6 violation

#### Category 12 — Engine-specific feature ahead-of-time

**Check**: Is the mechanic relying on an engine feature the prototype can't really test?

- Mechanic is pure: 🟢
- Mechanic relies on physics simulation (collisions, rigidbodies): 🟡 — HTML approximations rarely match Godot/Unity physics exactly. Stage 4 metric diff likely shows drift.
- Mechanic relies on shader effects for *feel* (deformation, post-processing): 🟡 — HTML canvas approximation differs from engine shader pipeline
- Mechanic relies on platform-specific input (gamepad rumble, haptic feedback): 🟡 — HTML can't test; engine port introduces a new variable

### Step 3 — Compute overall portability verdict

The overall verdict is the **worst** category:

| If any category | Overall |
|---|---|
| 🔴 High | **PORT WITH CAUTION** — name the specific risks; recommend mitigation before /gmk-port |
| 🟡 Medium (and no High) | **MOSTLY PORTABLE** — list the mediums; usually mitigatable during port |
| 🟢 Low / N/A only | **CLEAN PORT EXPECTED** — proceed to /gmk-port with confidence |

### Step 4 — Print the report

```
Portability check: m1-merge-feel
Overall: 🟡 MOSTLY PORTABLE (1 high, 2 medium, 9 low/na)

Risks (high first):
  🔴 Cat 2 (Timing): hit-stop constant 80ms
       Why: At Godot's 60fps, 80ms = 4.8 frames. Engine may quantize to 4 or 5 frames depending
            on physics step. Difference is rarely material to feel — but Stage 4 metric diff
            will catch it if it is.
       Mitigation: Port hit-stop to ms (not frames). Use `await get_tree().create_timer(0.08).timeout`.

  🟡 Cat 3 (Floating-point): score multiplier uses `score *= 1.15`
       Why: IEEE 754 differences accumulate over many merges; engine score may differ by ~0.001 after
            100 merges.
       Mitigation: Either normalize comparisons to integer math (score in tenths), or accept ~0.001 drift.

  🟡 Cat 7 (Coordinates): grid in `[row, col]` ints, but particle effects in `[x, y]` px
       Why: Mixed coord systems are a porting trap. The mechanic itself (merge logic) is fine, but
            the particle-emission positions need a `grid_to_world()` helper in Godot.
       Mitigation: Implement that helper deliberately, not as a one-off.

Clean (🟢 or n/a):
  Cat 1 RNG, Cat 4 Browser APIs, Cat 5 Action space, Cat 6 Serializable state,
  Cat 8 Game loop, Cat 9 Input, Cat 10 Save state, Cat 11 Async, Cat 12 Engine-specific

Next: /gmk-port m1-merge-feel — proceed, with the three mitigations above noted.
      The kit's Stage 4 metric diff will catch any real drift; this check is the pre-flight.
```

### Step 5 — Optionally write to milestones.json

If the milestone has a `portability_check` field reserved (currently not in the schema — Wave A doesn't add this), write:

```json
{
  "portability_check": {
    "ran_at": "2026-05-12T17:00:00Z",
    "verdict": "MOSTLY_PORTABLE",
    "risks": [
      { "category": "timing", "severity": "high", "note": "80ms hit-stop", "mitigation": "..." },
      ...
    ]
  }
}
```

**Wave A note**: the schema field is *not yet added* in v0.2 (it's reserved). For v0.2 this skill prints the report only — no JSON write. Later versions may persist; for now, the user copies into `_workspace/milestones/<id>/notes.md` if they want to keep it.

## Edge cases & policy

### Multiple HIGH severities

Don't auto-refuse the port. Print all risks and let the user decide. But include a stronger framing:

> "3 HIGH risks detected. /gmk-port will likely produce noticeable metric-diff at Stage 4 or feel-drift at Stage 5. Recommend mitigating at least the HIGH risks in the HTML prototype first (regenerate via /gmk-prototype), then re-run /gmk-portability-check."

### Prototype hasn't passed bot validation

Already covered in preconditions. Allow override, but the check reports caveat: *"Bot didn't pass — risks may apply to a prototype that's still wrong."*

### Prototype uses an unknown library

Inline `<script src>` to a CDN library = automatic Cat 4 high (Rule 6 violation). Flag it loudly: *"External CDN import detected — this violates Rule 6 of gmk-prototype-rules. Port can't reproduce CDN behavior; either inline the library or refactor."*

### Shader-shape milestone

The catalog above is grid/continuous/dialogue-tuned. For shader shape, replace Cat 5 (action space) with "shader uniforms parameterization" and Cat 12 with "GLSL→engine-shader-language differences" (Godot uses its own shader language; Unity uses HLSL). The shape-specific catalog is in Wave D's shader template — until then, surface the limitation: *"Shader-shape portability check is partial in v0.2. Major risk: shader language differences (GLSL ↔ {Godot shaders | HLSL})."*

### Re-running after mitigations

Encouraged. Each run is fresh; no caching. If a previous run flagged 3 highs and the user fixed them, re-run should show 0 highs.

## What this skill does NOT do

- **Doesn't perform the port** — that's `/gmk-port`.
- **Doesn't run anything against the prototype at runtime** — it's pattern-matching against the file's text. Fast, but means it can't catch *all* runtime issues.
- **Doesn't refuse to let the user port** — it informs; the user decides.
- **Doesn't validate the engine-side code** — that's `/gmk-port` Stage 2 (compile) and Stage 4 (metric diff).
- **Doesn't suggest engine-specific code** — points at mitigations in plain language. The actual GDScript/C# goes via `/gmk-port`.

## Notes for the model running this skill

- **Pattern-matching is the floor, not the ceiling.** A clever prototype can hide a Cat 11 async issue from regex. If the user reports unexpected port drift, the next iteration of this skill expands the catalog. Today, accept the limitation.
- **Don't lecture severity.** A 🟢-only report doesn't need a paragraph of reassurance. A 🔴 report doesn't need a sermon. Categories, severities, mitigations — that's the report.
- **The catalog is calibrated for 2D + deterministic + ≤5min sessions.** If the user's pillars.json supported_genres_check has falses, surface that the catalog has reduced relevance to their case.
- **Don't claim "this port will pass."** Even a 🟢-only report can produce drift in `/gmk-port` Stage 4 — physics, threading, or engine peculiarities the catalog doesn't cover. The skill reports *catalog matches*, not *future certainty*.
- **Frame mitigations as user actions, not auto-fixes.** "Convert to integer math" is something the user does in the prototype; the skill doesn't edit the file.
- **Cite gmk-prototype-rules section numbers when a check is also a rule violation.** "Cat 4 (localStorage) is also a Rule 6 violation" gives the user one place to look.
