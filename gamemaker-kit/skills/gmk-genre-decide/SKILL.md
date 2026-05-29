---
name: gmk-genre-decide
description: Convert a project's Layer-1 reference research (research-notes.md §Synthesis — genre conventions, anti-tropes, ratified pillars) into a machine-parseable production contract, genre-decisions.json, that every later skill (gmk-module-build, gmk-roadmap) reads fresh. Maps each confirmed convention to a typed entry (numeric ones get an acceptance target, qualitative ones are flagged needs_metric), carries the ratified pillars with traceability back to their source conventions, and derives playable-module candidates for the user to ratify. Use when the user says "/gmk-genre-decide", "genre decide", "research를 spec으로", "contract 변환", "make the genre-decisions", or right after /gmk-init has produced research-notes.md with ratified pillars (the reference-clone-first path). This is gamemaker-kit's Layer 1.5 — without it, Layer-1 research stays prose and Layer-2 (module build) has nothing machine-readable to consume.
model: opus
---

# gmk-genre-decide — Research → Production Contract (Layer 1.5)

The bridge from *what the genre does* (prose research) to *what this game commits to* (a contract a machine can check). gamemaker-kit's Layer 1: `/gmk-init` researched the reference and the user ratified pillars. This skill turns that into **`genre-decisions.json`** — the single source of truth every later skill reads fresh.

## Why this skill exists (read once)

Layer-1 research output (`research-notes.md §Synthesis`) is markdown prose. `gmk-module-build` and `gmk-roadmap` can't reliably parse prose. If Layer 1.5 is skipped, the research evaporates — every later step re-guesses what the genre's conventions were. `genre-decisions.json` freezes them in a form a `JSON.parse` + field-assert can consume. This is concept principle **P1 (machine-parseable contract)**.

This skill does **not** build anything (that's `gmk-module-build`, S3) and does **not** research a new game (that's `gmk-init`). It only *translates + defines the contract + derives module candidates*.

## Precondition

Runs only after `/gmk-init` produced `research-notes.md` with a `§Synthesis` section containing ratified pillars. If there was no reference (blank-page pillar path), there is nothing to translate — skip this skill; the pillars in `pillars.json` are already the contract.

## Flow

### Step 0 — Verify preconditions (disk + git)

First sub-step, always. Verify against real state, not memory:

1. `.gamemaker-kit/research-notes.md` exists AND has a `## §Synthesis` heading AND a user-ratification table (the pillar candidates the user adopted/rejected).
2. The research-notes is **committed** (git log shows the gmk-init / research commit) — a paranoid new session must not build a contract on uncommitted, possibly-rolled-back research. If uncommitted, STOP and surface it.
3. Sanity: confirmed-convention count > 0, ratified-pillar count > 0.

Any failure → STOP. Tell the user to run `/gmk-init` first (or commit the research).

### Step 1 — Read the synthesis

Load from `research-notes.md §Synthesis`:
- **Confirmed conventions** (each with id `C\d+`, category, statement, source_urls, cross_ref_strength, verified).
- **Anti-tropes** (each flagged by ≥2 refs).
- **Ratified pillars** — only the ones the user *adopted* (rejected candidates are differentiation notes, not pillars).

### Step 2 — Map conventions → `conventions[]`

For each confirmed convention, write a JSON entry. Preserve `source_urls` / `cross_ref_strength` / `verified` verbatim.

**Acceptance policy (the one judgment call):** a convention gets a machine-checkable `acceptance: {metric, op, value}` **only if it carries a concrete number** (a count, a duration, a rate, a range). Qualitative conventions ("meta-narrative is the retention engine") get `acceptance: null` + `needs_metric: true` — honest about what a machine can't gate yet.

- `op ∈ {">=", "<=", "==", "range"}`; for `range`, `value` is `[lo, hi]`.
- **Hybrid conventions** (a process description that *also* names a number — e.g. "data-driven tuning toward ~80% win-rate", "move-compression to 12-18 late"): classify as **numeric**, put the number in `acceptance`, and keep the process wording in `statement`.
- Don't invent a metric to force a qualitative convention numeric — that's drift. If it has no number, it's `needs_metric: true`.
- After mapping, **sanity-check the split**: count how many conventions you expected to be numeric vs qualitative from the synthesis, and assert `count(acceptance != null)` matches that expectation (±1). A large mismatch means you numericized something qualitative (or dropped a number) — re-examine.

### Step 3 — Map ratified pillars → `pillars[]`

For each *adopted* pillar:
- `id` = the same **slug** used in `pillars.json` (name lowercased, spaces→hyphens) — pillars must share an ID space with `pillars.json` so downstream skills (`gmk-prototype`, `gmk-self-test`) that read pillars by id stay linked. **Do not invent a new `P\d+` id space.**
- `ratification_label` = the original candidate label from research-notes (e.g. `"PC1"`) — preserves the trace from research → ratification → contract.
- `from_conventions` = the `C\d+` ids this pillar was derived from. **Must be non-empty** — a pillar with no source convention means it was invented, not researched (P9 violation). Drop it or trace it.
- `kind` = one of `sensory | behavioral | decision-shape | emotional` (same enum gmk-init writes; `gmk-prototype-rules` Rule 17 reads it).
- `anti_example`, and `acceptance` (numeric pillars only, same policy as conventions).

