---
name: gmk-prototype-rules
description: The canonical rulebook for gmk HTML prototypes — single-file constraint, 300-line soft cap / 600-line hard cap, mandatory __gmk_botHook__ API contract, hook self-check procedure, deterministic-seeding rules. Other skills (gmk-prototype, gmk-validate, gmk-mock-inject) cite this rulebook. Use when the user says "/gmk-prototype-rules", "show me the hook API", "300-line cap", "프로토타입 룰", or when another skill needs the canonical reference. Read-only reference — does not modify files.
model: sonnet
---

# gmk-prototype-rules — The HTML prototyping rulebook

This is the **canonical rulebook** for gmk HTML prototypes. It is cited (not duplicated) by:

- `gmk-prototype` (when generating a new prototype)
- `gmk-validate` (when smoke-checking the hook before bot runs)
- `gmk-mock-inject` (when injecting asset placeholders)
- `gmk-port` (when generating the engine-side equivalent)
- `gmk-shape-advisor` (when picking grid/continuous/dialogue/shader)

When another skill says *"follow gmk-prototype-rules"*, this is the file they mean. The rules below are **enforced** by the kit's validators, not suggested.

If you find yourself arguing with a rule — "but my prototype really does need 500 lines" — the answer is usually *"two milestones, not one prototype."* The rules are the kit's shape; without them the kit collapses into a fancy code generator.

---

## Rule 1 — One mechanic, one file

A prototype tests **one mechanic** for **one milestone**. The prototype lives at `prototypes/<milestone-id>.html` — a **single HTML file** with inline `<style>` and `<script>`. No external imports, no CDN, no module bundler.

**Why**: the #1 game-jam failure pattern is the single-file blowup. The kit caps single files *and* splits *between* milestones, not within them. Two mechanics in one HTML = a hidden second milestone that never gets validated separately.

If you find a prototype with two mechanics, the fix is `/gmk-prototype-rules` reports the violation and refuses to validate. The user runs `/gmk-prototype` twice, getting `m{N}a-` and `m{N}b-` slugs.

### What "one mechanic" means in practice

Borderline cases (model has to judge):

| Case | One mechanic? | Why |
|---|---|---|
| Merge dragons + visible score | **One.** Score is a readout, not a mechanic. |
| Merge dragons + multipliers | **One.** Multiplier is a number tweak on the same action. |
| Merge dragons + power-ups that change merge rules | **Two.** Power-ups change the mechanic; they belong in a separate milestone. |
| Merge dragons + idle income while menu open | **Two.** Idle income is a second loop. |
| Crossy Road dodge + score for distance | **One.** Distance is a readout. |
| Crossy Road dodge + collectible coins | **Two.** Coins create a second decision. |

**Heuristic**: if the player has to decide between two different action types in the same loop, those are two mechanics. If one action type produces multiple outcomes that vary in magnitude, that's one mechanic.

---

## Rule 2 — 300-line soft cap, 600-line hard cap

Line counting: **non-blank, non-comment lines of code**. Inline `<style>` and `<script>` both count. HTML markup outside `<script>` counts. The `_bot_hook_lib.js` library copy (when inlined per Rule 4) counts — it's part of the file.

| Threshold | Action |
|---|---|
| < 300 | Healthy. Continue. |
| 300 ≤ N < 600 | **Soft cap.** Emit comment in the file: `<!-- WARNING: 300-line soft cap reached -->`. Tell the user *"Approaching the soft cap. The prototype is doing more than one thing — consider splitting into a second milestone."* Continue. |
| N ≥ 600 | **Hard cap.** Refuse to add code. Tell the user *"Hard cap. This isn't a prototype anymore — it's a game. Split into milestones m{N}a / m{N}b or rethink the scope."* Stop generating. |

**Why these numbers**: 300 is the median *successful* mechanic prototype across the kit's test corpus. 600 is the line where mental-model load exceeds what a single reader can hold while reasoning about state transitions. Beyond 600, prototypes consistently produce false PASS verdicts (the bot validates the wrong thing because the author lost track).

The numbers are not negotiable. Don't add a `--max-lines 1000` flag. The user who *thinks* they need 1000 lines is the user the kit is trying to protect.

