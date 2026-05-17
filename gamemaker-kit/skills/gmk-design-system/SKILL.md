---
name: gmk-design-system
description: Draft a system-design spec for a milestone — name the systems, state machines, and data models the mechanic depends on, document inputs/outputs and invariants, surface coupling between systems. Writes to _workspace/milestones/<id>/design-system.md. Use when the user says "/gmk-design-system <milestone>", "system spec", "상태머신 그려줘", "data model for this milestone", or before /gmk-prototype on a mechanic with non-trivial state. Read-only on milestones.json; writes one markdown file. Skill produces a *spec*, not code — the user (or /gmk-prototype) implements.
model: sonnet
---

# gmk-design-system — Name the systems before you build them

A mechanic that fits in your head once but not twice is a mechanic that will collapse during validation. This skill makes you write down what's happening *before* the prototype talks you into something simpler than it actually is.

Output is a short markdown spec the user reads alongside the hypothesis. The spec names:

- The **systems** (~3-6 of them) the mechanic uses
- For each system, its **state** (data model) + **transitions** (state machine, where applicable)
- The **coupling** between systems — who reads whose state, who triggers whose events
- The **invariants** that must hold (e.g. "score never goes negative", "a merged dragon is never one of the parents")

Then it stops. No code, no implementation plan, no priorities. That's `/gmk-task-split`'s job downstream.

## Preconditions

1. **Milestone exists** in `.gamemaker-kit/milestones.json`. Read it.
2. **Hypothesis is set** on the milestone (`hypothesis.if`, `hypothesis.then` non-empty). If not: stop with *"This milestone has no hypothesis yet. Run /gmk-prototype to draft one first — the design spec needs a target. [Rule 14] /gmk-design-system → /gmk-prototype — verified target's preconditions can be satisfied from current state."*
3. **Pillars are bound** (`pillars_targeted` non-empty). The systems should serve at least one pillar.

The skill does NOT require a prototype to exist. Often this skill runs *before* `/gmk-prototype` to surface complexity early.

_Standard preconditions (milestone-id resolution, empty/partial state, refuse-chain cycle guard, kit_version read contract) follow `gmk-prototype-rules` Rule 13-14, 16._

## Flow

### Step 1 — Read the hypothesis aloud

Open the milestone. Re-read its IF / THEN. Identify the **subject** of the IF (what changes) and the **observable** of the THEN (what the player does/feels).

Example:
- IF: two dragons merging triggers 0.3s hit-stop + screen shake + 8-particle burst
- THEN: the player loses track of time within 5 minutes
- Subject of IF: "the merge event" — a discrete moment with three concurrent effects
- Observable of THEN: "time-loss" — behavioral, measured by session length

### Step 2 — Enumerate systems

