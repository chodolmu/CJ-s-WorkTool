---
name: gmk-kill-milestone
description: Mark a milestone as KILLED with a structured reason captured as a learning trace (Cleveland rule). Optionally revive a previously killed milestone. Use when the user says "/gmk-kill-milestone <id>", "kill milestone X", "마일스톤 폐기", "this isn't going to work", or after a milestone has FAILed and the user has decided not to revise. Refuses silent kills — always requires a reason.
model: sonnet
---

# gmk-kill-milestone — Mark dead, capture the lesson, move on

A killed milestone is **not** a failure of the kit — it's a feature. The kit's value proposition is *cheap killing*: the cost of recognizing "this isn't going to work" should be minutes, not weeks. The killed milestone stays in `milestones.json` as a **learning trace** — future-you (or `/gmk-brainstorm` reading the history) can see what was tried and why it died.

The kit borrows Charlie Cleveland's framing: **a pillar that no milestone strengthens probably has to die; a milestone that no pillar needs probably has to die.** This skill makes that explicit.

## Why a dedicated skill (not just hand-editing `killed: true`)

Three reasons:

1. **Reason capture is mandatory.** Silent kills produce a graveyard the user can't learn from. The skill enforces a structured reason.
2. **Downstream effects.** `/gmk-status`, `/gmk-roadmap`, `/gmk-loop` all read `killed` and treat killed milestones differently — bypassing them via hand-edit risks inconsistency.
3. **Revive path.** Sometimes a killed milestone deserves a second life (the failure was the prototype, not the mechanic). This skill provides `--revive` so the trace is preserved.

## Preconditions