---

## Rule 3 — Deterministic seeding (mandatory)

The bot drives time. The bot replays a seed and expects identical state. **Therefore**:

- **No `Math.random()`** anywhere in game logic. Use `__gmk.createRng(seed)` from the library (see Rule 4).
- **No `Date.now()` in state.** Wall-clock time is non-deterministic. Sim time advances via `act()` — no wall-clock in game state.
- **No `requestAnimationFrame`-driven state.** rAF is fine for *visuals* (smooth rendering when a human plays), but state mutations only happen inside `act()`.
- **No `setInterval` / `setTimeout` for state.** Visuals (hit-stop, particle anim) using timers is fine; spawning enemies on a timer is not — convert to action-driven counters.

The bot calls `startGame(seed)` with `seed ∈ {0..199}` in `/gmk-validate`'s default run. **Same seed must produce same game** given same action sequence. If reproducing a `seed=17` run gives different state, the prototype is broken and validation is meaningless.

### Quick self-check (the kit does this)

`/gmk-validate` runs **two passes with seed=0** before the 200-run trial. If they diverge in any way (different score, different actions taken, different summary), it stops with:

> *"Prototype is non-deterministic. Same seed, two runs, different outcomes. Likely causes (in order): Math.random in game logic, Date.now in state, wall-clock condition in legalActions/isOver. Fix and rerun."*

Don't ship non-deterministic prototypes. The kit's bot signal evaporates.

---

## Rule 4 — The `__gmk_botHook__` API contract

Every prototype **must** expose `window.__gmk_botHook__` with the surface below. The library at `templates/_bot_hook_lib.js` provides `__gmk.makeHook(spec)` that produces this surface from your callbacks.

### The five required spec callbacks

| Callback | Signature | What it does |
|---|---|---|
| `reset(seed, rng)` | function | Set initial state. **Must seed any RNG via the provided `rng`** (or `__gmk.createRng(seed)`). No `Math.random()`. |
| `isOver()` | function returning boolean | True when the run is over (win/loss/timeout/stuck). |
| `legalActions()` | function returning array | Actions the bot may take now. Returns `[]` only when game is over or stuck. |
| `apply(action)` | function | Mutate state by applying the action. Advances sim time for continuous shapes. |
| `collectSummary()` | function returning object | Hypothesis-specific metrics: `{ score, build_used, custom: {...} }`. The library wraps this with `duration_ms`, `actions_taken`, `crashed`, `stuck`. |

### The four optional callbacks (★ Wave B addition, opt-in)

Optional — Procedural Personas in `/gmk-validate` use these if present. If absent, the bot falls back to random.

| Callback | Signature | What persona uses it |
|---|---|---|
| `stateSignature()` | function returning string | Used for state-coverage metric. Cheap stringification of distinguishing state (e.g., `JSON.stringify([gridLayout, score])`). |
| `riskEstimate(action)` | function returning number 0..1 | Used by Survivor persona. Higher = more likely to lose. |
| `progressEstimate()` | function returning number 0..1 | Used by Runner persona. 0 = start, 1 = at goal. |
| `noveltyScore(action)` | function returning number 0..1 | Used by Explorer persona. Higher = state this action leads to is "less seen." |

**Don't fake these.** A `riskEstimate` that returns `0.5` for every action provides zero signal and pollutes the Survivor persona. Either implement honestly or omit.

### The standard wrapper

Use the library:

```html
<script src="_bot_hook_lib.js"></script>
<!-- OR inline the library — see Rule 7 -->
<script>
  // ... game state ...

  window.__gmk_botHook__ = window.__gmk.makeHook({
    reset(seed, rng) { /* set state */ },
    isOver() { return /* boolean */; },
    legalActions() { return [/* action descriptors */]; },
    apply(action) { /* mutate state */ },
    collectSummary() { return { score, build_used: null, custom: { /* metrics */ } }; },

    // Optional (Wave B):
    stateSignature() { return JSON.stringify([gridState, score]); },
    riskEstimate(action) { return /* 0..1 */; },
    progressEstimate() { return /* 0..1 */; },
    noveltyScore(action) { return /* 0..1 */; },

    // Optional ceilings (defaults: 5000 actions, 600000 ms sim):
    maxActions: 5000,
    maxDurationMs: 600000,
  });
</script>
```

