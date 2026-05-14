---
name: gmk-narrative
description: Draft a milestone's narrative spec — branch tree, dialogue volume per branch, tone constraints, and where the choices visibly diverge. For milestones whose mechanic IS narrative (visual novels, choice-based games, dialogue prototypes). Writes _workspace/milestones/<id>/narrative.md. Use when the user says "/gmk-narrative <milestone>", "branch tree", "dialogue spec", "분기 설계", "tone guide", or for a milestone with shape='dialogue'. Read-only on pillars.json + milestones.json; writes one markdown file. Optional skill — most kit games don't need it.
model: sonnet
---

# gmk-narrative — Map the branches, count the words, lock the tone

For most kit games (2D action / merge / arcade), narrative is a tiny ornament. This skill is **optional** — only useful when the milestone's *mechanic* is narrative (visual novel beat, dialogue-driven decision, story-vignette prototype).

When narrative IS the mechanic, the same falsifiable-hypothesis discipline applies, just on different metrics:

- Branch count
- Words per branch
- Visible divergence point
- Tone consistency across branches

Output: a markdown spec with the branch tree (textual), dialogue volume table, tone anchors, and divergence callouts.

## Preconditions

1. **Milestone exists** with `pillars_targeted` non-empty.
2. **Milestone's `shape: 'dialogue'`** OR the user explicitly invokes this skill on a non-dialogue milestone (rare — e.g., a merge game with optional flavor text).
   - If `shape !== 'dialogue'` and the user didn't ask: stop with *"This milestone's shape is `<shape>`, not 'dialogue'. /gmk-narrative is optional — most kit milestones don't need it. Continue with --force?"*
3. **Hypothesis touches narrative metrics.** If the hypothesis is purely about mechanical tension (no language signal), point at `/gmk-design-system` instead.

_Standard preconditions (milestone-id resolution, empty/partial state, refuse-chain cycle guard) follow `gmk-prototype-rules` Rule 13-14._

## Flow

### Step 1 — Read pillars → narrative implications

For each pillar, name the narrative implication:

- **Discovery-joy** → branches that reveal worldbuilding incrementally
- **Decision-tension** → branches that diverge visibly and stay diverged (not gradient-convergence)
- **Empathy / character** → branches that test the player's reading of a character
- **Calm/focus** → low-volume dialogue, no melodrama, pacing controlled by player input

Surface the chain. User may reject — accept once.

### Step 2 — Sketch the branch tree (textual)

A simple indented sketch. Use prose-friendly indentation rather than UML:

```
## Branch tree

[A] You meet the merchant. "What brings you here?"
  ├─ [B1] "Trade." → merchant nods, opens shop screen, no further branching.
  └─ [B2] "Just looking." → merchant studies you for 2 sec.
       ├─ [C1] "I have nothing to hide." → merchant grins. Reveal subplot.
       │       ├─ [D1] Subplot: stolen ring quest.
       │       └─ [D2] Subplot: nothing — merchant was bluffing.
       └─ [C2] [silent / wait] → merchant turns away. Quest closes.
```

Depth: 3-5 levels is typical for a milestone. Beyond 5, the milestone is overscoped — split via `/gmk-mechanic-merge`.

### Step 3 — Volume per branch

Each leaf and intermediate node gets a rough word count:

```
## Volume

| Node | Type             | Words (est) |
|------|------------------|-------------|
| [A]  | intro            | 25          |
| [B1] | trade flow       | 15          |
| [B2] | branch prompt    | 30          |
| [C1] | subplot reveal   | 80          |
| [C2] | silent close     | 10          |
| [D1] | quest setup      | 120         |
| [D2] | bluff reveal     | 60          |
| Total                   | 340 words   |
```

For 5-min sessions, total dialogue around **200-500 words** is right. Far less and the milestone is mechanical with text decoration; far more and pacing collapses (the user is reading, not deciding).

### Step 4 — Visible divergence point

The earliest moment the player can *see* their choice mattered. Crucial — if all branches feel equivalent for the first 90% of dialogue, the player's "decision-tension" pillar is unfed.

```
## Visible divergence

Branch B1 vs B2:
  Diverges immediately ([B1] opens shop, [B2] does not).

Branch C1 vs C2:
  Diverges visibly at C1 → "merchant grins" vs C2 → "merchant turns away."
  Both are within 1 line of the choice.

Branch D1 vs D2:
  Both lead to quest text in similar length, but D1 unlocks a follow-up
  mechanic while D2 closes the thread. The DIVERGENCE is in what's unlocked
  outside the dialogue, not the dialogue itself.
```

If a branch's divergence is "you saved 4 minutes of text," that's not a choice — flag it.

### Step 5 — Tone anchors

Three to five short statements that lock the milestone's voice. Examples:

```
## Tone anchors

- **Second-person address.** Player is "you," not the character's name.
- **No exclamation marks.** Even at moments of tension; the world is dry.
- **Merchant speech is clipped.** ≤ 12 words per line, even when revealing.
- **No fourth-wall breaks.** No menu references, no "as you click."
- **Past tense for narration, present for dialogue.**
```

