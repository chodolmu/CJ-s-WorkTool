---
name: gmk-ux-flow
description: Draft a milestone's UX flow — menus, FTUE (first-time user experience), input mapping, and the minimum accessibility checks. Surfaces where the player gets stuck or confused before they reach the mechanic. Writes _workspace/milestones/<id>/ux-flow.md. Use when the user says "/gmk-ux-flow <milestone>", "FTUE", "first-time experience", "메뉴/조작", "input mapping", "accessibility check", or before /gmk-self-test on a milestone that requires onboarding. Read-only on milestones.json + design-system.md; writes one markdown file.
model: sonnet
---

# gmk-ux-flow — Land the player on the mechanic, not on a menu

Per `gmk-prototype-rules` §6, HTML prototypes shouldn't have title screens or menus — they land directly in the playable state. But the **engine port** doesn't get that luxury: a Godot/Unity build needs a "press start," a pause handler, an input scheme, and some minimum accessibility.

This skill writes down what the engine port's UX should be **before** the port — so the port doesn't accidentally bury the milestone's mechanic under three menu layers.

Output: a markdown file with **flow diagram (textual)**, **input map**, **FTUE** (first 30 seconds), **accessibility minimums**, and **failure modes** (where the player gets stuck).

## Preconditions

1. **Milestone exists** in `.gamemaker-kit/milestones.json` with `pillars_targeted` non-empty.
2. **Validation has run AND passed** (`validation.verdict === "PASS"`). UX flow for a failing prototype is putting bandages on a broken mechanic.
   - If validation is FAIL or absent: warn — *"Bot validation hasn't passed. UX flow on a not-yet-validated milestone is premature; the mechanic might not survive. Continue with --force or come back after /gmk-validate? [Rule 14] /gmk-ux-flow → /gmk-validate — verified target's preconditions can be satisfied from current state."* Allow override; the user might be planning ahead.
3. **Design system spec is helpful but not required.** If absent, the flow draws from the hypothesis + prototype.

_Standard preconditions (milestone-id resolution, empty/partial state, refuse-chain cycle guard, kit_version read contract) follow `gmk-prototype-rules` Rule 13-14, 16._

## Flow

### Step 1 — Recall the mechanic's "first interactive frame"

What's the first thing the player must do to engage the milestone's mechanic? Examples:

- Merge prototype: tap one dragon, drag onto another
- Dialogue prototype: read 1-2 lines, pick option
- Reflex prototype: avoid the first obstacle

This is the **landing target** — the screen state the player must reach within ~5 seconds of opening the game. Everything in the flow before this is overhead.

### Step 2 — Sketch the flow (textual)

A simple sequence with screen labels. Don't draw boxes-and-arrows; use plain text:

```
## Flow

[Start] → [Title screen] → [Tutorial step 1] → [Tutorial step 2] → [Mechanic active] → ...
```

Then annotate each transition:

```
- [Start] → [Title screen]
    Trigger: app launch
    Duration: <1 sec (no animation)
    Skip with: any input (per accessibility minimum below)

- [Title screen] → [Tutorial step 1]
    Trigger: any input
    Tutorial step 1 shows: "Tap a dragon to pick it up" with one dragon highlighted

- [Tutorial step 1] → [Tutorial step 2]
    Trigger: player taps any dragon
    Tutorial step 2 shows: "Drag onto another dragon to merge" with target highlighted

- [Tutorial step 2] → [Mechanic active]
    Trigger: first successful merge
    Tutorial overlay fades; player is in the mechanic
```

The whole flow should land at `[Mechanic active]` within 30 seconds for a first-time user, 5 seconds for a returning user (use a "seen this tutorial" save flag).

### Step 3 — FTUE (first 30 seconds)

What does the player see, hear, and do in the first 30 seconds? Be specific:

