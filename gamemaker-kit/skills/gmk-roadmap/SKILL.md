---
name: gmk-roadmap
description: Decompose the locked Pillars into 3-8 milestones, set priority and dependencies, and write _workspace/roadmap.md. Use when the user says "/gmk-roadmap", "make a roadmap", "마일스톤 분해", "what should I build first", or after /gmk-init when they want a plan beyond the next single milestone. Run AFTER /gmk-init has locked pillars; refuses without pillars.json. Hand-editable output — the roadmap is a living document, not a contract.
model: sonnet
---

# gmk-roadmap — Decompose pillars into a milestone sequence

The roadmap exists to answer two questions, and only two:

1. **Which milestone should I build next?** (priority + dependency)
2. **Will the path I'm on actually exercise every pillar?** (coverage)

It is **not** a project plan. It does not estimate effort, it does not lock dates, and it is **not** a contract — the user reorders, kills, and splits milestones constantly. The roadmap reflects current best understanding, written down so the user can argue with their past self.

If the user wants project-management ceremony (deadlines, burndown, capacity), point them at TaskForge. gmk-roadmap names *what to build* and *in what order* — the calendar is theirs.

## Preconditions

1. **`pillars.json` exists** at `.gamemaker-kit/pillars.json`.
   - Missing: stop. *"No Pillars yet. Run /gmk-init first — the roadmap decomposes pillars, so it needs them locked."*
   - `pillars: []` with `skipped: true`: warn — *"Pillars were skipped at init. Without them, this roadmap is just an unordered milestone list — the kit can't tell you 'which one strengthens which pillar.' Want to run /gmk-init properly first?"* Only continue if the user says yes.
2. **`.gamemaker-kit/milestones.json` exists.** If missing, create as `{ "project_name": "...", "milestones": [] }`.
3. **`_workspace/` directory exists.** Create if missing.

## Flow

### Step 1 — Read state, summarize where the user is

Before proposing anything, show the user what's already on the table:

```
Pillars locked:
  1. tactile-satisfaction — Every interaction has a chunky physical payoff
  2. discovery-joy — The player wants to find out what's behind the next merge
  3. greed-vs-safety — Every move trades score against survival

Existing milestones:
  m1-merge-feel       PASS   targets: tactile-satisfaction
  m2-dragon-evo       (in progress)  targets: discovery-joy
  m0-roguelike-graft  KILLED (Cleveland: violated tactile pillar)

Active gaps (pillars with no milestone yet):
  - greed-vs-safety
```

If `milestones.json` is empty, say so plainly. *"Clean slate — no milestones yet."*

### Step 2 — Propose 3-8 milestones

Walk the user through milestone proposals **one pillar at a time**, in the order pillars appear in `pillars.json`. For each pillar:

> "Pillar **{name}**: {description}. What's the simplest mechanic that would test whether this pillar lands? Doesn't have to be a feature in the final game — just a thing that, if it works, tells you the pillar works."

Listen. The user usually has one answer per pillar. Sometimes they have two — accept both as candidates, mark them as alternatives.

**Hard cap: 8 milestones.** If the user wants more, push back: *"More than eight and the roadmap stops being a roadmap and becomes a backlog. The kit's value prop is killing milestones; eight is what we can honestly evaluate. Want to merge two of these, or defer to a v2 roadmap?"*

**Soft floor: 3 milestones.** Fewer than three usually means the user is hedging on commitment. Ask once: *"Two milestones is unusually focused — are there pillars without representation here?"* If they confirm two is right, accept.

For each accepted milestone, capture:

- **id** — `m{N}-{slug}` (kebab-case)
- **name** — short, descriptive
- **pillars_targeted** — array of pillar IDs (1-2; if 3+, push back per gmk-prototype rules)
- **hypothesis sketch** — one-line "IF/THEN" *placeholder* (the full falsifiable hypothesis gets written by gmk-prototype when the user actually builds it). Format: `"IF {mechanic} THEN {observable behavior or feel}"`. Skip if the user can't articulate yet — leave blank.

### Step 3 — Priority + dependencies

Once milestones are listed, ask the user to order them. **Don't auto-order.** The user's gut on "what to build first" usually encodes constraints you can't see (skill confidence, art availability, mood).

