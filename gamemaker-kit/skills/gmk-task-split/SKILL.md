---
name: gmk-task-split
description: Break a single milestone into discipline-tagged tasks (design / code / art / audio / ux / qa), write them into milestones.json → tasks[], and render _workspace/milestones/<id>/kanban.md. Use when the user says "/gmk-task-split", "split milestone into tasks", "마일스톤 일감 분해", or after /gmk-roadmap when a milestone is about to start and needs discipline assignment. Run on ONE milestone at a time — refuses to bulk-split.
model: sonnet
---

# gmk-task-split — One milestone → discipline-tagged tasks

This skill exists to answer one question at a time: *"For milestone X, what does each discipline need to do?"* It does not estimate effort, it does not assign humans (the user is solo or solo-ish), it does not track time. It produces a flat list of tasks tagged by discipline so `/gmk-status` can show *"audio is blocked on art."*

If the user wants project-management ceremony, point them at TaskForge. gmk-task-split is **kanban-shaped, not Gantt-shaped**.

## The six disciplines (closed set)

`design | code | art | audio | ux | qa`

**Don't invent new disciplines.** If a task doesn't fit, it's probably two tasks. Examples of common confusion:

| Confusing task | How to split |
|---|---|
| "Implement merge animation with particles" | code (merge logic), art (particle sprite). Two tasks. |
| "Write tutorial copy" | design (what does it say?) → ux (where does it appear?). Two tasks. |
| "Balance the economy" | design (target values) → code (implement & expose), → qa (validate via bot). Three tasks. |
| "Port to Godot" | Don't task-split. Use `/gmk-port` — porting is a single workflow, not 6 discipline tasks. |

If the user proposes a discipline outside the six, push back: *"There's no 'production' or 'biz' discipline in gmk — those concerns live outside dev-complete scope. Want to file this under design (decision) or ux (player-facing) instead?"*

## Preconditions

1. **`milestones.json` exists** at `.gamemaker-kit/milestones.json`.
2. **Milestone ID exists in milestones.json.** Refuse if not: list available IDs.
3. **Milestone is not killed.** If `killed: true`: refuse. *"Milestone {id} is KILLED. Either revive it (gmk-kill-milestone --revive) or pick a different milestone."*
4. **Skill input** — exactly one milestone ID. Refuse bulk splits: *"Run task-split on one milestone at a time — bulk splitting produces same-shaped task lists for different milestones, which is rarely what you want."*

## Flow

### Step 1 — Read the milestone, summarize

Pull the milestone's `name`, `pillars_targeted`, `hypothesis`, and `shape`. Show:

```
Splitting tasks for: m2-dragon-evo
  Name: Dragon evolution curve
  Pillar: discovery-joy
  Hypothesis (IF): every 5th merge unlocks a visibly distinct dragon species
  Shape: grid

Existing tasks (if any):
  (none — first split)
```

If the milestone already has `tasks[]` entries: *"This milestone already has {N} tasks. Re-running task-split will **merge** new tasks into the existing list, never overwrite. Continue?"*

### Step 2 — Propose tasks by discipline, one discipline at a time

Walk the six disciplines in order: **design → code → art → audio → ux → qa**.

For each discipline, ask one question phrased to that discipline's concern:

| Discipline | Question |
|---|---|
| design | "What rules / state machines / data models does this milestone need spec'd before code can start?" |
| code | "What implementation work does this need that isn't design or asset work?" |
| art | "What visual assets does this need? Use placeholders if final assets aren't ready (see /gmk-mock-inject)." |
| audio | "What SFX / BGM does this need? OK to leave blank if the hypothesis isn't audio-dependent." |
| ux | "Any UI / FTUE / input mapping concerns? OK to leave blank for pure mechanic milestones." |
| qa | "What needs validating beyond the bot? Use a 'qa-self-test' task for the user's own playthrough." |

**Empty disciplines are normal.** A merge-feel milestone might have 4 code tasks, 1 art task, 0 audio, 0 ux, 1 qa. Don't pad to fill every discipline.

For each proposed task, capture:

- **id** — `t-{milestone-id}-{short-slug}` (e.g., `t-m2-dragon-evo-design-tree`)
- **discipline** — one of the six
- **title** — short imperative ("Spec evolution tree", "Implement 5-merge counter")
- **blocked_by** — array of other task IDs in this milestone, if any. Optional.

After each discipline, show the running list:

```
Tasks so far (m2-dragon-evo):
  design   t-m2-design-tree         Spec evolution tree (5 species, 4 stages each)
  design   t-m2-design-trigger      Define trigger rule: 5 merges = unlock check
  code     t-m2-code-counter        Implement merge counter + unlock event
  code     t-m2-code-species-state  Add species enum + active state
  art      t-m2-art-species-sheets  Sprite sheets for 5 species (placeholder OK)  blocked_by: t-m2-design-tree
  audio    (none — hypothesis isn't audio-dependent)
  ux       t-m2-ux-unlock-toast     Unlock celebration toast
  qa       t-m2-qa-bot              Bot validation per hypothesis
  qa       t-m2-qa-self-test        User self-test session
```

### Step 3 — Confirm and write

Show the full list, ask the user:

> "Looks right? Anything missing or to remove before I write to milestones.json + kanban.md?"

Edit per the user's reply, then write:

