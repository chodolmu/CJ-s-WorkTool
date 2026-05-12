# gamemaker-kit — _workspace/ + .gamemaker-kit/ structure

This is the single source of truth for *where state lives*. Every skill in v0.2 reads or writes inside one of these paths. No external services. No databases. Plain text and JSON, all of it in the user's game project.

Two roots:

- **`_workspace/`** — the surface the user *reads daily*. Markdown dashboards, the roadmap, brainstorm notes, kanbans. Human-shaped. Editable by hand.
- **`.gamemaker-kit/`** — internal state the kit owns. JSON files, validation traces, self-test sessions, port checklists. Gitignore-able (the user picks).

If you find yourself wanting to put state somewhere else, stop. Either it belongs in one of these two roots, or it belongs *outside the kit*.

---

## Full tree

```
{game-project-root}/                       # e.g. C:/GameMaking/Godot/ZooMerge/
├─ godot/                                  # user's engine project (gmk does not touch)
├─ prototypes/                             # HTML single-file prototypes (gmk-prototype writes)
│   ├─ m1-merge-feel.html
│   ├─ m2-dragon-evo.html
│   └─ ...
│
├─ .gamemaker-kit/                         # internal state — gmk owns
│   ├─ pillars.json                        # user-editable (locked by gmk-init)
│   ├─ milestones.json                     # gmk-updated (schema in _workspace/examples/milestones-example.json)
│   ├─ integrations.toml                   # reserved for future (gitignore)
│   │
│   ├─ validations/<milestone-id>/
│   │   ├─ trial-{trial-id}.json           # per-run trial data
│   │   ├─ aggregated.json                 # rolled-up across trials
│   │   └─ suspicious/{seed}.json          # ~20 outlier seeds for human review
│   │
│   ├─ self-tests/<milestone-id>/
│   │   ├─ session-{YYYY-MM-DD}.md         # user's own play notes (raw)
│   │   └─ coded.md                        # gmk thematic coding of *user's own* notes
│   │
│   ├─ merge-gates/<milestone-id>.md       # merge-gate run summary
│   └─ port-checklists/<milestone-id>.md   # port re-validation checklist
│
└─ _workspace/                             # user-facing dashboards (overwrite-friendly)
    ├─ vision.md                           # north star (Pillars in human-readable form)
    ├─ roadmap.md                          # milestone list + priority + deps
    ├─ dashboard.md                        # overwritten every gmk-status run
    ├─ brainstorms/                        # optional, gmk-brainstorm output
    │   └─ M{n}-{slug}.md
    └─ milestones/<milestone-id>/
        ├─ kanban.md                       # per-discipline tasks (backed by milestones.json tasks[])
        └─ notes.md                        # user's free notes (gmk never overwrites)
```

---

## File responsibilities

### `pillars.json`

Written once by `gmk-init`. User can hand-edit. Schema:

```json
{
  "project_name": "ZooMerge",
  "engine": "godot",
  "created_at": "2026-05-12T15:00:00Z",
  "pillars": [
    {
      "id": "tactile-satisfaction",
      "name": "Tactile satisfaction",
      "description": "Every interaction has a chunky physical payoff.",
      "anti_examples": ["Merge feels like clicking a button on a spreadsheet."]
    }
  ],
  "supported_genres_check": {
    "two_d": true,
    "deterministic_input": true,
    "session_under_5min": true
  }
}
```

### `milestones.json`

