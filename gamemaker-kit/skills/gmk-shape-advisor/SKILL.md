---
name: gmk-shape-advisor
description: Given a milestone's hypothesis, recommend the prototype shape — grid / continuous / dialogue / shader — with explicit reasoning about action space, time model, hook complexity, and bot validation difficulty. Use when the user says "/gmk-shape-advisor", "which shape should I use", "what type of prototype", "어떤 모양으로 만들어야 해", or before running /gmk-prototype on a milestone whose shape isn't obvious. Pure read of milestones.json — does not modify files.
model: sonnet
---

# gmk-shape-advisor — Pick the right prototype shape

Four shapes exist. They are **not interchangeable** — pick wrong, and:

- The hook API doesn't fit the mechanic naturally (you fight the library).
- The bot policy doesn't apply (`random` on dialogue produces gibberish; `MCTS` on continuous explodes).
- `/gmk-port` 5-stage validation produces noisy metric diffs.

The right shape is usually one of these. Sometimes a mechanic legitimately straddles two — the advisor names that case and lets the user pick.

## The four shapes

| Shape | Action space | Time model | Hook complexity | Bot policy fit |
|---|---|---|---|---|
| **grid** | Discrete, small (typically < 50 actions per state) | Turn-based: state advances only on `act()` | Easiest — `legalActions()` returns a tight array | random / MCTS / persona-mix |
| **continuous** | Discrete actions, but **time-driven** (player input at any moment) | Real-time-ish: `act()` advances sim by one tick | Medium — bot ticks at fixed rate; "noop" is a legal action | random + tick-rate; MCTS rarely useful |
| **dialogue** | Discrete choices (visual novel, branching) | Discrete steps, no time pressure | Easy — `legalActions()` = dialogue options | random for coverage; MCTS not useful (no game-state pressure) |
| **shader** | One main "knob" (visual feel, particle counts, timing constants); minimal play loop | n/a — visual test, not gameplay test | Special — hook is mostly inert; bot exists to run the shader and pixel-diff against a baseline | n/a (visual diff, not action play) |

## Preconditions

1. **A milestone exists.** Skill input: `<milestone-id>`. If no milestone given and `pillars.json` exists, ask the user which milestone to advise on.
2. **The milestone has a hypothesis (`IF` and `THEN`).** Without it, the advisor has nothing to reason from. Stop: *"Milestone {id} has no hypothesis yet. Run /gmk-prototype first (it'll prompt you), or write the IF/THEN by hand in milestones.json. [Rule 14] /gmk-shape-advisor → /gmk-prototype — verified target's preconditions can be satisfied from current state."*

_Standard preconditions (milestone-id resolution, empty/partial state, refuse-chain cycle guard, kit_version read contract) follow `gmk-prototype-rules` Rule 13-14, 16._

## Flow

### Step 1 — Read the hypothesis

Pull from `milestones.json`:
- `hypothesis.if` — the mechanic
- `hypothesis.then` — the observable behavior or feel
- `hypothesis.measured_by` — what the bot/self-test measure
- `pillars_targeted` — for sanity-check at the end

Show them back to the user before advising. Sometimes seeing the hypothesis re-read clarifies which shape is wrong.

### Step 2 — Apply the decision tree

Walk these questions in order. **Stop at the first that resolves.**

#### Q1. Is the mechanic about visual feel (shader, particles, color shift) and *not* about player decisions?

Examples:
- *"Tune hit-stop + particle burst for chunky merge feel"* — but the *decisions* are made elsewhere; this milestone is purely visual tuning.
- *"Shader-based water deformation feels alive"*
- *"Day/night transition timing"*

If **yes** → **shader shape**. Note: shader is rare. Most milestones have a play loop; only pure-visual tuning milestones are shader-shape. If the user's hypothesis includes any decision-making, it's not shader.

#### Q2. Is the player choosing between dialogue/text options with no time pressure?

Examples:
- *"Branching narrative where the player's choices affect a relationship stat"*
- *"Visual novel with a tone variable"*

If **yes** → **dialogue shape**. Dialogue is also rare for the kit's typical user (2D action/puzzle games); if the user's pillar is *tactile satisfaction* or *greed vs safety*, it's almost certainly not dialogue.

#### Q3. Does the hypothesis name **time pressure**, **reflexes**, or **continuous movement**?

Markers in the `THEN` or `MEASURED BY`:
- "session length", "time between actions", "frame budget"
- "dodge", "reaction time", "rhythm"
- "player keeps moving / scrolling"

Examples:
- *"Crossy Road dodge under increasing speed"*
- *"Tap-rhythm matches the music BGM"*
- *"Continuous chase where pause = death"*