From the subject + observable, list the systems involved. A system is anything with **its own state and rules that change that state**. Keep it small — 3 to 6 systems is the sweet spot for a milestone. More than 6 → milestone is overscoped; refer back to `gmk-mechanic-merge` (probably should've been split).

For the merge example:

1. **Grid system** — holds cells, knows which has which dragon
2. **Merge resolver** — given two adjacent dragons, decides if they merge and what they produce
3. **Feel module** — hit-stop scheduler + screen-shake driver + particle emitter
4. **Score tracker** — single scalar, monotonic
5. **Session timer** — sim-time clock, used only by `summary()`

If a "system" turns out to be a single variable with no transitions, it's not a system — fold it into whoever uses it. If a system has 15 fields, it's probably two systems pretending to be one — split.

### Step 3 — For each system, draw state + transitions

Use a small table per system:

```
## Grid system
State:
  cells: { [x,y] → dragonId | null }
  width, height: int constants

Transitions:
  placeDragon(x, y, dragonId)
    pre:  cells[x,y] is null
    post: cells[x,y] = dragonId
  removeDragon(x, y)
    pre:  cells[x,y] !== null
    post: cells[x,y] = null
```

For systems with discrete modes (a game phase: `playing | paused | over`), draw a state machine:

```
## Game phase
States: idle → playing → over

Transitions:
  idle → playing   on startGame()
  playing → over   when isOver() returns true
  over → idle      on reset (next startGame call)
```

You don't need ASCII boxes-and-arrows; the textual form above is the kit's convention. If a state machine has more than 5 states, it's two state machines stacked.

### Step 4 — Couple them honestly

For each pair of systems where one reads or writes the other's state, write one line:

```
## Coupling
- Merge resolver reads grid.cells; on a merge, writes to grid (remove two, place one),
  then notifies feel module + score tracker.
- Feel module reads nothing from grid — it only receives merge events.
- Score tracker reads nothing — it only receives `+N` notifications.
- Session timer is independent of everything; ticks via bot's act() calls.
```

This is the section that usually surprises the user. Hidden couplings (the feel module secretly reading the grid to color particles by dragon species) are where prototypes go off-rails. Name them.

### Step 5 — State invariants

For each system OR coupling, state the invariants that must hold at all times — the things that, if violated, mean the prototype is broken:

```
## Invariants
- Grid: no cell holds two dragons (cardinality 0 or 1).
- Merge: a merged dragon's species is deterministic from the two inputs (used by /gmk-validate determinism check).
- Score: monotonic non-decreasing (the merge mechanic never subtracts).
- Session timer: advances only on bot's `act()` calls — wall-clock is irrelevant (per gmk-prototype-rules §3).
```

Invariants double as the **test list** for `/gmk-validate`'s assertions. If an invariant can't be checked from `summary()` or a `stateSignature()`, the user may want to add a `custom` metric in the hook so it can be.

### Step 6 — Risk callouts (1-3 max)

The systems with the highest collapse risk in this milestone. Optional but recommended — surfacing risk now is much cheaper than discovering it mid-validate.

```
## Risk callouts
- Feel module's hit-stop scheduler is the most error-prone piece — non-deterministic
  timer use here will fail /gmk-validate's determinism check.
- Coupling between merge resolver and grid: a merge that removes two but fails to
  place the result violates the grid invariant. Add an assertion.
```

### Step 7 — Write the spec

Path: `_workspace/milestones/<milestone-id>/design-system.md`. Create the directory if needed. **Overwrite** if it already exists (this is the latest spec; the user has git history for previous versions).

Template:

```markdown
# Design system — {milestone.id} {milestone.name}

> Generated: {timestamp} by /gmk-design-system. Read alongside the hypothesis. Re-run after substantive design changes.

## Hypothesis (for context)
- IF:   {hypothesis.if}
- THEN: {hypothesis.then}
- Pillars: {pillars_targeted joined by ', '}

## Systems
{N systems, each with State + Transitions tables}

## Coupling
{one-line statements per coupling}

## Invariants
{bullets}

## Risk callouts
{1-3 bullets, optional}

## Next
- {/gmk-task-split <id> — translate this spec into per-discipline tasks}
- {/gmk-prototype <id> — implement the systems in HTML if not already done}
- {/gmk-shape-advisor <id> — pick the prototype shape if not chosen yet}
- {@systems-designer <id> — produce strict system-spec.md, if Step 9 heuristics fired}
```

### Step 8 — Don't touch milestones.json

This skill writes only the markdown file. It does NOT add fields to `milestones.json`. The spec is a working document for the user (and for `/gmk-task-split` to read); it's not part of the gating data model.

### Step 9 — Hand off to `systems-designer` when the system is non-trivial

`gmk-design-system` produces the **user-facing** design spec. The `systems-designer` agent produces a **stricter** system spec (`_workspace/milestones/<id>/system-spec.md`) that downstream skills cite: `gmk-prototype` reads it before coding the prototype, and `gmk-port` Stage 1 reads it before generating engine code.

After writing `design-system.md`, decide whether to route to `systems-designer`:

| Condition | Action |
|---|---|
| Systems count ≥ 4, OR any system has ≥ 5 named states, OR ≥ 3 coupling lines | Recommend `@systems-designer <milestone-id>` next. The downstream skills (`gmk-prototype`, `gmk-port`) will be cleaner with a strict spec. |
| Systems count ≤ 3 AND no state machine has > 3 states AND ≤ 2 coupling lines | Skip — the spec you just wrote is enough. Adding `system-spec.md` here is overhead. |
| Milestone has `shape: 'shader'` | Skip — shader milestones have a single tiny system; `system-spec.md` is overkill. |
| User explicitly asks for the strict spec | Route to `systems-designer` regardless of the heuristics above. |

If routing: the recommendation goes in the "Next" block (Step 7 template). Don't auto-invoke — surface the route and let the user decide. The user runs `@systems-designer <milestone-id>` themselves.

_The routing output follows `gmk-prototype-rules` Rule 15 (agent routing block format)._

## Output: tell the user what happens next

```
Design system spec written: _workspace/milestones/m2-dragon-evo/design-system.md
Systems named: 5 (Grid, Merge resolver, Feel module, Score tracker, Session timer)
Coupling lines: 4
Invariants:     4
Risk callouts:  2

Next:
  - /gmk-task-split m2-dragon-evo — break into per-discipline tasks
  - /gmk-prototype m2-dragon-evo  — implement the systems in HTML (if not already)
```

## Edge cases & policy

### Hypothesis is too vague to enumerate systems

If the IF is "the game has a satisfying merge" with no specifics, stop. *"The hypothesis is too vague to enumerate systems. Sharpen the IF first — what exactly happens at merge time? Then re-run."* Don't invent systems to fill the gap.

### Milestone is a feel-only one (e.g. `shape: 'shader'`)

Shader milestones often have one "system" (the shader itself, with a few uniforms). That's fine — write the one system spec, omit Coupling if there's nothing to couple. The spec stays short on purpose.

### Two milestones overlap heavily on systems

If running this skill on m2 produces a system list that's 80% identical to m1's spec, the milestones share scope. Flag it: *"This milestone's systems overlap heavily with m1. Consider merging the milestones via /gmk-mechanic-merge, or sharpen the boundary."* Don't auto-merge.

### Re-running after design changes

The skill always overwrites the file. The user has git history. Don't try to diff or merge previous versions.

### Asking the user for system names

The skill drafts the system list itself; it doesn't interview the user system-by-system. If a system call is ambiguous, ask one targeted question (*"Is the merge resolver a separate system from the grid, or one combined?"*) — don't multi-step interview.

## What this skill does NOT do

- **Doesn't write code.** Specs only. Implementation is `/gmk-prototype`'s job.
- **Doesn't pick the shape.** That's `/gmk-shape-advisor`.
- **Doesn't break into tasks.** That's `/gmk-task-split`.
- **Doesn't add to `milestones.json`.** The spec is a working doc, not part of the gating data model.
- **Doesn't generate ASCII diagrams.** Text tables only — easier to maintain, easier to read in VSCode.
- **Doesn't enforce a particular system count.** 3-6 is the sweet spot; 7+ is a smell but allowed if the user insists.

## Notes for the model running this skill

- **Resist over-systematizing.** If the user has a 10-line merge prototype in mind, the spec is 5 systems and 200 words, not 8 systems and 1500 words. The spec is calibrated to the milestone's actual scope.
- **Invariants are the keepable artifact.** Even after the prototype evolves, the invariants usually still hold. Take time on those — risk callouts and system tables decay faster.
- **Coupling is where the surprise lives.** Push the user to name the couplings they didn't notice. Hidden coupling (e.g. the score tracker secretly reading the grid for "bonus per cell") is the most common reason a milestone fails validation in a confusing way.
- **Don't lecture about software architecture.** This isn't a design-patterns class. Plain language, tables, done.
- **If the user pushes back on a system call** ("the grid and the resolver are the same thing"), accept once and re-write. Don't argue twice — the user knows their mental model better than you.