Tone anchors carry across translations / localizations. If the milestone will be translated, surface this: *"Tone anchors translate; literal text doesn't. Translators see this section first."*

### Step 6 — Convergence risk callouts (optional)

The places branches accidentally converge — where two different paths land on indistinguishable states:

```
## Convergence risks

- [C1 → D1] and [C2] both end with "merchant nods you out." This is fine
  in the short term but means the player who chose silence is functionally
  in the same place as the player who got bluffed. Consider differentiating
  the exit lines.
```

### Step 7 — Write the spec

Path: `_workspace/milestones/<milestone-id>/narrative.md`. Overwrite.

Template:

```markdown
# Narrative — {milestone.id} {milestone.name}

> Generated: {timestamp} by /gmk-narrative.

## Pillars → narrative implications
- {pillar.id}: {implication}

## Branch tree
{textual indented sketch}

## Volume
{table per node}

## Visible divergence
{per-branch divergence callouts}

## Tone anchors
{3-5 short statements}

## Convergence risks
{optional}

## Next
- /gmk-task-split <id> — slot writing tasks per branch into the kanban
- /gmk-prototype <id>  — implement dialogue tree in HTML (shape='dialogue')
- /gmk-self-test <id>  — your own playthrough of all branches, note where choice felt empty
```

### Step 8 — Don't touch milestones.json

Working doc only. Branch-writing tasks land via `/gmk-task-split`.

## Output: tell the user what happens next

```
Narrative written: _workspace/milestones/m4-merchant/narrative.md
Branches: 5 leaves, 3 depth levels
Volume: 340 words total (within 200-500 target for 5-min sessions)
Visible divergence: 3 callouts (all within 1 line of choice — good)
Convergence risks: 1 flagged ([C1→D1] and [C2] both end at merchant-nods-you-out)

Next:
  - Decide whether to differentiate the converging exit lines (or accept the convergence as intentional)
  - /gmk-task-split m4-merchant — add writing tasks per branch
  - /gmk-prototype m4-merchant — implement in HTML (shape='dialogue')
```

## Sub-flags

| Flag | Default | Effect | Side-effect |
|---|---|---|---|
| `--force` | — | Runs the skill on milestones whose `shape !== 'dialogue'`. Without it, the skill refuses non-dialogue milestones (most kit milestones don't need narrative specs). One-shot override; nothing is stamped onto the milestone record. | None. |

## Edge cases & policy

### Branches are simpler than the skill assumes

If the milestone has 2 branches and 80 total words, the spec is one paragraph + a 2-row table. Don't pad to look thorough.

### Branches are deeper than 5 levels

Push back: *"This branch tree is 7 levels deep. Past 5 levels, players lose their thread and the milestone tests memory more than decision. Consider splitting into a follow-up milestone or collapsing similar choices."*

### The milestone uses procedural / generated dialogue

If dialogue is procedurally generated (e.g., a merchant whose lines come from a template), write the spec as **slot tables**: which slot, what tones, what's filled in. Not a branch tree per se, but the same discipline applies.

### Translation / localization concerns

If the user mentions translation, expand the tone anchors section with: *"Translators read tone anchors first. Don't translate idioms literally; preserve the anchor's intent in target language."* Out of scope for the kit to actually translate.

### The hypothesis doesn't have a narrative metric

If `hypothesis.measured_by` is purely behavioral (session length, action entropy) on a dialogue milestone, surface: *"This milestone is dialogue-shaped but the hypothesis measures behavior, not narrative. Either add a self-test row like 'remembers character X by name after first session' (qualitative), or accept that narrative quality won't be gated."*

### Convergence is intentional

Some narrative designs deliberately converge ("all paths lead to the same end, but you got there differently"). Accept once: *"Convergence flagged but you've named it intentional. Spec is locked as-is."*

## What this skill does NOT do

- **Doesn't write the dialogue.** The skill specs structure (branches, volume, tone). The user (or a writer) writes the actual lines.
- **Doesn't translate.** Spec language matches the user's source language.
- **Doesn't generate ASCII flowcharts.** Textual indented sketches only.
- **Doesn't gate on tone compliance.** That's `/gmk-self-test` (your own reading) and any future writing-review step.
- **Doesn't add to milestones.json.** Working doc.
- **Doesn't run on non-dialogue milestones by default.** Has to be `--force`d for unusual cases.

## Notes for the model running this skill

- **Most kit milestones don't need this.** Don't push it as default. It's listed as `选择` (optional) in the design doc for a reason.
- **Volume targets are floor + ceiling.** 200-500 words for 5-min sessions. Under 200 → dialogue feels skeletal; over 500 → pacing dies. Surface to the user when out of range.
- **Visible divergence is the trap.** It's the easiest narrative metric to whiff. Branches that diverge "in the player's head" don't count — the divergence has to land on screen.
- **Tone anchors travel; specific lines don't.** When in doubt, push to anchor-level specification rather than line-level.
- **Pillars first.** A milestone whose hypothesis is "the player feels tension before choosing" needs visible-divergence anchored — flag if the spec drifts toward gradient convergence.
- **Don't pad with literary advice.** This skill specs structure, not style. "Use vivid verbs" is over-direction; "≤12 words per line for the merchant" is in scope.