If **yes** → **continuous shape**. Bot will tick at a fixed rate (default: 60 sim ticks/sec); "noop" is in `legalActions()`.

**Edge case**: if the hypothesis names time pressure but the player input is *also* discrete moves (e.g., turn-based with a per-turn timer) — that's still **continuous shape**, because the bot has to advance time even when not acting.

#### Q4. Does the mechanic have a **small, fully-enumerable action space** at every state?

Markers:
- "merge two adjacent items"
- "place a piece on the grid"
- "play a card from hand"
- "pick a route on a node graph"

If **yes** → **grid shape**. Includes card games, deck builders, puzzle games, turn-based strategy.

#### Default → grid shape

If none of Q1–Q3 resolved and Q4 was yes (or ambiguous-but-leaning-discrete) → **grid**. Grid is the most common shape and the bot tools work best on it.

### Step 3 — Detect cross-shape mechanics

Some mechanics legitimately straddle. Detect and surface:

| Pattern | Why it straddles | Recommendation |
|---|---|---|
| Grid game with a turn timer | Time pressure on a discrete board | Pick **continuous** if the timer is *the* mechanic; **grid** if the timer is decoration |
| Roguelike combat (grid moves) + level-up dialogue | Two play loops | This is **two milestones**, not one mixed-shape prototype. Route to `/gmk-roadmap` or `/gmk-mechanic-merge` |
| Continuous game with discrete "phase" transitions | Mostly continuous, some grid moments | Pick **continuous**; handle phase transitions as state in `act()` |
| Visual tuning + a play loop ("does this hit-stop feel right while merging") | Shader-ish + grid-ish | Pick **grid** with the visual tuning as part of the mechanic. Don't split — the *feel* only validates *during play* |

If detected, name it explicitly:

> "Heads-up: this mechanic straddles **grid** and **continuous** (it has discrete moves but a turn timer). Recommendation: pick *continuous* if the timer is the mechanic; *grid* if the timer is decoration. Which is the timer here?"

Let the user pick. Don't auto-decide on a straddle.

### Step 4 — Reason about hook complexity & bot policy

For the recommended shape, walk through what the user is committing to:

**grid example**:

```
Recommended: grid

Hook implementation:
  reset(seed, rng):    init the board, seed the RNG
  isOver():            true when board is full or score >= target
  legalActions():      enumerate every legal merge for the current board
  apply(action):       perform the merge, recalc score
  collectSummary():    return { score, custom: { merges_done, longest_chain } }

Bot policy:
  random           default — fast, fine for "is this a real choice"
  mcts             worth it if legalActions is small and decisions matter
  persona-mix      Wave B: 4 personas × 50 runs

Optional callbacks (Wave B):
  stateSignature   strongly recommended — board signature for state coverage
  progressEstimate not useful (no "goal" direction)
  riskEstimate     useful if there's lose-condition pressure (Survivor persona)
  noveltyScore     useful if the hypothesis is about discovery
```

**continuous example**:

```
Recommended: continuous

Hook implementation:
  reset(seed, rng):    init the world
  isOver():            true when player dies / timer expires / score target reached
  legalActions():      [ {type:'left'}, {type:'right'}, {type:'noop'} ]  — ALWAYS include noop
  apply(action):       advance sim by one tick AND apply player input
  collectSummary():    return { score, custom: { distance, avg_speed } }

Bot policy:
  random + tick-rate   default; bot picks left/right/noop each tick
  mcts                 RARELY useful (action × time blows up)

Optional callbacks (Wave B):
  riskEstimate     critical for Survivor persona (collision proximity)
  progressEstimate fits naturally (distance / max-distance)
```

**dialogue example**:

```
Recommended: dialogue

Hook implementation:
  reset(seed, rng):    start at root dialogue node
  isOver():            true when terminal node reached
  legalActions():      current node's choices
  apply(action):       advance to chosen child node
  collectSummary():    return { score: null, custom: { path_taken, final_stats } }

Bot policy:
  random for coverage  default; just trace all paths

Optional callbacks (Wave B):
  noveltyScore     useful if the hypothesis is "do players find unique branches?"
```

**shader example**:

```
Recommended: shader

Hook implementation:
  reset(seed, rng):    set seed for shader uniforms (RNG offsets, time)
  isOver():            true after rendering N frames at fixed seed
  legalActions():      typically empty (this is rendering, not interactive)
  apply(action):       not called
  collectSummary():    return { score: null, custom: { canvas_data_url } }

Bot validation:
  Pixel diff against a saved baseline (visual diff, not behavioral)
  Or: parametric sweep — render the shader across a range of uniform values

This shape is special. Most kit users won't need it.
```

### Step 5 — Write recommendation to `milestones.json`