Then ask about dependencies — *"Does any milestone need another one to be PASS first?"* Examples:

- "m2-dragon-evo needs m1-merge-feel to PASS — if merge feel is broken, evolution doesn't matter."
- "m3-egg-spawn needs m2-dragon-evo to exist — eggs are how you get dragons."

Record as `dependencies` in the roadmap.md (a list of "{id} → {id}" pairs). **Don't** record these in milestones.json — dependencies are a roadmap-level concept; milestones don't track them.

If the user proposes a circular dependency (m1 → m2 → m1), name it and ask them to break the cycle. *"m1 needs m2 to PASS, and m2 needs m1 to PASS — that's a deadlock. One of these has to come first without the other."*

### Step 4 — Pillar coverage check

For each pillar in `pillars.json`, count how many proposed milestones target it. Show the user:

```
Pillar coverage:
  tactile-satisfaction   → 2 milestones (m1, m4)
  discovery-joy          → 1 milestone  (m2)
  greed-vs-safety        → 0 milestones ← gap
```

If any pillar has **zero coverage**, name it: *"Pillar 'greed-vs-safety' has no milestone in this roadmap. Either we're missing a milestone, or this pillar should be cut. Which?"* The user picks — *not the kit*.

Soft warning if **one pillar has 4+ milestones** while another has 1: *"This roadmap leans heavily on tactile-satisfaction. Is that intentional, or are we under-testing the other pillars?"* If intentional, accept.

### Step 5 — Append-or-merge into `milestones.json`

For each milestone in the roadmap that's **not yet in milestones.json**, add an entry with status fields blank (the milestone gets fleshed out when `/gmk-prototype` runs against it):

```json
{
  "id": "m3-egg-spawn",
  "name": "Egg spawn",
  "pillars_targeted": ["discovery-joy"],
  "hypothesis": {
    "if": "every 5th merge spawns a wild egg on the board",
    "then": "the player keeps merging to see what hatches",
    "measured_by": []
  },
  "prototype": null,
  "shape": null,
  "created_at": "2026-05-12T15:00:00Z",
  "validation": null
}
```

Milestones already in `milestones.json` are **not modified** — the roadmap respects existing prototype work. If the user wants to *replace* an existing milestone's hypothesis, they edit milestones.json or run `/gmk-kill-milestone` followed by re-roadmap.

### Step 6 — Write `_workspace/roadmap.md`

Render the full roadmap to `_workspace/roadmap.md`. **Overwrite** the existing file. Format follows `_workspace/structure.md` § "roadmap.md".

```markdown
# Roadmap — {project_name}

> Last updated: {timestamp} by gmk-roadmap

## Vision (mirror of pillars.json)
- tactile-satisfaction: Every interaction has a chunky physical payoff
- discovery-joy: The player wants to find out what's behind the next merge
- greed-vs-safety: Every move trades score against survival

## Milestones

| ID | Name | Pillars | Hypothesis (IF) | Status | Verdict |
|----|------|---------|-----------------|--------|---------|
| m1-merge-feel | Merge feel | tactile-satisfaction | 80ms hit-stop + shake | Done | PASS |
| m2-dragon-evo | Dragon evolution | discovery-joy | every 5th merge unlocks species | In progress | — |
| m3-egg-spawn | Egg spawn | discovery-joy | merges 5 → egg | Planned | — |
| m4-push-pull-greed | Push/pull greed | greed-vs-safety | combo decay if you stop | Planned | — |

## Dependencies
- m2 → m1 (PASS required)
- m3 → m2
- m4 (independent)

## Pillar coverage
- tactile-satisfaction: 1 milestone (m1)
- discovery-joy: 2 milestones (m2, m3)
- greed-vs-safety: 1 milestone (m4)

## Killed milestones (learning trace)
| ID | Name | Killed at | Reason |
|----|------|-----------|--------|
| m0-roguelike-graft | Roguelike deckbuilder graft | 2026-05-09 | Violated tactile pillar; dominant strategy 0.82 |

## Next recommendation (gmk-roadmap output)
{1-2 sentences naming the next milestone and why — typically the highest-priority unblocked one. If everything in-progress, name that.}
```