**`milestones.json`** — merge new tasks into `milestones[].tasks[]`. If the milestone has no `tasks` field yet, create it. Each task:

```json
{
  "id": "t-m2-art-species-sheets",
  "discipline": "art",
  "title": "Sprite sheets for 5 species (placeholder OK)",
  "status": "backlog",
  "blocked_by": ["t-m2-design-tree"],
  "created_at": "2026-05-12T15:00:00Z",
  "updated_at": "2026-05-12T15:00:00Z"
}
```

**Status starts as `backlog`.** The user (or `gmk-status`) transitions tasks through `backlog → in-progress → review → done`. Don't set `in-progress` here even if "the user is about to start it" — let them transition explicitly.

**`_workspace/milestones/<id>/kanban.md`** — render the kanban per `_workspace/structure.md` template. **Overwrite** existing kanban.md (it's a regen).

### Step 4 — Print the recommendation

```
9 tasks written for m2-dragon-evo:
  design: 2   code: 2   art: 1   audio: 0   ux: 1   qa: 2

Blocked-by graph:
  t-m2-art-species-sheets → blocked by t-m2-design-tree

First task to unblock everything: t-m2-design-tree (no dependencies)

Next:
  /gmk-status — see the kanban + dashboard
  /gmk-prototype m2-dragon-evo — start the HTML prototype (uses design tasks as input)
```

## Edge cases & policy

### Re-running on a milestone with existing tasks

**Merge mode**, not overwrite. New tasks are appended; existing tasks (including completed ones) are preserved. If the user proposes a task with an ID that already exists, the kit refuses: *"`t-m2-design-tree` already exists. Pick a different slug, or skip this task."* Never silently update.

If the user wants to **remove** a task that exists, they edit `milestones.json` by hand or use a dedicated future skill — `gmk-task-split` does not delete tasks. Removing in-progress tasks loses status history, which the kanban relies on.

### Task that spans multiple disciplines

Refuse. *"'Build merge animation' is code + art. Two tasks: `t-m2-code-merge-anim` (the implementation glue) and `t-m2-art-merge-particles` (the sprite). The art task can block the code one if needed."*

The kit's value here is **discipline visibility** — when one combined task says "merge animation," `/gmk-status` can't tell you whether art is waiting on code or vice versa. Splitting reveals the bottleneck.

### "QA-self-test" task vs `/gmk-self-test` skill

The qa-self-test **task** is a checkbox on the kanban — it marks "the user owes themselves a playthrough." The `/gmk-self-test` **skill** is what they run when they actually play. The task transitions to `done` when the self-test session is recorded. Don't conflate.

### Tasks without a clear deliverable

If the user proposes a task like "think about whether this is fun" — push back: *"That's not a task, it's a hypothesis. The `then` of the milestone hypothesis is where 'is this fun' goes. Want to sharpen the hypothesis instead, or replace with a concrete task (e.g., 'qa-self-test: 20-min play session')?"*

### Cycle detection in blocked_by

If the user creates a cycle (`A blocked_by B`, `B blocked_by A`), refuse and name it. *"`t-m2-art-sheets` blocks `t-m2-design-tree` which blocks `t-m2-art-sheets`. One of these has to come first without the other."*

### Tasks for killed milestones

Refuse. Killed milestones are learning traces, not active work.

## What this skill does NOT do

- **Doesn't estimate effort or duration.** No story points, no hours, no t-shirt sizes. The user knows their own pace; the kit doesn't pretend to.
- **Doesn't assign humans.** Solo-user assumption; `assignee` field is optional. If the user wants to write a name there, fine, but the kit doesn't prompt.
- **Doesn't reorder tasks.** Order in the kanban file follows discipline order (design → code → art → audio → ux → qa) then creation order. The user can edit the kanban md to reorder visually, but milestones.json stays creation-ordered.
- **Doesn't transition status.** `/gmk-status` and the user own status changes.
- **Doesn't delete tasks.** Append-and-merge only. Hand-edit milestones.json to remove.
- **Doesn't split across milestones.** One milestone per call.
- **Doesn't compose with `/gmk-prototype` or `/gmk-validate`** automatically. Those don't read the tasks list — they read the hypothesis. Tasks are for `/gmk-status` and the user's own kanban view.

## Notes for the model running this skill

- **Six disciplines, closed set.** If a user task doesn't fit, the task is wrong, not the disciplines.
- **Empty disciplines are normal.** Don't pad. A 3-task milestone with only code + qa is fine if that's what the milestone needs.
- **The kanban file is regenerated** — don't put load-bearing logic in it. milestones.json is authoritative.
- **Don't sort by priority in the task list** — the kanban groups by discipline only. Within-discipline ordering is creation order. Prioritization is the user's job during the milestone, not at split time.
- **Watch for "design-then-code" reflexes.** Sometimes the design task is small ("decide whether merges are immediate or delayed: pick one") and the user is tempted to skip it. Don't let them — a 1-minute decision task is still a task because it unblocks two code tasks.
- **Resist filling audio / ux / narrative when the milestone is a pure mechanic test.** A merge-feel prototype doesn't need a settings menu task. Empty rows in the kanban are honesty, not laziness.
- **If the user proposes 20+ tasks for one milestone**, push back: *"20 tasks for one milestone usually means the milestone is two milestones. Want to split the milestone first via /gmk-roadmap?"*