```
## FTUE (first 30 sec — first-time user)

0:00 — App opens, title fades in (1 sec), audio bed starts
0:01 — Title screen idles, prompts "Tap to start"
0:03 — Player taps; title fades out
0:04 — Mechanic screen appears with one tutorial overlay
0:05 — Tutorial step 1: "Tap a dragon to pick it up" + highlight on Dragon R
0:10 — Player taps Dragon R (or any dragon — be lenient)
0:11 — Tutorial step 2: "Drag onto another dragon" + highlight on Dragon G
0:15 — Player drags onto G, merge happens; tutorial overlay fades
0:16 — Player is in the mechanic. Score readout appears top-right.
0:30 — Most first-time players have completed 2-3 merges by now.
```

If the milestone's session-length hypothesis is "≥4 minutes," the FTUE must end well before the 4-min mark (rule of thumb: ≤30 sec). Otherwise the hypothesis tests the tutorial, not the mechanic.

### Step 4 — Input map

Per platform the user names, list bindings. Default to mouse + keyboard if the user hasn't said.

```
## Input map

### Mouse + keyboard (primary)
- Tap / left-click          select / pick up dragon
- Drag                       move dragon while held
- Release                    drop dragon (merge if on adjacent dragon, return-to-origin otherwise)
- Escape                     pause menu
- Space                      hard pause (testing aid, can disable in release)

### Touch (mobile target, if applicable)
- Tap                        same as click
- Drag                       same
- Two-finger pinch           pan (only relevant if the grid scrolls)
- Three-finger tap           pause (no Escape key)

### Gamepad (optional)
- D-pad / left stick         move cursor
- A / cross                  pick up / drop (toggle)
- Start                      pause
```

Surface bindings that violate platform conventions: *"Two-finger pinch for pan is iOS-style; on Android it's also typically two-finger pinch — but you specified one-finger drag for selection. Check that selection drag doesn't accidentally trigger pan."*

### Step 5 — Accessibility minimums

Five baseline checks. Pass/fail each — these are the floor; users can add more.

```
## Accessibility minimums

1. **Color blindness**: Distinct dragon tiers readable in grayscale (test by
   desaturating screenshots). If R and G dragons differ only in hue, FAIL —
   add shape variation per art-spec.
2. **Tutorial skippable**: Returning players (save flag set) skip the tutorial.
3. **Input redundancy**: No mechanic requires both a fast tap AND a precise
   drag in the same second. Slow inputs allowed.
4. **Pause anywhere**: Pause works in all states except active animations
   (animation completes, then pause).
5. **Text size**: Score readout and tutorial text ≥ 18px on the smallest
   supported screen.
```

These are not exhaustive accessibility (no screen-reader requirement, no motor-impairment full pass). They're the "won't humiliate yourself" floor.

### Step 6 — Failure modes / stuck states

Where might a first-time player get stuck? List 1-3:

```
## Failure modes

1. **Tutorial step 2 stall**: Player taps Dragon R but doesn't realize they
   need to drag. After 10 sec of no input, fade in a secondary hint:
   "Hold and drag onto another dragon."
2. **No legal merge available**: If the player picks up a dragon with no
   adjacent merge-partner, drop-on-empty should return to origin (not consume).
   Don't punish exploration.
3. **Score readout invisibility**: If the top-right has a notch (iOS), the
   score may be clipped. Test on notched displays at engine port.
```

These translate to engine-side test cases.

### Step 7 — Write the spec

Path: `_workspace/milestones/<milestone-id>/ux-flow.md`. Overwrite.

Template:

```markdown
# UX flow — {milestone.id} {milestone.name}

> Generated: {timestamp} by /gmk-ux-flow. Engine-port reference.

## Landing target
{What's the first interactive frame of the mechanic?}

## Flow
{textual sequence with transition annotations}

## FTUE (first 30 sec)
{timeline}

## Input map
{by platform}

## Accessibility minimums
{5 baseline checks}

## Failure modes
{1-3 stuck-state callouts}

## Next
- /gmk-task-split <id> — add UX tasks (engine-side menu/HUD/tutorial implementation)
- /gmk-port <id>      — port the validated mechanic; UX layer is built around it engine-side
- /gmk-self-test <id> — your own play session of the engine build, not the HTML
```

### Step 8 — Don't touch milestones.json

Working doc only. UX tasks land via `/gmk-task-split`.

## Output: tell the user what happens next

