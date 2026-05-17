---
name: gmk-content-plan
description: Compute how much content a milestone needs and how it should curve over a session — number of distinct elements, when each appears, what the progression slope looks like, where the difficulty bumps land. Writes _workspace/milestones/<id>/content-plan.md with a simple curve table. Use when the user says "/gmk-content-plan <milestone>", "how many enemies", "컨텐츠 양", "progression curve", or before /gmk-prototype on a milestone whose hypothesis depends on volume (5 minutes of dragons, 30 unique waves, 12 dialogue branches). Reads pillars.json and the milestone hypothesis; writes one markdown file.
model: sonnet
---

# gmk-content-plan — How much, in what order, peaking when

Some milestones live or die on **volume**. A merge prototype that runs out of unique dragons by minute 2 fails the time-loss hypothesis regardless of how good the merge feels. A dialogue branch that converges back to the same node after one choice produces no decision tension. This skill makes you reason about volume + ordering *before* you discover you didn't have enough at validate time.

The output is a small table with three columns: **time/checkpoint**, **content delivered by then**, **delta from previous**. Plus a short prose section on **the difficulty/intensity curve** and **where the cliff is** (the moment the milestone breaks if it lasts past it).

That's it. No production schedule, no asset list (that's `/gmk-art-spec` and `/gmk-task-split`). Just the curve.

## Preconditions

1. **Milestone exists** with hypothesis populated.
2. **Hypothesis touches volume** (session length, count of distinct things, progression). If the hypothesis is purely about feel of a single moment (e.g. "the merge moment is satisfying"), this skill isn't useful — tell the user *"This milestone's hypothesis is about a single moment, not progression. /gmk-content-plan is for milestones whose hypothesis depends on volume/curve. Skip this; go to /gmk-prototype."*
3. **Pillars are bound.** The curve should serve the pillars.

_Standard preconditions (milestone-id resolution, empty/partial state, refuse-chain cycle guard, kit_version read contract) follow `gmk-prototype-rules` Rule 13-14, 16._

## Flow

### Step 1 — Read what the hypothesis assumes about volume

Open the hypothesis. Extract the implicit volume requirements:

- "session length > 4min" → the player has enough to do for ≥ 4 minutes
- "5 minutes to first new species" → there's a new species at ~5min, and another after
- "12 dialogue branches" → 12 distinct branches must exist by the end
- "3 difficulty bumps before frustration" → 3 bumps spaced through the session

Surface the volume assumptions back to the user: *"Your hypothesis implies you need at least N {dragons | enemies | branches}. Sound right?"* If they say no, ask them to refine the hypothesis. If they say yes, that's the **target count**.

### Step 2 — Pick the curve shape

Five shapes the kit recognizes (more than enough for 95% of milestones):

| Shape | What it is | Pillars it usually serves |
|---|---|---|
| **flat** | constant rate — N elements per minute, no escalation | mood/exploration pillars; "feel-good loop" |
| **stairs** | discrete jumps — every K events, a new tier unlocks | discovery pillars; "what's next" loops |
| **ramp** | continuous intensity escalation | challenge pillars; arcade dodgers |
| **wave** | rising + falling pulses — peaks of intensity with rest beats | survival pillars; risk-recover loops |
| **bell** | rises to a single climax then resolves | narrative/story pillars; one-shot encounters |

Ask the user which shape (offer the 5 as multiple choice via AskUserQuestion — max 4 options at a time per harness rule, so present the most likely 3 + "other"). If they're unsure, infer from the hypothesis's THEN clause (time-loss + discovery → stairs; reflex-survival → ramp).

### Step 3 — Lay out the curve table

