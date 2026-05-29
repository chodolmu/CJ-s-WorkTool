---
name: gmk-module-build
description: Build one approved module from genre-decisions.json into a playable single-file HTML, gated by reference-fidelity (convention acceptance targets) instead of a fresh fun-hypothesis. Reuses gmk-prototype's HTML/bot-hook infrastructure and gmk-validate's 200-game trial, but the verdict is "does this match the researched conventions" not "is this a novel fun idea". Use when the user says "/gmk-module-build <Mn>", "build the module", "module 빌드", "M1 만들어", or after /gmk-genre-decide approved a module (the reference-clone-first path, Layer 2). Refuses without genre-decisions.json (that's blank-page mode → use /gmk-prototype).
model: sonnet
---

# gmk-module-build — Build one approved module, gated by reference-fidelity (Layer 2)

This is gamemaker-kit's **Layer 2** for the reference-clone-first path. Layer 1 (`/gmk-init`) researched the reference and the user ratified pillars; Layer 1.5 (`/gmk-genre-decide`) froze the research into `genre-decisions.json` and the user approved a module. This skill **builds that module** as a playable single-file HTML.

## Why this skill exists (read once)

`gmk-prototype` builds a prototype around a freshly-invented **Fun Hypothesis** — the team's bet that *this novel mechanic is fun*, gated by a 200-game bot trial. That is the right tool for the **blank-page** path (no reference).

But in **reference-clone mode** the bet is already settled: the reference is a shipped, validated game. The team isn't asking "is this fun?" — that question was answered by the reference's existence (concept §1: *the kit does not judge fun; it clones a validated reference*). The real question is **"does my build match the researched conventions?"** — *reference-fidelity*. So this skill's gate is the convention `acceptance` targets in `genre-decisions.json`, plus a per-convention user `.html` confirmation (concept P5) — **not** a new Fun Hypothesis.

This skill **reuses** gmk-prototype's HTML/hook infrastructure and gmk-validate's bot trial, but swaps the *verdict basis* from hypothesis-rows to convention-fidelity. It does **not** research (that's `gmk-init`), translate (that's `gmk-genre-decide`), or invent a differentiation idea (that's an opt-in `gmk-prototype` the user runs when they want to diverge from the reference).

## Precondition

Runs only in **reference-clone mode** — i.e. `.gamemaker-kit/genre-decisions.json` exists with an `approved` module. If there is no contract, this is **blank-page mode**: there is no reference to clone, so this skill refuses and points at `/gmk-prototype`. (Project mode is detected in Step 1; the detection rule is this skill's canonical definition, cited by `gmk-prototype` / `gmk-validate` / `gmk-port`.)

## Flow

### Step 0 — Verify (disk + git)

First sub-step, always. Verify against real state, not memory (concept P8 Resume Verification Rule):

1. `.gamemaker-kit/genre-decisions.json` exists AND `JSON.parse` succeeds AND has `schema_version`.
2. The contract is **committed** (git log shows the genre-decide commit) — a paranoid new session must not build on uncommitted, possibly-rolled-back research. If uncommitted, STOP and surface it.
3. The target module is in `modules[]` AND has `status: "approved"`. If `draft`: STOP — *"M2 is draft. Approve it in /gmk-genre-decide first, or name an approved module."*

**Fallback (the one that defines the mode boundary):** if `genre-decisions.json` does **not** exist → STOP with *"This project is blank-page mode (no genre-decisions.json). Use /gmk-prototype to build a hypothesis-driven prototype. To go reference-clone, run /gmk-init → /gmk-genre-decide first."* Do not build anything.

### Step 1 — Read contract + detect project mode

**Project-mode detection — this is the single source of truth.** `gmk-prototype`, `gmk-validate`, and `gmk-port` cite this rule; do not redefine it elsewhere:

```js
// .gamemaker-kit/ is the project's kit dir
const hasContract = fs.existsSync('.gamemaker-kit/genre-decisions.json');
const mode = hasContract ? 'reference-clone' : 'blank-page';
```

Then load the target module entry and its covered contract:
- `covers_pillars[]`, `covers_conventions[]`, `playable_html`.
- For each covered convention: its `acceptance` (object or `null`) and `needs_metric`. **Split** them: *numeric* (`acceptance != null`) vs *qualitative* (`needs_metric: true`). The numeric ones become machine gates; the qualitative ones become user-confirm checklist rows (Step 5).
- For each covered pillar: `kind` + `anti_example` (to write into the HTML header as a trace).

### Step 2 — Resolve module → build spec

- Read the module's `playable_html` field (what `gmk-genre-decide` wrote as "what would prove this module works as an HTML prototype"). That is the build target.
- Pick the prototype **shape** — delegate to `/gmk-shape-advisor` (reuse): grid / continuous / dialogue / shader, decided from the module's mechanic.
- Build path: `prototypes/<Mn>-<slug>.html` (same directory + naming convention as gmk-prototype, e.g. `prototypes/m1-single-combat.html`).

### Step 3 — Build the HTML (reuse gmk-prototype's generation infrastructure)

**Reused, unchanged** (cite `gmk-prototype-rules`, don't restate): single `<style>` block, vanilla JS only (§6), `__gmk.makeHook(spec)` as the only hook construction path (§4), line caps 300 soft / 600 hard (§2), library reference Option A (§7).

**Canonical hook surface = `gmk-prototype-rules` §4 (single source).** The author-facing spec is the five callbacks `{ reset(seed, rng), isOver(), legalActions(), apply(action), collectSummary() }` (rulebook §4 lines 105-109). `__gmk.makeHook(spec)` **wraps** these into the `window.__gmk_botHook__` surface (`startGame / act / summary / …`) that `gmk-validate`'s smoke check verifies (rulebook §5 line 166). So `collectSummary` (author-layer) and `summary` (wrapped-layer) are **two layers of the same thing, not a contradiction** — this skill writes only author-facing names.

**Different from gmk-prototype: a fidelity header, not a hypothesis header.** Where gmk-prototype writes an `IF / THEN / MEASURED BY` Fun Hypothesis, this skill writes the conventions the module commits to:

```
gamemaker-kit module: <Mn>
Mode: reference-clone
Covers conventions: C5, C12 (numeric) | C1, C3, C4, C11 (needs_metric)
Covers pillars: plans-meeting-luck, synergy-buildup
Acceptance gates (machine — gmk-validate reads collectSummary().custom.<metric>):
  C5  energy_per_turn == 3        (source verified: false — weak/single-source)
  C12 run_length_minutes range [30, 60]   (source verified: true)
Confirm-only (needs_metric — user .html observation, Step 5):
  C1  <statement verbatim>
  C3  <statement verbatim>
  ...
Reference: <source_urls from the covered conventions>
Created: <ISO-8601 with TZ>
Shape: grid
```

The header is **parsed** by `gmk-validate` (it extracts the acceptance gates). A malformed header is a hard refusal at validate time — same contract discipline as gmk-prototype's hypothesis header.

### Step 4 — Wire the fidelity hook

The fidelity gate is only real if the numbers are actually measurable. Guarantee it at **build time**, not validate time:

- For each numeric convention (acceptance != null), put its `acceptance.metric` into the hook's **`collectSummary().custom.<metric>`**. Example:
  ```js
  collectSummary() {
    return { score, build_used: null, custom: { energy_per_turn: 3, run_length_minutes: 42 } };
  }
  ```
  The library wraps this; `gmk-validate` reads the wrapped **`summary().custom.<metric>`** (rulebook §5 line 167 guarantees `custom.*` is part of the deterministic deep-equal surface). This is the seam that carries the measurement from build → validate.
- **STOP if a numeric convention's `acceptance.metric` is not produced by `collectSummary().custom`** — *"Convention C5's acceptance metric `energy_per_turn` is not measured by collectSummary().custom. Add it, or demote the convention to needs_metric in genre-decisions.json."* This prevents a numeric convention silently becoming un-gateable (the metric missing → validate would report INCONCLUSIVE without anyone noticing the gate evaporated).

### Step 5 — Confirm gate (concept ★ P5 — per-convention, observable)

The needs_metric conventions can't be machine-gated, so the user confirms them by **observation** — not by a "does it feel right?" vibe question (that would violate P2). Present a per-convention Y/N checklist with each convention's statement verbatim:

```
M1 built: prototypes/m1-single-combat.html
Open it in a browser, then for each, answer whether it's OBSERVABLE on screen (Y/N):
  C1 (needs_metric): <statement verbatim> — observable on screen? [Y/N]
  C3 (needs_metric): <statement verbatim> — observable on screen? [Y/N]
  C4 (needs_metric): <statement verbatim> — observable on screen? [Y/N]
  C11 (needs_metric): <statement verbatim> — observable on screen? [Y/N]
(Numeric conventions C5/C12 are machine-gated by /gmk-validate — not asked here.)
```

Record the response as a structured field, not prose:
```json
"confirm": { "confirmed": true, "per_convention": { "C1": true, "C3": true, "C4": true, "C11": false }, "notes": "..." }
```
`confirmed` = true only if every row is Y. This is a convention-anchored observable check, not a fun judgment.

The numeric gate (C5/C12) is **not** done here — `gmk-validate` does it in a separate run. Step 5 is only the user's `.html` observation of the qualitative conventions.

### Step 6 — Register + resume (atomic, P8)

Append the module entry to `.gamemaker-kit/milestones.json` (reuse gmk-prototype Step 6 schema + reference-clone fields). **Do not write a `self_test` block** — a reference-clone module has no Fun Hypothesis and no self-test rows, so the field stays at its schema default `null`. (This is what `gmk-port`'s reference-clone precondition reads: `self_test === null` → skip self-test gate.)

```json
{
  "id": "m1-single-combat",
  "name": "Single-combat encounter",
  "mode": "reference-clone",
  "module_id": "M1",
  "covers_pillars": ["plans-meeting-luck", "synergy-buildup"],
  "covers_conventions": ["C1", "C3", "C4", "C5", "C11"],
  "prototype": "prototypes/m1-single-combat.html",
  "shape": "grid",
  "confirm": { "confirmed": true, "per_convention": { "C1": true, "C3": true, "C4": true, "C11": true }, "notes": "" },
  "created_at": "2026-05-30T00:00:00+09:00",
  "validation": null,
  "self_test": null,
  "ported_to": null,
  "killed": false
}
```

Then write `milestones.json` via write-temp-then-rename (atomic). Update the resume point as the final sub-step.

**Next block:**
```
Module built + user-confirmed: prototypes/m1-single-combat.html
Registered in .gamemaker-kit/milestones.json (mode: reference-clone)
Fidelity gates: C5 energy_per_turn==3, C12 run_length_minutes [30,60]

Next:
  1. /gmk-validate m1-single-combat — runs the 200-game bot trial and computes the
     FIDELITY verdict (measures each numeric convention's acceptance, not a fun hypothesis).
  2. /gmk-port m1-single-combat — after fidelity PASS (or INCONCLUSIVE + your .html confirm),
     port to the engine.
```

## What this skill does NOT do

- **Doesn't invent a Fun Hypothesis.** That's the differentiation step — an opt-in `/gmk-prototype` the user runs when they want their own idea on top of the reference.
- **Doesn't judge fun** (concept §1). The reference already settled that; this skill only checks fidelity.
- **Doesn't run in blank-page mode.** No genre-decisions.json → STOP → `/gmk-prototype`.
- **Doesn't art-direct.** Wireframe-grade visuals only, same as gmk-prototype.
- **Doesn't validate.** That's `/gmk-validate`'s fidelity branch. Generation ends at file-written + user-confirmed + milestone registered.
- **Doesn't write a self_test block.** Reference-clone modules have no self-test rows; the field stays `null` (read by gmk-port).

## Notes for the model running this skill

- **The contract is fresh-read, never remembered.** Always `JSON.parse(genre-decisions.json)` at Step 1 — downstream of a possibly-edited contract.
- **Fidelity ≠ fun.** If you catch yourself writing a hypothesis ("the player will feel…"), stop — that's gmk-prototype's job. Here the bar is "matches convention C_n", which is observable or numeric, never a feeling.
- **Weak-source numbers still get measured.** A convention with `verified: false` (e.g. C5 energy==3 sourced from a wiki) is still wired into the fidelity gate — measurement and source-strength are separate axes. Surface the weak-source flag in the header and let `gmk-validate` / the user weigh it; don't silently drop the gate.
- **`collectSummary` is the author name.** Don't write `summary()` in the prototype — the library produces that wrapper. (gmk-prototype-rules §4/§5.)
- **One module at a time.** This is the kit's "one separable playable at a time" rhythm — build the approved module, validate it, then return to genre-decide to approve the next.