1. **Milestone exists** in `milestones.json`.
2. **For kill**: `killed !== true` (otherwise it's already dead).
3. **For revive (`--revive`)**: `killed === true`.

## Flow

### Step 1 — Pick the operation

Skill input: `<milestone-id> [--revive]`.

- No flag → kill (default)
- `--revive` → revive (un-kill)

If the milestone is already killed and no `--revive` flag, refuse: *"m2-dragon-evo is already KILLED (killed 2026-05-09). To bring it back, run with --revive."*

If the milestone is alive and `--revive` is passed, refuse: *"m4-push-pull-greed isn't killed — revive doesn't apply. Did you mean a different milestone?"*

### Step 2 — Show the milestone state before acting

```
Milestone: m2-dragon-evo
  Name: Dragon evolution curve
  Pillar: discovery-joy
  Hypothesis (IF): every 5th merge unlocks a visibly distinct dragon species
  Created: 2026-05-11
  Validation: FAIL (clear_rate 4%, dominant_strategy 78%)
  Self-test: (n/a)
  Tasks: 5 total — 2 done, 0 in-progress, 3 backlog

About to: KILL

This is reversible (run with --revive later if you change your mind).
```

For revive:

```
Milestone: m2-dragon-evo  [currently KILLED]
  Killed 2026-05-09
  Kill reason: Bot validation failed — dominant strategy 78%. Mechanic too narrow.

About to: REVIVE

The kill reason will be preserved in the milestone's kill_history for trace continuity.
```

### Step 3 — Ask for the kill reason (kill operation only)

For kill, **require** a reason. Don't accept silent kills.

> *"Why are you killing this milestone? In your own words — short is fine. The kit keeps this in the milestone trace so future-you (and /gmk-brainstorm) can learn."*

If the user gives a one-word reason ("bad", "wrong", "ugh"), push back **once**:

> *"That's a vibe, not a reason. Try one of these grammars:*
>   - *"Bot says X (mechanic-side fail)"*
>   - *"Self-test says Y (felt-side fail)"*
>   - *"Pillar conflict: this mechanic strengthens A but weakens B"*
>   - *"Wrong scope: this is two milestones, not one"*
>   - *"Pivot: I changed my mind about what this game is"*"

If the user still wants to use the vibe word, accept — but record it as-is. The kit doesn't gatekeep on quality of explanation, only on presence of one.

### Step 4 — Optional — Cleveland follow-up question

After capturing the reason, ask **one** follow-up (skill picks based on the reason's grammar):

- If reason mentions bot/mechanic fail: *"Was the mechanic wrong, or was the prototype's encoding of the mechanic wrong? (One is 'kill the idea'; the other is 'kill this attempt and re-prototype.')"*
- If reason mentions pillar conflict: *"Which pillar wins — do we kill this milestone, or revisit the pillar at /gmk-init level?"*
- If reason mentions scope: *"Should I open /gmk-roadmap so we can split this into two new milestones before killing?"*
- If reason mentions pivot: *"Should we also re-run /gmk-init? Pivoting the game often means re-locking pillars."*
- If reason mentions self-test fail: *"Did the bot also fail, or was this bot-PASS + self-test-FAIL? (The latter is a different category — the mechanic technically worked but the *feel* didn't.)"*

The follow-up isn't a gate; the user's answer is captured as a note. The skill doesn't auto-dispatch other skills (Cleveland is a thinking pause, not an automation).

### Step 5 — Write the kill (or revive) to `milestones.json`

#### Kill operation

Update the milestone:

```json
{
  "id": "m2-dragon-evo",
  "killed": true,
  "killed_at": "2026-05-12T17:00:00Z",
  "kill_reason": "Bot says clear_rate 4% — random play can't find the unlock; mechanic is too narrow",
  "kill_followup": "Mechanic wrong, not prototype — the unlock cadence (every 5 merges) is the wrong granularity",
  "kill_category": "bot_fail",
  ...rest of milestone preserved as-is
}
```

`kill_category` is one of (closed set):
- `bot_fail` — bot validation failed
- `self_test_fail` — bot passed but self-test failed
- `pillar_conflict` — milestone weakens a target pillar
- `scope_wrong` — milestone is actually 2+ milestones
- `pivot` — user changed direction on the game
- `prototype_wrong` — mechanic might be fine; the prototype's encoding was wrong (suggests re-prototype after revive)
- `other` — user reason doesn't fit categories above (preserved verbatim)

Don't delete any existing fields (validation, self_test, ported_to, tasks). The killed milestone is a *trace*; all its history is value.

#### Revive operation

```json
{
  "id": "m2-dragon-evo",
  "killed": false,
  "revived_at": "2026-05-15T10:00:00Z",
  "kill_history": [
    {
      "killed_at": "2026-05-12T17:00:00Z",
      "kill_reason": "...",
      "kill_followup": "...",
      "kill_category": "bot_fail"
    }
  ],
  ...
}
```

Move the previous `killed_at` / `kill_reason` / `kill_followup` / `kill_category` into a `kill_history[]` entry. Reset top-level fields. If the milestone is killed again later, append another entry to `kill_history`.

This preserves the full trace. A milestone that's been killed twice and revived once shows the full lineage.

### Step 6 — Refresh `_workspace/roadmap.md` (kill or revive)

After writing to `milestones.json`, refresh `_workspace/roadmap.md` so the roadmap reflects the new state. The roadmap template (`structure.md` → roadmap section) has two relevant places:

| Roadmap section | On kill | On revive |
|---|---|---|
| Milestones table | Move the row's Status to `KILLED` with the kill date | Move row back from "Killed milestones" to "Milestones"; restore last verdict |
| `## Killed milestones (learning trace)` | Append the row: `\| {id} \| {name} \| {killed_at} \| {kill_reason} \|` | Remove the row from this section |
| Dependencies | Remove edges where this milestone was a parent/child (kill); restore on revive | |

If `roadmap.md` doesn't exist, do **not** create it — this skill is read-aware of `gmk-roadmap`'s output, not its replacement. Print a one-line note: *"roadmap.md missing — run `/gmk-roadmap` after this to regenerate the dependency graph with the killed/revived state."*

If `roadmap.md` exists but has been hand-edited (kit can't detect this reliably), use the *minimum* update — only flip the killed milestone's status and append to the learning trace. Don't reformat other parts of the file.

### Step 6 — Update `_workspace/roadmap.md`

The kill/revive changes how roadmap.md renders the milestone (in the "Killed milestones" section vs. "Milestones" table). Update roadmap.md to reflect the new state.

Don't re-run `gmk-roadmap` — just edit the relevant rows in-place. The kit doesn't trigger other skills.

### Step 7 — Print the outcome

#### Kill

```
Killed: m2-dragon-evo
  Reason: Bot says clear_rate 4% — random play can't find the unlock; mechanic is too narrow
  Category: bot_fail
  Follow-up note: Mechanic wrong, not prototype

This milestone now appears under "Killed milestones" in:
  - milestones.json (killed: true)
  - _workspace/roadmap.md

Trace preserved — all validation history, tasks, and self-test records remain in the entry.

Next:
  /gmk-roadmap     — adjust the roadmap; discovery-joy now has one less milestone
  /gmk-brainstorm  — re-attack discovery-joy with the failure as a constraint
```

#### Revive

```
Revived: m2-dragon-evo
  Previously killed: 2026-05-09 (reason: bot_fail — clear_rate 4%)

The previous kill is preserved in kill_history[]. If you want to retry this mechanic with a different prototype, run:
  /gmk-prototype m2-dragon-evo --regen
  (this will prompt before overwriting the existing HTML, which is from before the kill)

If the original prototype is still suitable, just re-run /gmk-validate.
```

## Edge cases & policy

### User wants to kill multiple milestones at once

Refuse. *"Kill one at a time. Each kill needs its own reason — bulk kills lose the per-milestone context that makes the trace useful."*

### User wants to **delete** the milestone entirely (not kill)

Refuse. The kit doesn't have a delete operation; killing is the closest, and the trace is intentional.

If the user really wants to remove an entry (e.g., it was created in error and never had any validation work), tell them: *"For never-touched entries, hand-edit `milestones.json` to remove. The kit doesn't have a delete operation because killed-with-trace is more useful 99% of the time — but if this milestone has no history yet, manual delete is fine."*

### Kill a milestone that has dependent milestones

Surface the impact:

```
Heads-up: m1 has 2 milestones depending on it (m2, m4 in roadmap.md).
Killing m1 means m2 and m4 are also blocked downstream.

Continue?  (the kit will not auto-kill the dependents — that's your call after seeing this)
```

If the user proceeds, kill only m1. Don't auto-kill dependents.

### Kill a milestone that's currently shipped (PASS bot + PASS self-test + RE_PASS port)

Allowed but unusual. Surface:

> *"m1-merge-feel is shipped (PASS all gates, ported, RE_PASS). Killing it means marking dev-complete work as dead — you'd typically only do this on a project pivot. Confirm the kill reason is `pivot` or similar?"*

Don't refuse. The user has the right to change direction even after shipping a mechanic; the kit just confirms.

### Kill a milestone mid-task (in-progress tasks)

The tasks aren't auto-cancelled. They stay in `tasks[]` with whatever status they had at kill time. `/gmk-status` shows them as "tasks for a killed milestone" with a strikethrough in the kanban.

If the user wants to mark in-progress tasks as `cancelled`, they edit `milestones.json` manually. The skill doesn't auto-cancel because the tasks' progress is itself trace data.

### Multiple kill cycles (kill → revive → kill)

Allowed. Each kill appends to `kill_history[]` on revive. A milestone with 3 kill entries in history has a rich trace; future readers see it was attempted three times.

### User says "actually let's not kill, let me think"

Accept and exit cleanly. *"OK — no changes made. The milestone is unchanged."*

## What this skill does NOT do

- **Doesn't delete milestones.** Killed milestones remain in milestones.json as learning traces.
- **Doesn't auto-kill dependents.** Surfaces them; user decides.
- **Doesn't auto-run /gmk-brainstorm** after a kill. The user may want time to think before brainstorming a replacement.
- **Doesn't accept silent kills.** A reason is required.
- **Doesn't lecture on quality.** A vibe reason ("ugh, hate this") is recorded as-is once the user insists.
- **Doesn't validate the reason.** Bot/self-test claims in the reason aren't cross-checked against `validation` data; the user's framing is their own.

## Notes for the model running this skill

- **Reasons matter.** This is the load-bearing part. A kill without a reason produces a graveyard you can't learn from.
- **Cleveland follow-up is a thinking pause, not a process step.** Don't auto-route to other skills based on the answer; just record. The user picks what to run next.
- **Watch for kill-as-avoidance.** If a milestone has FAILed once and the user is killing immediately without revising the hypothesis, surface gently: *"This is the first FAIL — sometimes a single hypothesis tweak (or a different bot policy) is enough. Want to talk through the failure before killing?"* If they decline, kill.
- **Kill category matters for trace mining.** Future-you searching for "all the milestones I killed because of pillar conflict" wants `kill_category === 'pillar_conflict'`. Categorize honestly, not generously.
- **The trace is shipping-quality data.** Future skills (e.g., a v0.4 "graveyard mining" skill) will read `kill_history`. Treat the data as durable, not throwaway.
- **Revive isn't free**. A revive resets the active state to "alive," but the prototype file might be from before the kill — surface this in the revive output so the user remembers to either re-prototype or re-validate.
