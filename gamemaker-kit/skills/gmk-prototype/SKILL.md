---
name: gmk-prototype
description: Generate a single-file HTML prototype for one milestone — bind it to Pillars, write a falsifiable Fun Hypothesis with strict measured_by schema (kind/target/confidence/sample_size), pick the shape via /gmk-shape-advisor, inject the standard __gmk_botHook__ via the shared library so /gmk-validate can drive headless bots. Enforces gmk-prototype-rules (single file, 300/600 line caps, deterministic seeding, hypothesis header parseability, kind∈{bot,self-test}). Use when the user says "/gmk-prototype <name>", "make a prototype", "마일스톤 프로토타입", or wants to test one mechanic before committing to the engine. Run AFTER /gmk-init.
model: sonnet
---

# gmk-prototype — One mechanic, one HTML file, one falsifiable hypothesis

The point of this skill is **structural cheapness**. A milestone you can throw away in 30 seconds is a milestone you'll honestly evaluate. The moment a prototype lives in the real engine project, sunk cost takes over and the team ships dead weight.

So: **one HTML file, single Pillar focus, single falsifiable hypothesis, bot hook required.** Everything beyond that — line caps, hook API surface, deterministic-seeding rules, hypothesis header format — is enforced by **`gmk-prototype-rules`**. That skill is the canonical rulebook; this skill *cites* it rather than restating it.

If you hit a rule violation, the message names which rule and points at the rulebook. Example: *"Refused: hypothesis header missing `Shape:` field (gmk-prototype-rules §8). Add it and rerun."*

## Preconditions

Before writing anything, verify:

1. **`pillars.json` exists** at `{project}/.gamemaker-kit/pillars.json`.
   - Missing: stop. *"No Pillars yet. Run /gmk-init first — Pillars are the lens this prototype gets judged against. [Rule 14] /gmk-prototype → /gmk-init — verified target's preconditions can be satisfied from current state."*
   - `pillars: []` and `skipped: true`: warn the user *"Pillars were skipped at init. This prototype won't have a north star to bind its hypothesis to. Run /gmk-init properly first? [Rule 14] /gmk-prototype → /gmk-init — verified target's preconditions can be satisfied from current state."* Only continue if they explicitly say yes.
2. **`prototypes/` directory exists**. Create if not.
3. **`milestones.json` exists**. Create as `{ "project_name": "...", "milestones": [] }` if missing. Schema reference: `_workspace/examples/milestones-example.json`.
4. **`templates/_bot_hook_lib.js` reachable**. The prototype either inlines the library (Rule 7 Option B) or references it via `<script src>` (Option A). Either way, the kit's `templates/_bot_hook_lib.js` is the canonical source.

_Standard preconditions (milestone-id resolution, empty/partial state, refuse-chain cycle guard, kit_version read contract, pillars.kind read contract) follow `gmk-prototype-rules` Rule 13-14, 16, 17._

## Flow

### Step 0.5 — Detect project mode (early redirect guard)

First, before naming a milestone, check which mode this project is in (the detection rule is defined canonically in `gmk-module-build` Step 1 — `genre-decisions.json` exists → `reference-clone`, else `blank-page`):

- **`genre-decisions.json` exists (reference-clone mode):** this project has a researched reference contract. The primary build path is `/gmk-module-build <Mn>` (it clones an approved module, gated by reference-fidelity). A `/gmk-prototype` here means a **differentiation hypothesis** — your own idea that is *not* in the reference. Confirm: *"This project is reference-clone mode. To build an approved module, use /gmk-module-build. This prototype is for a differentiation idea (something the reference doesn't have) — is that what you want?"* If yes, fall through to Step 1 (the hypothesis path below is unchanged). If no, redirect to `/gmk-module-build` and stop.
- **No `genre-decisions.json` (blank-page mode):** the standard hypothesis-driven path. Fall through to Step 1 with no change.

This guard only *redirects*; it never alters Steps 1-7. Both blank-page and reference-clone-differentiation reach the unchanged hypothesis flow below.

### Step 1 — Get the milestone name

Skill input is `<name>` — a short slug like `m1-merge-feel`. Convention: `m{N}-{kebab-slug}`. If the user gave a sentence ("test the merge satisfaction"), translate to a slug and confirm.

Reject if a prototype with that name already exists at `prototypes/<name>.html`. Offer:
- overwrite (only with explicit confirmation — old version is destroyed; if `validation` or `self_test` already exist on the milestone, warn that those will be invalidated against the new code)
- new name (`m1-merge-feel-v2`)
- different milestone