```
UX flow written: _workspace/milestones/m1-merge-feel/ux-flow.md
Flow: 4 screens, mechanic-active by ~16 sec FTUE
Input platforms: mouse+keyboard + touch (mobile)
Accessibility floor: 5/5 noted (color-blind grayscale check has a flag)
Failure modes: 3 surfaced

Notes:
  - The color-blind check is a flag: Dragon R and G differ only in hue per art-spec.
    Add shape variation OR document the accessibility miss explicitly.

Next:
  - /gmk-task-split m1-merge-feel — add UX implementation tasks (tutorial overlay, pause, input handler)
  - /gmk-port m1-merge-feel — port mechanic; UX is built engine-side around the validated core
```

## Sub-flags

| Flag | Default | Effect | Side-effect |
|---|---|---|---|
| `--force` | — | Runs the skill on a milestone whose validation hasn't passed (or is absent). One-shot override — the user may be planning the UX ahead of validation. Nothing stamped on the milestone record. | None. |

## Edge cases & policy

### The milestone is `shape: 'dialogue'`

Different FTUE shape — no drag-and-drop, just "press next, read, choose." The flow section is mostly the dialogue tree. Input map is just "any input advances; specific keys pick choices." Accessibility minimums include text size + auto-read pause + skippable.

### The milestone is `shape: 'continuous'` (reflexes)

FTUE must teach control mapping in the first 5 seconds because the mechanic moves regardless of input. Tighter than 30-sec budget — explicitly: *"Continuous-shape milestone: FTUE budget is 5-10 sec, not 30. Player needs control fluency before the first obstacle arrives."*

### The user wants no tutorial at all

Some milestones are deliberately discovery-first ("the player figures out the mechanic"). Write the FTUE accordingly — but flag once: *"No tutorial means the first 30 sec relies entirely on affordances. If `bored-after-30s` shows up in /gmk-self-test, this is the likely cause."*

### Cross-platform conflict

If the user wants identical input across platforms, surface conflicts. Mouse+keyboard has hover (preview tooltips); touch doesn't. *"Hover preview won't work on touch — either add a 'tap to preview, double-tap to commit' pattern or accept the platform asymmetry."*

### Re-running after a UI change

The skill always overwrites. Don't try to merge previous versions; the user has git history.

### Accessibility minimums failing

If the milestone categorically can't meet a check (e.g., color-only tier distinction), don't pretend it passes. Write FAIL inline with a one-line explanation. The user decides whether to fix or accept.

## What this skill does NOT do

- **Doesn't implement UI.** Specs only. Engine-side tutorial, pause, HUD are built during port.
- **Doesn't pick the platform set.** User declares; this skill specs.
- **Doesn't run a full accessibility audit.** Five baseline checks only — formal WCAG-style audit is out of scope for the kit.
- **Doesn't generate UI art.** That's `/gmk-art-spec` + `/gmk-art-gen`.
- **Doesn't add to milestones.json.** Working doc.

## Notes for the model running this skill

- **The landing target is the most important sentence.** A milestone whose first interactive frame is buried 60 seconds into menus has effectively failed before the mechanic even starts. Identify the landing target first, then work backward.
- **FTUE is timeline-shaped.** Use `0:00`, `0:05`, `0:15` format — not narrative paragraphs. The user reads timelines faster.
- **Accessibility floor, not ceiling.** Don't pad to look thorough; five concrete checks beat fifteen aspirational ones.
- **Per-platform input maps drift.** Touch users complain when you assume mouse-keyboard semantics (hover preview); gamepad users complain when you assume cursor latency. Match the user's named platforms exactly.
- **Don't reinvent menus.** "Press start" + "pause" + "settings (volume only)" is plenty for a milestone. The kit's scope is development-completion; menu polish is post-development.
- **Failure modes earn their place.** A flow that lists 8 failure modes is over-specified. 1-3 is the sweet spot.
- **Pillars affect FTUE.** A tactile-satisfaction milestone wants the first input to feel satisfying (the tutorial-tap should produce a small but noticeable response). A calm/focus milestone wants the tutorial muted. Apply the implication.