Update the milestone's `shape` field:

```json
{
  "id": "m2-dragon-evo",
  "shape": "grid",
  ...
}
```

`/gmk-prototype` reads this field to pick the template (`prototype-grid.html`, `prototype-continuous.html`, `prototype-dialogue.html`, `prototype-shader.html` — the last lands in Wave D).

### Step 6 — Print the recommendation

```
Recommended shape: grid

Why:
  - Action space is discrete and fully enumerable (merge any two adjacent cells).
  - No time pressure in the hypothesis.
  - The hypothesis is about *decisions* (which to merge), not *feel* (how the merge looks).

Bot policy: persona-mix (default). MCTS available if you want to verify "optimal" play also validates.

Optional callbacks worth implementing (Wave B):
  - stateSignature  (board hash) for state-coverage metric
  - noveltyScore    (since pillar is discovery-joy)

Next: /gmk-prototype m2-dragon-evo  — uses the grid template, asks for hypothesis-specific metrics.
```

## Edge cases & policy

### User disagrees with the recommendation

Accept. The advisor recommends; the user decides. Update `milestones.json` with the user's pick and note in the response: *"Going with continuous despite no time pressure in the hypothesis — let me know if the bot policy struggles."*

### Hypothesis is too vague to advise on

Push back once: *"The hypothesis 'IF merging dragons feels good THEN players keep playing' doesn't say enough about the mechanic to pick a shape. Want to sharpen the IF first (e.g., 'two adjacent same-tier dragons can be merged into one of the next tier')?"*

If the user insists on advising, default to **grid** with a warning that the shape recommendation has low confidence.

### Mechanic that *doesn't fit any shape*

Real but rare. Examples:

- "Multiplayer asymmetric stealth" — gmk doesn't support multiplayer (Phase 3). Refuse: *"The kit supports single-player only in v0.2. Multiplayer mechanics need a different toolchain."*
- "Procedural music generation" — Phase 3 audio. Refuse politely.
- "VR motion control feel" — out of scope. Refuse.

The kit's `supported_genres_check` in `pillars.json` is the gatekeeper. If the user got past `/gmk-init` with all three checks passing, but the milestone is for a 3D-multiplayer-VR thing, surface the contradiction: *"Your `pillars.json` says 2D + deterministic-input + ≤5min — this milestone violates 2/3 of those. Either the genre check was wrong at init, or this milestone is outside the kit's supported scope."*

### Shape disagreement between milestones in the same project

Allowed and normal. m1 can be grid, m2 can be continuous. Don't enforce shape consistency across a project.

### Re-running on a milestone with shape already set

OK — the user might be reconsidering. Show the current shape:

```
Current shape: continuous
Re-evaluating based on current hypothesis...
Recommended: grid

Reason for change: the hypothesis was edited to remove the time-pressure clause.
Update shape from 'continuous' to 'grid'?
```

Wait for explicit confirmation before overwriting. Shape changes invalidate the existing prototype HTML (if any) — point that out:

> "Changing shape from continuous to grid will require regenerating the prototype HTML. Your current `prototypes/m2-dragon-evo.html` (181 lines) uses the continuous template. Either:
>   - Keep shape = continuous (no regen)
>   - Change to grid and run /gmk-prototype m2-dragon-evo --regen (will prompt before overwriting)"

## What this skill does NOT do

- **Doesn't generate the prototype** — `/gmk-prototype` does that with the recommended shape.
- **Doesn't validate existing prototypes against the shape** — that's `/gmk-validate`'s smoke-check step.
- **Doesn't recommend bot policy** — surfaces the default; user picks at `/gmk-validate` time with flags.
- **Doesn't enforce single shape per project** — multi-shape projects are normal.
- **Doesn't advise on game design** — sticks to *shape*. "Is this mechanic any good" is `/gmk-brainstorm` territory.

## Notes for the model running this skill

- **The decision tree is the skill.** Don't editorialize; walk the questions in order and stop at the first match.
- **Straddle cases need user input.** Don't auto-pick. Surface the straddle, ask, then commit.
- **Shape isn't a quality marker.** Continuous isn't "harder" than grid; dialogue isn't "easier." Each fits a class of mechanics.
- **Shader is rare. Don't recommend it casually.** A milestone that's "tune the merge animation" is **grid** with hit-stop as part of the mechanic — not shader. Shader is for milestones where there's no play loop at all (e.g., "make the water surface feel alive on idle").
- **Bot policy advice is part of shape advice.** Telling the user "grid" without naming "use persona-mix" leaves them under-equipped. Always include the bot policy line.
- **Optional callbacks are worth recommending up-front** — the user is more likely to implement them while writing the prototype than to bolt them on after the bot is failing.