The library handles crash containment, stuck detection, action counting, summary wrapping, and the `_gmkApiVersion` field. **Don't hand-roll the hook.** Hand-rolled hooks miss edge cases the library covers (try/catch around `act`, stuck detection, max-actions enforcement).

---

## Rule 5 — Bot-hook self-check (mandatory before validate)

Before any bot run, `/gmk-validate` performs a **5-point smoke check**. The prototype must pass all five or validation aborts.

| Check | Pass condition |
|---|---|
| 1. Hook exists | `typeof window.__gmk_botHook__ === 'object'` |
| 2. API version | `window.__gmk_botHook__._gmkApiVersion === 1` |
| 3. Required functions | `startGame`, `isOver`, `legalActions`, `act`, `summary` all typeof `function` |
| 4. Determinism | Two runs with `seed=0` produce identical summary objects |
| 5. Bounded | `isOver()` becomes true within `maxActions` for at least one of `seed ∈ {0, 1, 2}` |

If any fails, validation refuses with a named reason. The kit does not patch a broken hook — the user fixes the prototype.

---

## Rule 6 — No external dependencies in the prototype

What goes **in** a prototype:

- HTML markup, inline `<style>`, inline `<script>`
- Plain JS (ES2020+; assume modern browser)
- Canvas 2D, optionally WebGL2 for shader-shape (Wave D, see `gmk-shape-advisor`)
- `_bot_hook_lib.js` inlined or `<script src>`-referenced (see Rule 7)

What stays **out**:

- ❌ CDN imports (React, Phaser, three.js, etc.) — offline-fragile + slow for 200 bot loads
- ❌ External asset files (`.png`, `.mp3`, `.svg` referenced by URL) — use canvas drawing, CSS shapes, or `data:` URIs
- ❌ `localStorage` / `sessionStorage` for game state — bot runs are fresh sessions; persistence pollutes
- ❌ Analytics, telemetry, error reporters — distractions
- ❌ High-score tables, settings menus, tutorials — not the milestone's job

**Exceptions**:

- The hypothesis is *about* art/sound feel → tiny inline `data:` URI or generated WebAudio is allowed. Document the exception in the header comment.
- The hypothesis is *about* shader feel → see Wave D's `prototype-shader.html` template (vanilla WebGL2, no shader libraries).

### The asset placeholder workflow

If the prototype needs *visual cues* before real art exists, use `/gmk-mock-inject`. That skill injects deterministic-shape placeholders (colored rectangles labeled "DRAGON-RED", "DRAGON-BLUE") that the validate-time bot ignores but a human can navigate.

---

## Rule 7 — Library inline vs. `<script src>`

Two options, pick per project:

### Option A — `<script src="_bot_hook_lib.js"></script>`