### Step 7 — Print the recommendation

```
Roadmap written: _workspace/roadmap.md (4 milestones, 1 in progress, 1 killed)

Pillar coverage:
  tactile-satisfaction   → 1
  discovery-joy          → 2
  greed-vs-safety        → 1

Next recommended: m3-egg-spawn
  Reason: m2-dragon-evo is in progress (validation pending). m3 depends on m2 PASS;
  m4 is independent and could start in parallel if you have capacity.

Edit the roadmap by hand any time — it's just markdown.
To start building: /gmk-prototype m3-egg-spawn (or m4 in parallel)
```

## Edge cases & policy

### Re-running on an existing roadmap

`/gmk-roadmap` is **safe to re-run**. It reads existing `milestones.json`, surfaces what's there, and asks the user what to add/reorder. Existing milestones with completed validation are never modified. New milestones are appended.

If the user wants to **delete** a roadmap entry that's already in `milestones.json`, route them to `/gmk-kill-milestone` — `gmk-roadmap` does not delete milestones.

### Pillar changes mid-project

If pillars.json has been edited after milestones exist, show a **drift warning** before proposing:

```
Pillar drift detected:
  - Pillar 'greed-vs-safety' was added after m1 and m2 existed.
  - Existing milestones do not target it.

Continue? (you can add new milestones for the new pillar, or revisit existing ones)
```

### Milestone naming collisions

If the user proposes a milestone ID that already exists in `milestones.json` (even killed), refuse. *"`m3-egg-spawn` already exists (status: KILLED). Either pick a new slug like `m3b-egg-spawn-v2`, or run `/gmk-kill-milestone m3-egg-spawn --revive` to bring it back."* Don't silently overwrite.

### Roadmap conflict with hand-edits

If the user hand-edited `_workspace/roadmap.md` between runs, the next `/gmk-roadmap` **overwrites** their edits (this is a regen, not a sync). Print a warning **before** overwriting:

```
WARNING: _workspace/roadmap.md was modified by hand (last edit: {timestamp}).
A new roadmap write will overwrite those edits.

Options:
  1. Cancel — keep my hand edits, abort regen.
  2. Save my edits — copy current roadmap.md to _workspace/roadmap.md.bak before regen.
  3. Overwrite — discard hand edits.
```

Wait for the user's pick. Don't guess.

## What this skill does NOT do

- **Doesn't write the actual prototype** — `/gmk-prototype` does that.
- **Doesn't estimate effort or dates** — that's a project-management concern; use TaskForge.
- **Doesn't auto-kill milestones** — `/gmk-kill-milestone` is the only path to KILLED status.
- **Doesn't make tasks** — `/gmk-task-split` decomposes a single milestone into discipline tasks; the roadmap is one level up.
- **Doesn't fix pillar gaps** — names them, asks the user. Adding a pillar is `/gmk-init` territory.
- **Doesn't enforce dependencies at validation time** — the dependency list in roadmap.md is advisory. If the user runs `/gmk-validate m2-dragon-evo` while m1 is FAIL, the kit doesn't block.

## Notes for the model running this skill

- **Don't auto-order milestones.** The user's gut order encodes constraints you can't see. Ask, then record.
- **Don't pad to fill pillars.** If a pillar has zero coverage and the user can't articulate a milestone for it, that's a sign the pillar might be the wrong shape — flag it, don't invent a milestone to plug the gap.
- **8 is a hard cap, not a target.** A 4-milestone roadmap is healthy. A 12-milestone roadmap is a backlog cosplaying as a roadmap.
- **Hypothesis sketches are placeholders.** They're one-liners so the table in roadmap.md isn't empty. The real falsifiable hypothesis (with measured_by) lives in milestones.json and gets written by `/gmk-prototype`.
- **The user *will* hand-edit roadmap.md.** That's fine — it's a markdown file. Just warn before overwriting, and never put load-bearing logic in it (milestones.json is authoritative).
- **Don't bring up Steam, marketing, or launch.** If the user starts talking about "and then we do a wishlist push" — gently redirect: *"That's out of scope for gmk — its end-point is development complete. Want me to capture that in `_workspace/milestones/{id}/notes.md` so you have it when you do start launch planning?"*