Owned by gmk skills. **Never** hand-edit unless you really know the schema (it's load-bearing for ~12 skills). Full schema example: `_workspace/examples/milestones-example.json`. Backward compat: v0.1 entries (no `tasks[]`, no `self_test`, etc.) MUST still validate — new v0.2 fields are optional.

### `_workspace/vision.md`

Written by `gmk-init` and re-rendered whenever pillars change. Human-readable mirror of `pillars.json`. **Template:**

```markdown
# Vision — {project_name}

> Locked: {created_at}

## What this game is about

{1-2 sentence summary the user writes during gmk-init — not auto-generated}

## Pillars

### 1. {pillar.name}
{pillar.description}

**Violated when:** {anti_examples[0]}

### 2. {pillar.name}
...

## Supported genres check (gmk scope)

- 2D: ☑ / ☐
- Deterministic input: ☑ / ☐
- Session ≤ 5 min: ☑ / ☐

If any box is ☐, gmk's bot validation and porting checks will produce reduced
confidence. The user accepted this trade-off at init time.

## Engine target

{godot|unity|other}

## What's *out* of scope (kit reminder)

- External release: Steam page, marketing, wishlist watching
- Live-ops: patch notes, review pulse
- External-human feedback collection (Discord/Steam RSS)

gmk's end-point is *development completion*, not ship.
```

### `_workspace/roadmap.md`

Written + updated by `gmk-roadmap`. Hand-editable (the user can reorder rows, add notes). **Template:**

```markdown
# Roadmap — {project_name}

> Last updated: {timestamp} by gmk-roadmap

## Vision (mirror of pillars.json)

- {pillar.id}: {pillar.description}

## Milestones

| ID | Name | Pillars | Hypothesis (IF) | Status | Verdict |
|----|------|---------|-----------------|--------|---------|
| m1-merge-feel | Merge feel | tactile-satisfaction | 80ms hit-stop + shake | Done | PASS |
| m2-dragon-evo | Dragon evolution | discovery-joy | every 5th merge unlocks species | In progress | — |
| m3-egg-spawn | Egg spawn | discovery-joy | merges 5 → egg | Planned | — |

## Dependencies

- m2 → m1 (PASS required)
- m3 → m2

## Killed milestones (learning trace)

| ID | Name | Killed at | Reason |
|----|------|-----------|--------|
| m0-roguelike-deckbuild | Roguelike deckbuilder graft | 2026-05-09 | Violated tactile pillar; dominant strategy 0.82 |

## Next recommendation (gmk-roadmap output)

{1-2 sentences naming the highest-priority milestone and why}
```

### `_workspace/dashboard.md`

**Overwritten** every time `gmk-status` runs. Don't hand-edit (it'll be wiped). **Template:**

```markdown
# Dashboard — {timestamp}

## Active milestone: {milestone.id}

| 직군 | 일감 | 상태 | 막힘? |
|------|------|------|-------|
| design | {title} | ✅ Done | — |
| code   | {title} | 🚧 In progress | — |
| art    | {title} | 🚧 In progress | — |
| audio  | {title} | 🚫 Blocked | art 시안 대기 (3일째) |
| ux     | (없음) | — | — |
| qa     | (없음) | — | — |

## 막힘 알림

- audio가 art 시안 대기 중 (3일째) → **art 우선순위 ↑**

## 검증 상태

- 마지막 봇 검증: {timestamp or "없음"}
- 마지막 self-test: {timestamp or "없음 (suspicious-run 20판이 대기 중)"}

## 다음 추천 액션 (1개만)

{single sentence — never more than one. If the user has more than one obvious next move, that's a roadmap problem, not a dashboard problem.}

## Pillar 적합도 (active milestone)

- 강화하는 Pillar: {ids}
- 약화하는 Pillar: {ids or "없음"}
```

### `_workspace/milestones/<id>/kanban.md`

Written by `gmk-task-split`, updated by `gmk-status`. Mirrors `milestones.json` → `milestones[].tasks[]`. **Template:**

```markdown
# Kanban — {milestone.id} {milestone.name}

> Mirror of milestones.json → tasks[]. Edit milestones.json (or run gmk-task-split again) to change; this file is regenerated.

## design

- [x] {title} (done 2026-05-09)
- [ ] {title} — blocked by {dep-id}

## code

- [x] {title} (done 2026-05-10)
- [/] {title} — in progress

## art

- [x] {title} (done 2026-05-11)

## audio

- [!] {title} — 🚫 blocked by `t-m1-art-particles` (3일째)

## ux

(no tasks)

## qa

(no tasks)
```

Status markers:
- `[ ]` backlog
- `[/]` in-progress
- `[r]` review
- `[x]` done
- `[!]` blocked

### `_workspace/milestones/<id>/notes.md`