Pick 3-6 checkpoints on the session timeline (depending on session length). Default: **0min, 1min, 2min, 4min, 8min** (compressed for ≤ 5min sessions per gmk's supported-genres-check).

For each checkpoint, fill three columns:

```
| At time | Content live by then            | Delta from previous |
|---------|---------------------------------|---------------------|
| 0:00    | 3 dragon species (R/G/B)        | (start)             |
| 1:00    | 3 species + first merge unlocked| +1 unlock event     |
| 2:00    | 5 species (added Y, P)          | +2 species          |
| 4:00    | 7 species (added W, K) + tier-2 | +2 species, +1 tier |
| 8:00    | 9 species + tier-3 boss         | +2 species, +1 tier |
```

**"Content live by then" is cumulative, not incremental.** The user reads this as "after 4 minutes the player has seen…" not "between 2 and 4 minutes the player saw…"

### Step 4 — Name the cliff

The **cliff** is the time at which the milestone's volume runs out — the moment the prototype starts repeating, becomes trivially solvable, or runs out of new things to show. Almost every content-driven milestone has one. Name it:

```
## The cliff
At ~6 minutes, the player has seen all 9 species and exhausted the tier progression.
After this point, the merge mechanic still functions but the discovery-joy pillar
stops being fed. If the hypothesis is "session length > 4min", the cliff is past
the target — fine. If "session length > 10min", the cliff is the target — not fine.
Plan accordingly.
```

If the user's hypothesis target is past the cliff, that's a flag: *"Your target session length (10min) is past this milestone's cliff (~6min). Either narrow the hypothesis target, add content, or accept that the long tail of the session won't strengthen any pillar."*

### Step 5 — Identify difficulty/intensity bumps

For curves with non-flat shape (ramps, waves, bells), mark where the bumps land relative to the user's known thresholds:

```
## Intensity bumps
- 0:30  introductory bump (teach the mechanic)
- 2:00  tier-2 unlock — primary discovery moment
- 4:00  speed increase (continuous tick rate +20%)
- 6:00  cliff (no new content)
```

For flat curves, just write `Intensity: flat throughout.`

### Step 6 — Write the spec

Path: `_workspace/milestones/<milestone-id>/content-plan.md`. Overwrite if exists.

Template:

```markdown
# Content plan — {milestone.id} {milestone.name}

> Generated: {timestamp} by /gmk-content-plan.

## Hypothesis (for context)
- IF:   {hypothesis.if}
- THEN: {hypothesis.then}
- Pillars: {pillars_targeted}

## Volume assumption
{1-2 sentences naming what the hypothesis implicitly requires}

## Curve shape
{flat | stairs | ramp | wave | bell} — {1-sentence why this fits}

## Curve table
| At time | Content live by then | Delta from previous |
|---------|---------------------|---------------------|
| ... | ... | ... |

## Intensity bumps
- {time}: {description}
- ...

## The cliff
{time and what happens past it; flag if target session length is past it}

## Next
- {/gmk-prototype <id> — implement the first 1-2 checkpoints of content}
- {/gmk-task-split <id> — split content production by discipline}
- {/gmk-art-spec <id> — name the visual assets for each species/wave/branch}
- {@economy-balancer <id> — set the actual numbers underneath the curve shape (XP per tier, drop rates, cap tightness), if Step 6.5 fires}
```

### Step 6.5 — Route to `economy-balancer` when the curve has numeric knobs

A curve shape (`stairs`, `ramp`, `wave`, `bell`) is a *shape* — the numbers underneath (how many XP per tier, what drop rate, what cap value) need separate decision-making. The `economy-balancer` agent owns that.

| Trigger | Recommend `economy-balancer`? |
|---|---|
| Curve shape is `stairs` AND the table has tier counts / unlocks / numeric thresholds | Yes |
| Curve shape is `ramp` OR `wave` AND the underlying mechanic has costs / drop rates / numeric tunables | Yes |
| Curve shape is `bell` with a numeric climax (boss HP, peak spawn rate, etc.) | Yes |
| Curve shape is `flat` AND no numeric knobs in the mechanic | Skip — nothing to balance |
| Hypothesis lacks a `kind: 'bot'` numeric `measured_by` row | Skip — `economy-balancer` will refuse anyway (no anchor metric). The user must add a row via `/gmk-prototype` first. |

If routing: surface in the "Next" block. Don't auto-invoke; the user calls `@economy-balancer <id>`. The agent's preconditions (numeric measured_by row, system spec) must be satisfied — name them in the recommendation so the user knows what to set up first.

_The routing output follows `gmk-prototype-rules` Rule 15 (agent routing block format)._

### Step 7 — Don't touch milestones.json

Working doc only. The hypothesis already declares the volume target — this skill just makes the path to that target explicit.

## Output: tell the user what happens next

```
Content plan written: _workspace/milestones/m2-dragon-evo/content-plan.md
Curve: stairs, 5 checkpoints, cliff at ~6:00
Volume target: 9 species + 3 tiers by 8:00

Notes:
  - Hypothesis target (5min) is before the cliff (6min). Margin: 1 min — tight.
  - Consider whether the tier-2 unlock at 2:00 lands early enough for first-time
    players to reach it consistently.

Next:
  - /gmk-art-spec m2-dragon-evo  — name 9 species + tier visuals
  - /gmk-task-split m2-dragon-evo — split into per-discipline tasks
  - /gmk-prototype m2-dragon-evo  — implement first 1-2 checkpoints
```

## Edge cases & policy

### Hypothesis target is way past the cliff

If the user wants a 30-minute session but the milestone's plausible content cliff is 8 minutes, don't pretend the plan covers it. Surface the gap loudly: *"Your hypothesis target is 4x the milestone's content cliff. Two options: (1) shrink the target to the cliff plus a little margin, or (2) plan a follow-up milestone that picks up where this one's content ends."*

### Single-element milestones

A milestone with one dragon species and one mechanic doesn't have a curve in the volume sense. Tell the user *"This milestone has no volume axis to plan against. Skip /gmk-content-plan; go straight to /gmk-prototype."* Don't fabricate stairs out of single steps.

### Curve and pillar mismatch

If the user picks a ramp curve but the pillars are "feel-good loop" + "tactile satisfaction" (which usually want flat-ish curves), surface the mismatch once: *"Ramp curves usually escalate stress; your pillars suggest a flat/wave shape. Want to reconsider, or are you intentionally testing a stress-then-relief loop?"*

### Re-running after the prototype exists

If the milestone already has `validation` results, the curve plan may need to account for what the bot revealed (e.g., bot reached cliff in 90 seconds, not 6 minutes — the actual session ended earlier than planned). Surface this: *"Bot validation showed avg session = 90s, but the plan target is 4min. The cliff isn't the bottleneck; something earlier ends the run. Re-read /gmk-validate's report."*

### "Difficulty curve" vs "content curve"

These aren't always the same. A ramp-difficulty milestone might have flat content (same enemy, just more of them per second). Use the curve table for **content** and the bumps section for **difficulty/intensity** — separately. Both can be flat, or content flat + difficulty ramping, etc.

## What this skill does NOT do

- **Doesn't list specific assets.** The table says "9 species"; naming the species is `/gmk-art-spec`'s job.
- **Doesn't schedule production.** No "by Friday, Y dragons should be done." That's `/gmk-task-split` + the kanban.
- **Doesn't write the prototype.** Specs only.
- **Doesn't pick the shape for the user automatically.** Surfaces the 5 options and accepts a choice; doesn't auto-pick. Curve shape is a design decision.
- **Doesn't validate.** Whether the curve actually delivers the hypothesis is `/gmk-validate`'s job.

## Notes for the model running this skill

- **Cliff is the punch.** If you write a content plan without naming a cliff, you've buried the most useful sentence in the document. Always name the cliff, even if it's "well past the hypothesis target."
- **Stairs are the default.** Most discovery-flavored mechanics in 2D 5-min-session games use stairs. Don't push toward fancier shapes unless the hypothesis demands it.
- **Volume is bigger than the user thinks.** If they want a 4-minute session at 30 seconds per merge, that's 8 merges — and if each merge needs a unique species output, 8 species, not 4. Walk the multiplication in the spec.
- **Plain tables, no charts.** A markdown table is enough; don't reach for ASCII art curves. The user reads this in VSCode.
- **Compress where possible.** A milestone that needs more than 6 checkpoint rows is probably overscoped. Push back: *"6+ checkpoints suggests this is several milestones. Want to split via /gmk-mechanic-merge or /gmk-task-split first?"*