### Step 2 — Bind to Pillars

Read `pillars.json`. Show available pillars in plain language. Ask which 1-2 this prototype targets. Push back at 3+: *"Three pillars in one prototype usually means the hypothesis isn't sharp enough. Narrow to the one or two the milestone is really about?"* If they insist, accept.

Capture as `pillars_targeted: ["tactile-satisfaction"]`.

### Step 3 — Write the Fun Hypothesis (schema-strict)

Hypothesis is the falsifiable load-bearing part. Walk through three slots:

**If** — what mechanic/change does this prototype implement?

**Then** — what does the player do, decide, or feel that strengthens the targeted pillar?

**Measured by** — at least one **bot** row AND at least one **self-test** row, each with the v0.2 strict schema:

```json
{
  "metric": "session_length_avg_ms",
  "kind": "bot",                          // required: 'bot' | 'self-test' (per gmk-prototype-rules §10)
  "target": { "op": ">", "value": 240000 },  // required: {op: '>'|'<'|'=='|'between', value}
  "confidence": 0.90,                     // required for kind:'bot' (0.80|0.90|0.95)
  "sample_size": 200,                     // required for kind:'bot' (matches --runs default)
  "early_fail": { "after_runs": 30, "condition": "session_length_avg_ms < 60000" }  // optional, enables Trial pruning
}
```

For `kind: 'self-test'` rows, `confidence` and `sample_size` are not required (the user's gut call doesn't have a binomial CI). `target` for self-test usually reads `{ op: '==', value: 'PASS' }` — see structure.md / `gmk-self-test`.

**The schema gate is strict.** Refuse to write the file if:

| Missing | Refuse with |
|---|---|
| zero `kind: 'bot'` rows | *"Hypothesis has no bot row. Add one — `/gmk-validate` needs at least one measurable metric or it can't gate anything (gmk-prototype-rules §10)."* |
| zero `kind: 'self-test'` rows | *"Hypothesis has no self-test row. Bot-only hypotheses can't tell you about feel — that's a known smell. Add one or override with `--bot-only` (rare)."* |
| `kind` not in `{bot, self-test}` | *"Invalid kind `<x>`. Allowed: bot, self-test (gmk-prototype-rules §10). `human` is deprecated; treat as `self-test`."* |
| `target` is a freeform string like `"> 4min"` | Offer to migrate to structured form: *"v0.2 uses structured targets. `\"> 4min\"` → `{op: '>', value: 240000}`. Apply?"* |
| bot row missing `confidence` or `sample_size` | *"Bot rows need confidence (0.80/0.90/0.95) and sample_size — `/gmk-validate` uses these for CI checks."* |

The pillar shape should match the measurement type (from `gmk-init`). Read the pillar's `kind` field first (per gmk-prototype-rules Rule 17 — values: `sensory` / `behavioral` / `decision-shape` / `emotional`). If `kind` is absent (pre-v0.4 pillars or hand-edited files), fall back to free-text classification on the pillar's `name` + `description`.

- **Behavioral pillar** (`kind: "behavioral"`) → behavioral metric (restart time, session length, action frequency)
- **Decision-shape pillar** (`kind: "decision-shape"`) → decision metric (action diversity, dominant strategy ratio)
- **Sensory pillar** (`kind: "sensory"`) → user's-own-language signal ("juicy", "chunky", "satisfying") + behavioral proxy
- **Emotional pillar** (`kind: "emotional"`) → user self-report + behavioral proxy

If the user proposes a Then like *"the game is fun"* — push back. *"'Fun' is what we're trying to prove, not what we measure. What does a fun-having player **do** differently?"*

### Step 4 — Pick the prototype shape (delegate to gmk-shape-advisor)

A prototype must declare one of: `grid | continuous | dialogue | shader`. Ask the user, or if they're unsure, defer to `/gmk-shape-advisor` (decision tree: shader Q1 → dialogue Q2 → continuous Q3 → grid default).

`shape` drives the template selected in Step 5 AND the bot policy default in `/gmk-validate`.