**User-owned.** gmk never overwrites this. Free-form scratch space — sketches, links, "wait, what about ___?" thoughts. If the user wants to capture a thought during a milestone, this is where.

### `_workspace/brainstorms/M{n}-{slug}.md`

Output of `gmk-brainstorm`. One file per brainstorm session. **Template:**

```markdown
# Brainstorm — M{n} {slug}

> Session: {timestamp}, lens: {MDA layer}

## 1. Frame
{problem statement, pillar bindings}

## 2. Diverge (≥ 10 raw ideas)
- {idea}
- {idea}
- ...

## 3. Stress-test
| Idea | Risk | Pillar fit | Bot-measurable? |
|------|------|------------|-----------------|
| ... | ... | ... | yes/no |

## 4. Converge
{1-3 ideas worth turning into hypotheses}

## 5. Pillar audit
For each surviving idea: which pillar does it strengthen? Which does it risk weakening?
```

### `.gamemaker-kit/validations/<m>/trial-{id}.json`

Per-trial bot run data. Written by `gmk-validate`. One file per trial (a trial = one full 200-run pass with one config). Format:

```json
{
  "trial_id": "t-2026-05-12-01",
  "milestone_id": "m1-merge-feel",
  "started_at": "...",
  "finished_at": "...",
  "config": { "policy": "persona-mix", "runs": 200, "seed_offset": 0 },
  "runs": [
    { "seed": 0, "persona": "Runner", "summary": {...}, "actions_taken": 142, "duration_ms": 287000 },
    ...
  ],
  "aggregates": { "clear_rate": 0.67, ... },
  "by_persona": { "Runner": {...}, "Treasure": {...}, ... }
}
```

### `.gamemaker-kit/validations/<m>/aggregated.json`

Roll-up across all trials for one milestone. `gmk-validate` updates this after each new trial. `gmk-status` and `gmk-regression` read this.

### `.gamemaker-kit/validations/<m>/suspicious/{seed}.json`

Auto-extracted outliers from the most recent trial. Selection rule:

- entropy bottom 10% (bot only did one thing)
- entropy top 10% (bot flailed)
- duration top 5% and bottom 5%
- all crashed/stuck runs

Cap at ~20 total. Each file: full run trace + the reason it was flagged. `gmk-self-test` shows these to the user in priority order.

```json
{
  "seed": 17,
  "reason": "entropy-low",
  "persona": "Runner",
  "actions": [...],
  "summary": {...},
  "replay_url": "file://.../prototypes/m1-merge-feel.html?seed=17"
}
```

### `.gamemaker-kit/self-tests/<m>/session-{date}.md`

User's own play-session notes. **The user writes this** (gmk-self-test prompts them after they finish playing). Raw, unstructured — that's the point. **Template:**

```markdown
# Self-test session — {milestone.id} — {date}

> Duration: {minutes} min
> Suspicious seeds reviewed: {seed list}

## What happened in plain words
{paragraph or bullets — what the user noticed, what surprised them, what felt off}

## Re: hypothesis
- IF: {pasted from milestone}
- THEN: {pasted from milestone}
- Did the THEN happen for you?  PASS / FAIL / NEEDS_MORE_PLAY

## Suspicious runs — what the bot saw vs what you saw
- seed 17 (entropy-low): {your note}
- seed 42 (entropy-low): {your note}
- seed 88 (entropy-high): {your note}

## Quotes from yourself you want to remember
> "{thing the user blurted out while playing}"
```

### `.gamemaker-kit/self-tests/<m>/coded.md`

Thematic coding of the user's *own* notes across sessions. `gmk-self-test` produces this. **Template:**

```markdown
# Coded themes — {milestone.id}

> Last coded: {timestamp}, sessions covered: {N}

## Themes

| Theme | Mentions | Example quotes |
|-------|----------|----------------|
| chunky-feedback | 4 | "thud feels right", "satisfying clack" |
| wants-more-variety | 2 | "all merges sound the same after 5 min" |

## Verdict
- Latest: PASS / FAIL / INCONCLUSIVE
- Reasoning: {1-2 sentences naming the dominant theme}
```