### Step 4 — Derive playable-module candidates → `modules[]`

From the pillars + conventions, propose **module candidates** — each a *separable playable unit* (concept P4), not a time-slice. A module bundles the conventions/pillars it would prove.

- Each `modules[]` entry: `{id: "M\d+", name, covers_pillars: [slug...] (≥1), covers_conventions: [C-id...] (≥1), playable_html, status}`.
- `playable_html` = what would prove this module works *as an HTML prototype* (gamemaker-kit prototypes in HTML first; engine-level acceptance is `gmk-port`'s job, not here).
- `covers_pillars` references pillar **slugs** (not labels) — same id space as `pillars[]`.
- Present the candidates to the user. The user ratifies which to build first: mark that one `status: "approved"`, the rest `status: "draft"`. **The kit proposes the decomposition; the user picks what's real.**

### Step 5 — User confirmation gate (concept ★gate 1)

Before writing the final file, show the user a plain summary of the contract: the conventions (which are gated by a number vs flagged needs_metric), the pillars with their source conventions, and the module candidates. Get explicit approval or revisions. **Never finalize a contract the user hasn't seen** — Layer 1.5 is a confirmation gate, not an automatic transform.

Record the approval (a line in research-notes / resume noting "ratified genre-decisions").

### Step 6 — Write the contract (atomic) + point the next step

Write `.gamemaker-kit/genre-decisions.json` via write-temp-then-rename (never leave a partial file).

Then update `gmk-init`'s "Next:" block is already done at init time; from here the next step is `/gmk-roadmap` or `/gmk-module-build` (S3) — tell the user which: *"Contract locked. Next: /gmk-module-build to build the approved module, or /gmk-roadmap to sequence all candidates."*

Update the resume point / HANDOFF as the final sub-step (P8).

## genre-decisions.json schema

```json
{
  "schema_version": "1.0",
  "kit_version": "1.0.0",
  "project_name": "...",
  "source_reference": { "seed": "...", "research_notes": ".gamemaker-kit/research-notes.md", "synthesized_at": "<ISO8601>" },
  "conventions": [
    {
      "id": "C1",
      "category": "failure | progression | mechanics | session",
      "statement": "...",
      "source_urls": ["..."],
      "cross_ref_strength": "genre-wide | family | single",
      "verified": true,
      "acceptance": { "metric": "...", "op": ">=|<=|==|range", "value": "<n | [lo,hi]>" },
      "needs_metric": false
    }
  ],
  "anti_tropes": [
    { "id": "A1", "statement": "...", "flagged_by_refs": 2, "source_urls": ["..."] }
  ],
  "pillars": [
    {
      "id": "<slug — shared with pillars.json>",
      "ratification_label": "PC1",
      "name": "...",
      "kind": "sensory | behavioral | decision-shape | emotional",
      "from_conventions": ["C1", "C2"],
      "anti_example": "...",
      "acceptance": null
    }
  ],
  "modules": [
    {
      "id": "M1",
      "name": "...",
      "covers_pillars": ["<slug>"],
      "covers_conventions": ["C1"],
      "playable_html": "...",
      "status": "approved | draft"
    }
  ]
}
```

Field rules: every `id` required and regex-valid (`C\d+` / `A\d+` / `M\d+`; pillar id = slug). `conventions[].acceptance` is the object (numeric) OR `null` with `needs_metric: true` (qualitative). `pillars[].from_conventions` non-empty.

## How Layer 2 reads it (the point of all this)

```js
const gd = JSON.parse(fs.readFileSync('.gamemaker-kit/genre-decisions.json', 'utf8'));
// assert gd.schema_version, then read gd.modules / gd.pillars / gd.conventions directly.
```

No regex over prose, no markdown AST. One parse, field access. That is what Layer 1.5 buys.

## Reject rules (STOP — don't write a broken contract)

- `JSON.parse` would fail → fix before write.
- A convention/anti-trope/module id fails its regex.
- A `pillars[].id` is not a slug (lowercase + hyphens).
- A `pillars[].from_conventions` is empty (P9 violation — pillar not traceable to research).
- A `pillars[].ratification_label` is not among the *adopted* candidates in research-notes.
- An `anti_tropes[].flagged_by_refs < 2`.
- A `modules[].covers_pillars` references a slug not in `pillars[]`.

## Notes for the model running this skill

- **The contract is the user's, not yours.** Step 5 is non-negotiable — translation can be wrong, and the user catches what the research couldn't.
- **Honesty over completeness in acceptance.** A `needs_metric: true` flag is more useful than a fabricated metric. S1.5's job is to mark what's measurable, not to pretend everything is.
- **Pillars share IDs with `pillars.json`.** This is the seam that keeps the whole kit's pillar tracking coherent. Don't fork the id space.
- **Modules are candidates, not commitments.** Most projects approve one and build it before deciding the rest — that's the kit's "one separable playable at a time" rhythm, not indecision.