**`shape: 'shader'`** is **intentionally minimal** — the template provides a single fullscreen fragment shader, a uniform clock, and 1-axis interaction. The bot hook is wired but bot validation returns INCONCLUSIVE by design (bots can't judge visual fun). Self-test is the gate for shader milestones; see `gmk-prototype-rules` Rule 11.

- Accept the `shape: 'shader'` declaration in the hypothesis header.
- Generate the WebGL2 shader scaffold (vertex pass-through + a fragment shader the user fills in) with the standard bot hook attached but `legalActions()` returning `[{ type: 'time-tick', dt: 16 }]` only.
- Print a banner: *"Shader shape: bot validation produces INCONCLUSIVE by design. `/gmk-self-test` is the gate for this milestone. See `gmk-prototype-rules` Rule 11."*
- Don't refuse — shader prototypes still benefit from the schema and self-test loop.

Flag `--type=shader` is equivalent to setting `shape: 'shader'` in the hypothesis interactively.

### Step 4.5 — Route to domain agents when shape/hypothesis fits

After the shape is chosen and the hypothesis is schema-strict, decide whether downstream tuning is best done by a domain agent rather than freehand:

| Trigger | Recommended agent | Why |
|---|---|---|
| `shape: 'continuous'` OR `shape: 'shader'` | `feel-engineer` | Continuous + shader prototypes live or die on sensory parameters (lerp, hit-stop, particle counts, easing curves). The agent produces `feel-numbers.md` + `feel-edits.md` with auditable range sweeps. |
| Any sensory pillar (`tactile-satisfaction`, `responsiveness`, sensation language in pillar text) | `feel-engineer` | Same reason — sensory layer needs the agent's catalog of typical ranges. |
| Any `kind: 'bot'` row whose `metric` ∈ `{dominant_strategy_ratio, action_entropy, clear_rate, frustration_proxy}` AND the milestone involves numeric balance (costs, drop rates, tier curves, XP) | `economy-balancer` | Numeric balance needs metric-anchored knobs. The agent refuses to balance without a structured `target: {op, value}` row — which Step 3 just enforced. |
| `shape: 'grid'` with no numeric balance content AND no sensory pillar | (none) | The base SKILL flow is enough. |
| `shape: 'dialogue'` | (route to `gmk-narrative` SKILL, not an agent) | Dialogue spec is a SKILL, not an agent. |

If a trigger fires, **do not auto-invoke**. Add the recommendation to the "Next" message in Step 7 (the user invokes `@feel-engineer <id>` or `@economy-balancer <id>` themselves). The agent's preconditions (system spec exists, hypothesis is schema-strict) are already satisfied by the time this skill finishes its own steps.

_The routing output follows `gmk-prototype-rules` Rule 15 (agent routing block format)._

If both `feel-engineer` and `economy-balancer` triggers fire (rare — a prototype that combines a sensory feedback loop with an economy curve), recommend **`feel-engineer` first** then `economy-balancer`. Feel and economy can interact (reward-feel coupling), and tuning feel first gives economy clean ground.

### Step 5 — Generate the HTML file

The file structure follows `gmk-prototype-rules` §4 (hook API), §7 (library inline vs `<script src>`), §8 (hypothesis header), §9 (bounded runs). Rather than restating the rules here, this section names the parts:

1. **Hypothesis header comment** — exactly the format in `gmk-prototype-rules` §8. The header is **parsed** by `/gmk-validate` and `/gmk-self-test`; malformed headers are a hard refusal at validate time. Include:
   - `gamemaker-kit milestone: <id>`
   - `Pillars targeted: <comma-separated IDs>`
   - `Hypothesis:` block with IF / THEN / MEASURED BY rows (the MEASURED BY rows mirror the structured schema in Step 3 — bot rows show metric + target + (n=, conf=); self-test rows show metric + target)
   - `Created: <ISO-8601 with TZ>`
   - `Shape: grid | continuous | dialogue | shader`

2. **Single `<style>` block** — minimal CSS. No external CSS. Wireframe-grade visuals; you're testing the mechanic, not art-directing.

3. **Single `<canvas>` or `<div id="game">`** — no framework imports. Vanilla JS only (per `gmk-prototype-rules` §6).

4. **Library reference** (per `gmk-prototype-rules` §7) — default to Option A (`<script src="_bot_hook_lib.js"></script>`) for in-project prototypes; copy the canonical library file from `templates/_bot_hook_lib.js` to `prototypes/_bot_hook_lib.js` if not already present. Switch to Option B (inline) only if the user wants a portable single-file artifact.

5. **Game logic** — only enough to make the mechanic in the hypothesis testable. Not the full game.

6. **`window.__gmk_botHook__` via `__gmk.makeHook(spec)`** (the only sanctioned construction path). Provide the 5 required callbacks (`reset`, `isOver`, `legalActions`, `apply`, `collectSummary`). **Wave B**: also provide as many of the 4 optional callbacks (`stateSignature`, `riskEstimate`, `progressEstimate`, `noveltyScore`) as the mechanic supports honestly. Per `gmk-prototype-rules` §4: a fake `riskEstimate` that always returns `0.5` is worse than omitting it.

7. **Bounded runs** — leave the library's defaults (5000 actions, 600 sec sim) unless the milestone has a clear reason to override.

8. **Line counting per `gmk-prototype-rules` §2**:
   - Under 300: emit nothing.
   - 300 ≤ N < 600: write `<!-- WARNING: 300-line soft cap reached -->` into the file AND tell the user *"Approaching the soft cap. The prototype is doing more than one thing — consider splitting into a second milestone."*
   - N ≥ 600: refuse to add code. *"Hard cap. This isn't a prototype anymore. Split into m{N}a / m{N}b or rethink scope (gmk-prototype-rules §2)."* Don't write the file.

### Step 6 — Append to `milestones.json`

Use the v0.2 schema (full reference: `_workspace/examples/milestones-example.json`). Backward-compat: v0.1 entries without `tasks[]`, `self_test`, `merge_gate`, `ported_to.re_validation` still validate.

```json
{
  "id": "m1-merge-feel",
  "name": "Merge feel",
  "pillars_targeted": ["tactile-satisfaction"],
  "hypothesis": {
    "if": "two dragons merging triggers 0.3s hit-stop + screen shake + 8-particle burst",
    "then": "the player loses track of time within 5 minutes",
    "measured_by": [
      {
        "metric": "session_length_avg_ms",
        "kind": "bot",
        "target": { "op": ">", "value": 240000 },
        "confidence": 0.90,
        "sample_size": 200,
        "early_fail": { "after_runs": 30, "condition": "session_length_avg_ms < 60000" }
      },
      {
        "metric": "user_says_satisfying",
        "kind": "self-test",
        "target": { "op": "==", "value": "PASS" }
      }
    ],
    "trials": []
  },
  "prototype": "prototypes/m1-merge-feel.html",
  "shape": "grid",
  "created_at": "2026-05-12T22:00:00+09:00",
  "tasks": [],
  "validation": null,
  "self_test": null,
  "merge_gate": null,
  "ported_to": null,
  "killed": false
}
```

If the user invoked Step 3 with `--bot-only` (skipping the self-test row), the entry's hypothesis still lists a placeholder self-test row with `verdict: "PASS"` deferred to the user. **Do not** silently omit it — the schema gate at validate time expects both kinds.

### Step 7 — Open the file (optional)

If the user is on a graphical OS, offer to open the file in the default browser. Don't auto-open.

## v0.1 → v0.2 migration: `human:` header rows

If the user reopens a v0.1 prototype to extend it (re-running `/gmk-prototype <existing-name>` with overwrite), check the existing header for `human:` MEASURED BY rows. Per `gmk-prototype-rules` Rule 10:

- Warn once: *"v0.1 header uses `human:` rows. v0.2 deprecates this — `kind` is `bot | self-test` only, no external-human channel. Migrating to `self-test:` (gmk-prototype-rules §10)."*
- Rewrite the header rows: `human:` → `self-test:`.
- Update `milestones.json` `measured_by[].kind` from `'human'` to `'self-test'`.
- Don't migrate silently and don't ask permission per-row; one warn + bulk migration.

## Sub-flags

| Flag | Default | Effect | Side-effect |
|---|---|---|---|
| `--type <shape>` | (asked) | Equivalent to setting `shape: <value>` non-interactively. Valid values: `grid` / `continuous` / `dialogue` / `shader`. Skips the shape-advisor prompt. | `milestones[].shape` set. |
| `--bot-only` | — | Skips the prompt for a self-test row at hypothesis-authoring time. The hypothesis still lists a placeholder self-test row with `verdict: "PASS"` *deferred* to the user — the placeholder exists only to satisfy the schema gate, and the user is expected to overwrite it (with a real PASS/FAIL) when they actually self-test. Downstream skills (`gmk-validate`, `gmk-self-test`) treat the placeholder as "self-test not yet performed", not as a passing gate. | `hypothesis.measured_by` gets one placeholder `kind: 'self-test'` row with `_placeholder: true`. |
| `--regen` | — | Regenerates the HTML scaffold from the current milestones.json entry. Used after a kill+revive cycle, or after editing the hypothesis and wanting a fresh scaffold. Preserves the existing prototype file with `.bak` suffix; the user merges hand-edits manually. | None — only the prototype file changes. |

`--bot-only` is *not* an attestation that self-test is unnecessary; it's an attestation that the user wants to author the self-test row later. The schema gate (placeholder PASS) keeps `gmk-validate` from refusing on row-count grounds, but `gmk-self-test` will still flag the placeholder as "not yet performed" when it runs.

## What this skill does NOT do

- **Doesn't restate the rulebook.** Caps, hook API surface, header format, RNG rules, library options live in `gmk-prototype-rules`. Cite the section number when you enforce.
- **Doesn't generate art-directed prototypes.** Wireframe-grade visuals only — the user falls in love with the wrapper otherwise and the mechanic test gets lost.
- **Doesn't add features beyond the hypothesis.** No pause menus, settings, death animations. Lines spent there aren't lines spent on the mechanic.
- **Doesn't validate.** That's `/gmk-validate`. Generation ends with the file written + milestone registered.
- **Doesn't share / deploy.** External release is out of scope (`gmk-share` is removed in v0.2).
- **Doesn't accept hypothesis without a self-test row by default.** Pure-bot hypotheses are a smell; force the user to acknowledge with `--bot-only`.
- **Doesn't ship a "full" shader template.** The shader scaffold is intentionally minimal — INCONCLUSIVE-by-design bot verdict, self-test as the gate (Rule 11). Active code generation for shader logic is a user task.

## Output: tell the user what happens next

```
Prototype written: prototypes/m1-merge-feel.html ({lines} lines)
Milestone registered in .gamemaker-kit/milestones.json
Pillars: tactile-satisfaction
Shape: grid
Hypothesis:
  IF   two dragons merging triggers 0.3s hit-stop + screen shake + 8-particle burst
  THEN the player loses track of time within 5 minutes
  MEASURED BY:
    bot       session_length_avg_ms > 240000   (n=200, conf=0.90, early_fail<60000@30)
    self-test user_says_satisfying == PASS

Next:
  1. Open prototypes/m1-merge-feel.html in a browser, click around for 60 seconds.
     If it doesn't immediately make you want to keep playing, /gmk-kill-milestone now —
     don't burn bot runs on a dead prototype.
  2. /gmk-task-split m1-merge-feel — break the milestone into per-discipline tasks if any
     remaining work spans art/audio/UX.
  3. /gmk-validate m1-merge-feel — runs 200 headless bot games (persona-mix), reports
     metrics + suspicious seeds for self-test.
  4. /gmk-self-test m1-merge-feel — your own play session against the suspicious seeds.

  (Optional, only if Step 4.5 triggers fired)
  5. @feel-engineer m1-merge-feel — draft initial feel numbers (hit-stop / shake /
     particles / easing) before validation. Continuous + shader prototypes especially.
  6. @economy-balancer m1-merge-feel — tune numeric balance against the bot rows
     (dominant strategy / pacing / drop rates). Requires structured measured_by row.
```

## Notes for the model running this skill

- **The rulebook is the source.** When in doubt about caps, hook surface, or determinism rules, read `gmk-prototype-rules` and cite the section. Don't redefine here.
- **The bot hook is non-negotiable.** If you find yourself thinking "I'll add the hook later," stop and add it now — most of the rules (deterministic seeding, action-driven time, bounded runs) are easier to write *in* than to retrofit.
- **300 lines is the goal, not the budget.** A 180-line prototype is better than a 280-line one. Tight prototypes get tested honestly.
- **Don't fake optional callbacks.** A `noveltyScore` that always returns `0.5` pollutes the Explorer persona signal. Omit instead.
- **Hypothesis is structured.** Resist the v0.1 string-target style (`"> 4min"`). Always emit the structured `{op, value}` shape in `milestones.json`. The header comment can render it human-readable (`> 240000ms`), but the JSON is structured.
- **Pillar mismatch is a smell.** If the hypothesis doesn't actually strengthen the picked pillars, name it: *"This hypothesis is about session length, but the pillar is 'greed vs. safety' — those don't connect. Change the pillar binding, or sharpen the hypothesis."* Don't paper over.
- **`--bot-only` is exit-velocity, not normal.** Default is to refuse pure-bot hypotheses. Only accept the flag with a one-line acknowledgment from the user.
- **Cite the rulebook when refusing.** "/gmk-prototype refused (gmk-prototype-rules §8: hypothesis header missing Shape:)." gives the user a place to look.
- **Don't reach for `/gmk-share`.** It's removed. The "Next:" block ends at `/gmk-self-test`; porting is for after both gates clear.