Reference the library file. Requires the file to exist at `prototypes/_bot_hook_lib.js` (copy from the kit's `templates/_bot_hook_lib.js`). Pros: smaller per-prototype file size; one library update propagates. Cons: bot loads the prototype via `file://` URL; relative `<script src>` works but breaks if you move the file alone.

### Option B — Inline the library

Paste the full library contents into the prototype's `<script>`. Pros: prototype is genuinely single-file, portable, deploys anywhere. Cons: ~150 lines of the line cap goes to the library.

**Default**: Option A for in-project prototypes (the user's working directory). Option B if the user wants to share a prototype file independently.

In **both** cases, the library file count is included in the line cap.

---

## Rule 8 — Hypothesis header comment (load-bearing)

Every prototype starts with an HTML comment block in this exact format. The kit's validators *parse* this — it's not decoration.

```html
<!--
gamemaker-kit milestone: m1-merge-feel
Pillars targeted: tactile-satisfaction, discovery-joy
Hypothesis:
  IF   two dragons merging triggers 0.3s hit-stop + screen shake + 8-particle burst
  THEN the player loses track of time within 5 minutes
  MEASURED BY:
    bot:       session_length_avg_ms > 240000  (n=200, conf=0.90)
    self-test: user reports "satisfying" or equivalent
Created: 2026-05-09T12:00:00Z
Shape: grid
-->
```

**Field rules**:
- `milestone` line — the milestone ID (kebab-case).
- `Pillars targeted` — comma-separated pillar IDs.
- `Hypothesis.IF` — the mechanic/change.
- `Hypothesis.THEN` — the observable behavior or feel.
- `Hypothesis.MEASURED BY` — at least one `bot:` row AND at least one `self-test:` row. (`human:` is **deprecated** in v0.2 — see Rule 10.)
- `Created` — ISO-8601 with timezone.
- `Shape` — one of `grid | continuous | dialogue | shader`.

If any field is missing or malformed, `/gmk-validate` refuses to start and `/gmk-prototype` won't write the file.

---

## Rule 9 — Bounded runs

Every prototype must self-bound:

- `maxActions` defaults to **5000** (set in library `makeHook` spec).
- `maxDurationMs` (sim time) defaults to **600000** (10 minutes sim).

If neither bound triggers `isOver()` and the game's own `isOver()` keeps returning false, the library forces `isOver()` true at the cap. The bot logs `timed_out: true` and the run is treated as inconclusive for that seed.

If `timed_out_rate >= 0.5` across a 200-run trial, the prototype is poorly bounded (either `isOver` is wrong, or `maxActions/maxDurationMs` are unrealistically high). The verdict is **not** automatic FAIL — `/gmk-validate` tells the user and lets them decide.

---

## Rule 10 — Validation kinds: `bot` and `self-test` (the only two)

Hypothesis `measured_by` rows declare `kind: 'bot' | 'self-test'`. **`kind: 'human'` is deprecated** as of v0.2.

| Kind | Who runs it | Where it lands |
|---|---|---|
| `bot` | `/gmk-validate` headless bots | `validation.metrics`, `validation.by_persona` |
| `self-test` | The **user themselves** playing | `self_test.sessions[]`, `self_test.latest_verdict` |

No external-human kind. No "send link to testers" channel. The kit's scope is **development complete**, which the user can attest to themselves; external feedback collection (Discord, Steam reviews, beta groups) is *outside* gmk. The user can collect that feedback through their own channels, but gmk has no skill for ingesting it.

If a v0.1 prototype's hypothesis header has `human:` rows, treat them as `self-test:` for v0.2 compatibility. The kit warns once and migrates.

---

## Rule 11 — Shape determines bot tractability

A prototype declares a **shape** in the hypothesis header (Rule 8): `grid | continuous | dialogue | shader`. The shape determines what `/gmk-validate` can do — and crucially what it *cannot*:

| Shape | Bot validation | Path when bot is weak |
|---|---|---|
| `grid` | Full — discrete action space, bot can enumerate `legalActions()` meaningfully. Default. | n/a (bot is the gate) |
| `continuous` | Partial — bot can sample but not exhaustively. Feel parameters dominate. | `feel-engineer` agent for sensory tuning; `/gmk-self-test` for the verdict |
| `dialogue` | Branch-coverage style — bot can walk every branch but can't judge whether the dialogue is *good*. | `/gmk-narrative` for spec; `/gmk-self-test` is the gate |
| `shader` | **None** — no decision space, no `act()` calls. `gmk-validate` immediately returns `INCONCLUSIVE` with reason `shader-shape-not-bot-gateable`. | The full chain becomes: `/gmk-prototype` (shader scaffold) → user iterates → `@feel-engineer` for parameter sweeps (uniform values, color anchors, motion timing) → `/gmk-self-test` is the *only* gate that produces PASS/FAIL. The dev-complete endpoint accepts a shader milestone with `validation: {skipped: true, reason: 'shader shape'}` + `self_test: PASS`. |

**Why this rule exists**: v0.2 introduced `shape: 'shader'` with a stub template but didn't name the validation path. Without an explicit path, users hit `/gmk-validate` → INCONCLUSIVE → silence. Rule 11 names the path so the user knows what gate replaces the bot gate.

---

## Rule 12 — HTML code generation is collaborative, not autonomous

`/gmk-prototype` produces a **scaffolded HTML file** — hypothesis header, single `<style>` block, single `<canvas>` or `<div>`, library reference, hook scaffold with required callbacks stubbed, line-cap enforcement. It does **not** produce a fully playable mechanic.

After scaffold generation, the user implements the actual mechanic logic by hand — usually in 30-150 lines of vanilla JS inside the `<script>` block. The kit deliberately leaves this part to the user:

| Why this is the line | Reason |
|---|---|
| Mechanics that survive validation are usually 200 lines or less | A human writing those 200 lines in their own head models the mechanic better than reading 200 lines a model wrote. |
| Prototypes evolve mid-implementation | The "ah, this isn't quite right" moment happens *while writing*, not before. Auto-generated mechanics shortcut that thinking. |
| Validation FAIL is honest only if the user wrote what was validated | A FAIL on auto-generated code is a debugging session about the *kit*, not the mechanic. |
| Engine port is the place for autonomous code generation | `/gmk-port` Stage 1 *does* generate code (with `systems-designer` agent for non-trivial systems). Engine code is the autonomous step; prototype code is the human step. |

This is consistent with `gmk-loop`'s Build gate, which says *"user writes"* — the prototype skill produces the spec + the scaffolding; the user writes the mechanic body. If the user wants help on a specific snippet inside the prototype, they ask Claude Code directly (outside this skill) — gmk doesn't have a "fill in the mechanic" subcommand and won't.

**Future direction**: if a future Wave wants to add active code generation here, it should be an explicit subcommand (`/gmk-prototype <id> --autocode`) with its own opt-in. The default remains scaffold-only.

---

## What violates these rules → what the kit does

| Violation | Detected by | Kit response |
|---|---|---|
| 2+ mechanics in one file | `gmk-prototype-rules` review (manual or `/gmk-prototype-rules --check`) | Refuse; suggest milestone split |
| Lines ≥ 600 | `gmk-prototype` line counter | Hard refusal; tell user to split |
| Lines ≥ 300, < 600 | Same | Warning comment in file, soft warning to user, continue |
| Non-deterministic | `/gmk-validate` 5-point smoke (#4) | Abort validation; print likely causes |
| Hook missing | `/gmk-validate` smoke (#1) | Abort; tell user to fix |
| API version mismatch | `/gmk-validate` smoke (#2) | Abort; point at library |
| External CDN imports | `gmk-prototype` linting (string match `https://`) | Warn; offer to inline |
| `Math.random()` in game logic | Pattern detection at validate time | Warn; suggest `__gmk.createRng` |
| `human:` row in hypothesis header | `gmk-prototype-rules --check` | Warn once, migrate to `self-test:` |

---

## What this skill does NOT do

- **Doesn't generate prototypes** — that's `/gmk-prototype`.
- **Doesn't run validation** — that's `/gmk-validate`.
- **Doesn't fix violations** — names them, lets the user decide.
- **Doesn't enforce conventions outside HTML prototypes** — engine code (Godot/Unity) has its own rules in `/gmk-port`. This rulebook is for HTML only.
- **Doesn't accept rule overrides** — there are no `--force` flags. If a rule is wrong for a use case, the kit isn't the right tool for that use case.

## Notes for the model running this skill

- **Cite this rulebook by section number when other skills enforce.** "/gmk-prototype refuses (Rule 2: hard cap 600 lines)." Citation gives the user a place to look.
- **Don't argue with violations.** A user pushing for 700 lines isn't a discussion — the rule exists because past prototypes at that size silently failed validation. Refer them to two-milestone split.
- **The library API version (`_gmkApiVersion: 1`) is load-bearing.** Wave B adds optional callbacks but stays at version 1 (additive only). If the API ever has a breaking change (Wave C+), bump to version 2 and the kit deprecates v1 prototypes loudly.
- **Skill-as-rulebook is unusual.** Most skills do something; this one *is* something. Other skills "speak this rulebook" the way library code speaks an interface.
- **Don't lecture about the rules.** They're rules. Either cite them or apply them. The user reads them in their own time.