### `.gamemaker-kit/merge-gates/<m>.md`

Output of `gmk-merge-gate`. **Template:**

```markdown
# Merge gate — {milestone.id} — {timestamp}

## Regression
- Re-ran PASS milestones: {list}
- Verdicts unchanged: {yes/no}
- Drift detected: {none | list}

## Asset conflicts
- Conflicting paths: {none | list}

## Secret scan (gitleaks)
- Findings: {0 | list with file:line:type}

## Verdict
PASS / FAIL

## Warnings
- {free-text warnings, never blocking}
```

### `.gamemaker-kit/port-checklists/<m>.md`

Output of `gmk-port` stage 5. **Template:**

```markdown
# Port checklist — {milestone.id} → {engine} — {timestamp}

## Stage 1 — Generate
- Files created: {list}
- Files modified: {list}

## Stage 2 — Compile
- {godot|unity} {--headless | build} check: PASS / FAIL
- Retries: 0 | 1

## Stage 3 — Smoke (5 bot runs)
- Crashed: {0..5}
- Result: PASS / FAIL

## Stage 4 — Metric diff (HTML 200 vs Engine 200)
| Metric | HTML | Engine | Delta | Threshold | OK? |
|--------|------|--------|-------|-----------|-----|
| clear_rate | 0.67 | 0.71 | +0.04 | ±0.20 | yes |
| dominant_strategy_ratio | 0.31 | 0.34 | +0.03 | ±0.15 | yes |
| action_entropy | 1.72 | 1.65 | -0.07 | ±0.30 | yes |

## Stage 5 — Human RE-PASS
- User played for {min} minutes
- Verdict: RE_PASS / RE_FAIL / NEEDS_TUNING
- Reason: {user's own words}
```

---

## Conventions

- **Timestamps** — ISO-8601 with timezone. Always.
- **IDs** — kebab-case slugs. `m{N}-{slug}` for milestones; `t-{milestone-id}-{slug}` for tasks; `t-{date}-{N}` for trials.
- **Discipline values** — exactly one of `design | code | art | audio | ux | qa`. No other strings.
- **Verdict values** — `PASS | FAIL | INCONCLUSIVE` for validate; `PASS | FAIL` for merge-gate; `RE_PASS | RE_FAIL | NEEDS_TUNING` for port.
- **Markdown headings** — `#` for file title, `##` for sections. No skipping levels.
- **Status emojis in dashboard.md** — `✅ Done`, `🚧 In progress`, `🚫 Blocked`, `📋 Backlog`, `👁 Review`. Don't invent new ones.
- **Backward compat** — every v0.2 schema addition is *optional*. A v0.1 milestone with only the seven original fields still validates.

---

## What this structure does NOT do

- **Multi-project state**: there is none. Each game project has its own `_workspace/` and `.gamemaker-kit/`. The kit does not maintain a global registry of projects.
- **External sync**: nothing in this tree gets pushed to Notion/Linear/Discord/etc. The user copies into those tools manually if they want.
- **Real-time collaboration**: files, not a server. Two people editing the same milestone race; resolve by git merge like any other text.
- **Auto-cleanup**: killed milestones stay in the trees (learning trace). The user manually deletes if they want to declutter — gmk-roadmap dims them but never removes.

---

## Notes for the model writing/reading these files

- **Overwrite vs append**: `dashboard.md`, `coded.md`, `aggregated.json` overwrite. `session-{date}.md`, `suspicious/{seed}.json`, `trial-{id}.json` are immutable once written. `milestones.json` is partial-update (merge by `id`).
- **Don't read `.gamemaker-kit/integrations.toml`** in v0.2 skills — it's reserved for future release-phase tools. Skills that touch it now will break compatibility.
- **`notes.md` is user-owned**: never overwrite. If you need to add a gmk-generated note, put it in `dashboard.md` or `coded.md`, not `notes.md`.
- **Path style**: forward slashes in all generated paths, even on Windows. `file://` URIs likewise.
- **Pretty-print JSON**: 2-space indent. The user reads it in VSCode.
