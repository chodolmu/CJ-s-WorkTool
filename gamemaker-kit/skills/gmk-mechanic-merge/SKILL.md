---
name: gmk-mechanic-merge
description: Produce a written spec for combining two PASS-verdict prototypes into a single integration milestone. Surfaces interaction risks (action-space explosion, pillar conflict, validator collision) and writes a new milestone entry with a unified hypothesis. Use when the user says "/gmk-mechanic-merge m1+m3", "merge two mechanics", "두 마일스톤 합치기", or after multiple isolated milestones pass and the user wants to see if they compose. Read milestones.json + writes one new entry.
model: sonnet
---

# gmk-mechanic-merge — Two PASS prototypes → one integration spec

The kit's per-milestone prototype model is **isolation-first**: each mechanic is tested alone. That's a strength (clean signal, fast iteration) and a risk (mechanics that PASS alone may *not* compose). This skill produces the spec for testing composition.

The output is **not** the merged prototype itself — it's a spec milestone with a new hypothesis that captures the *interaction* between the two source mechanics. The user then runs `/gmk-prototype` against the new spec.

Importantly: **mechanic-merge is not the same as feature-stacking**. Stacking two features is "ship both." Merging mechanics is "test the *interaction* — does the feel of A change when B is also present?"

## When this skill is the right tool

✅ Use:
- Two milestones both have `validation.verdict === 'PASS'` and `self_test.latest_verdict === 'PASS'` (both gates)
- You're about to port multiple milestones to the same engine project
- You suspect (or know) the mechanics interact (shared state, shared input model, shared pillar)

❌ Skip:
- The mechanics are obviously orthogonal (different pillars, different state, different input model) — they probably compose fine; just port both
- Either milestone hasn't passed both bot and self-test yet — merging unvalidated mechanics multiplies the unknowns
- One mechanic strongly contradicts the other's pillar (use `/gmk-kill-milestone` on one first)

## Preconditions

1. **Two milestone IDs**, both:
   - Exist in `milestones.json`
   - `killed !== true`
   - `validation?.verdict === 'PASS'` and `self_test?.latest_verdict === 'PASS'`
2. **A new milestone ID** for the merge target. Conventionally `m{a}+{b}-{slug}` (e.g., `m1+m3-merge-and-greed`). The slug names the *interaction* being tested, not just the union.
3. **The two milestones share at least one structural commonality** — same shape, same input model, or same pillar. If they share nothing (grid + continuous + dialogue), refuse:
   - *"m1 is grid; m3 is continuous. These don't compose in one HTML prototype. Either pick a single shape for the merge, or this isn't a 'merge' — it's 'ship both and hope.'"*

_Standard preconditions (milestone-id resolution, empty/partial state, refuse-chain cycle guard) follow `gmk-prototype-rules` Rule 13-14._

## Flow

### Step 1 — Show the source pair

Read both milestones and summarize what's being merged:

```
Merging:
  m1-merge-feel              (PASS bot, PASS self-test)
    Pillar:   tactile-satisfaction
    Shape:    grid
    IF:       80ms hit-stop + screen shake + 8-particle burst
    THEN:     session length > 4 min

  m3-greed-meter             (PASS bot, PASS self-test)
    Pillar:   greed-vs-safety
    Shape:    grid
    IF:       score multiplier decays if you wait > 2 sec
    THEN:     bimodal action timing (rush/think clusters)

Target: m1+m3-rush-feel
```

### Step 2 — Walk the interaction risk catalog

Five risks. Surface each with severity (🔴 / 🟡 / 🟢) and what the user should watch for.

#### Risk 1 — Action-space explosion

Each milestone defines its own `legalActions()`. Merging means *both* action sets are simultaneously available, which multiplies the bot's exploration cost.

- Both milestones have small, disjoint action spaces (≤ 10 each, no overlap): 🟢 — merged space is manageable
- Action spaces overlap (same action exists in both, e.g., both call `act({type:'merge'})`): 🟡 — semantics may differ between milestones; specify which behavior wins
- One milestone has > 20 actions per state: 🟡-🔴 — bot validation slows; consider sub-sampling or reducing in the merged prototype

#### Risk 2 — Pillar conflict

Each milestone targets specific pillars. Merged mechanics might:

- Reinforce both pillars (additive): 🟢
- Strengthen one at the cost of the other (zero-sum): 🟡 — explicit tradeoff; document it in the hypothesis
- Outright conflict (e.g., tactile-satisfaction relies on slow chunky merges; greed-vs-safety relies on fast greedy moves): 🔴 — flag the conflict; suggest revising one source or running `/gmk-kill-milestone`

#### Risk 3 — Validator metric collision

Each milestone's hypothesis declares specific `measured_by` rows. Merged hypothesis must reconcile:

- Metrics are disjoint (m1 measures `session_length_avg_ms`, m3 measures `time_between_actions_distribution`): 🟢 — both can be measured in the merged validate run
- Metrics overlap with same target (both want `session_length_avg_ms > 240000`): 🟢 — agreement; pick one and reference both source IDs
- Metrics overlap with **conflicting** targets: 🔴 — surface the conflict explicitly; *the merged hypothesis must pick one or define a new metric*
- Metrics have incompatible `kind` (one bot, one self-test): 🟡 — both still measurable; the merged validate run covers bot, the merged self-test session covers self-test

#### Risk 4 — Hook callback divergence

Each milestone's hook implementation made choices (state shape, action descriptors, optional callbacks). Merging requires:

- Identical state shape — usually requires rewriting both halves into one state object. 🟡 by default; 🟢 if both source state objects are compatible.
- Compatible action descriptors — if one used `{type:'merge', from, to}` and the other used `{type:'merge', src, dst}`, the merged hook normalizes. 🟡.
- Optional callbacks (Wave B) — if one milestone implemented `riskEstimate` and the other didn't, the merged hook needs to provide it across both action types. 🟡.

#### Risk 5 — Hypothesis sharpening (the merge's own hypothesis)

A merged milestone needs its own falsifiable hypothesis — **not the union of the two source hypotheses**. This is the hard part.

A good merged hypothesis names the **interaction**: what happens when both mechanics are present that doesn't happen with either alone?

- Good: *"IF merging + greed-decay are both active, THEN session-length stays high (m1's signal) AND timing-bimodality emerges (m3's signal) AND a *new* pattern emerges: players who decay-out still want one more merge (= retention on lose state)"*
- Bad: *"IF m1+m3, THEN session length > 4min AND timing-bimodal"* — that's just measuring both old hypotheses with no claim about interaction

If the user can't articulate the interaction, the merge isn't ready. Push back:

> "What does the merged mechanic do that *neither alone* does? If the answer is 'nothing, they just coexist,' you don't need /gmk-mechanic-merge — just port both separately into the engine project."

### Step 3 — Co-author the merged hypothesis

Walk three slots:

**Combined IF** — what's in the merged prototype that's in *neither* source alone?
> Example: *"the player has both merging (m1) and decay (m3) active simultaneously, with the decay timer pausing for 200ms after a successful merge"*

The "pausing for 200ms after merge" is the **interaction-specific** bit; it's neither in m1 alone nor m3 alone. That's what this milestone tests.

**Combined THEN** — what new behavior or feel does the interaction produce?
> Example: *"players develop a 'breathe' rhythm — fast merge chains punctuated by deliberate pauses to read the board, which neither mechanic produces alone"*

**Combined MEASURED BY** — at least one bot metric AND at least one self-test signal that *specifically* measures the new behavior:
> Bot: *"bimodal action timing with a third cluster centered around 200-400ms gap (the 'reading' pause) — neither source hypothesis predicts this third cluster"*
> Self-test: *"user reports awareness of the 'breathe' rhythm, or equivalent metaphor"*

The bot metric named here should be **new** — not a copy of the source metrics. If the merged metric is just the union of source metrics, the hypothesis isn't about the interaction.

### Step 4 — Show the merged milestone draft

```
Draft for m1+m3-rush-feel:

  Pillars targeted: tactile-satisfaction, greed-vs-safety
  Shape: grid  (inherited from both sources)
  Source milestones: m1-merge-feel, m3-greed-meter

  Hypothesis:
    IF   the player has merge + decay active simultaneously, with decay paused
         for 200ms after a successful merge
    THEN players develop a 'breathe' rhythm — fast merge chains punctuated by
         deliberate pauses to read the board
    MEASURED BY:
      bot:       three-mode action timing distribution (rush <800ms, decay-flight 800-2000ms,
                 breathe 200-400ms) — n=200, conf=0.85
      self-test: user names the 'breathe' rhythm or describes deliberate pauses for board-reading

  Interaction risks (from catalog):
    🟢 Action space: disjoint, total 12 actions max per state
    🟡 Pillar conflict: tactile favors slow chunky merges; greed-vs-safety favors fast greedy.
        The 200ms pause is the negotiation. If the bot doesn't show the breathe cluster, the
        pause isn't doing its job.
    🟢 Metric collision: source metrics are disjoint; merged metric (three-mode) is new
    🟡 Hook divergence: both used {type:'merge', from, to} — compatible
    🟢 Hypothesis sharpening: new metric (three-mode distribution) specifically tests the interaction

  Notes on what would FAIL this:
    - If the bot shows only two clusters (rush + decay-flight, no breathe) → the 200ms pause
      isn't long enough; the interaction collapses to "decay always wins"
    - If the bot shows breathe but self-test doesn't notice → the pause is doing technical work
      but not creating felt rhythm; tactile pillar isn't landing
    - If session_length_avg_ms drops below m1's standalone 4min → the decay overrides the
      merge feel; tactile pillar weakened

Write this milestone to milestones.json?
```

### Step 5 — Confirm and write

Wait for explicit user confirmation. On approval, append to `milestones.json`:

```json
{
  "id": "m1+m3-rush-feel",
  "name": "Rush feel — merge + decay interaction",
  "pillars_targeted": ["tactile-satisfaction", "greed-vs-safety"],
  "hypothesis": {
    "if": "...",
    "then": "...",
    "measured_by": [
      { "metric": "three_mode_action_timing", "kind": "bot", "target": {...}, ... },
      { "metric": "user_names_breathe_rhythm", "kind": "self-test", ... }
    ]
  },
  "prototype": null,
  "shape": "grid",
  "created_at": "...",
  "_source_milestones": ["m1-merge-feel", "m3-greed-meter"],
  "_interaction_risks": [
    { "risk": "pillar_conflict", "severity": "medium", "note": "tactile vs greed negotiated via 200ms pause" }
  ]
}
```

`_source_milestones` and `_interaction_risks` are advisory fields — the kit doesn't enforce them, but `/gmk-status` can surface them.

### Step 6 — Print the next step

```
m1+m3-rush-feel written.

Source milestones (m1, m3) remain unmodified — they're still PASS in their own right.

Next:
  /gmk-shape-advisor m1+m3-rush-feel   (sanity-check the inherited shape)
  /gmk-prototype m1+m3-rush-feel       (write the merged HTML prototype)
  /gmk-task-split m1+m3-rush-feel      (split into discipline tasks once prototype exists)
```

## Edge cases & policy

### User wants to merge 3+ milestones at once

Refuse. *"Merge two at a time. Three-way interaction has too many variables to isolate — if m1+m2+m3 fails, you can't tell which pair is the problem. Merge m1+m2 first, then (if that passes) merge (m1+m2)+m3."*

### Source milestones share a pillar but contradict the *meaning* of that pillar

Surface the contradiction during Step 2 Risk 2:

> *"Both m1 and m3 target tactile-satisfaction, but m1 reads tactile as 'chunky merges' and m3 reads it as 'urgent panic.' These are different shapes of tactile. Merging them likely produces a hypothesis that one of them already covers. Are you sure you want a separate merge milestone, or should one of them be cut?"*

### One source milestone is shipped (ported, dev-complete) and one is still pre-port

OK. The merge milestone tests the interaction; it doesn't change the ported milestone's status. The user can later port the merge milestone independently.

### Source milestones share an ID prefix (m1 and m1b)

Allowed. The user split m1 earlier into m1a and m1b; merging back is a valid move. Surface in the report:

> *"Heads-up: m1a and m1b were split from m1. Merging them back means you're rejoining what was deliberately separated. The new merge milestone tests whether the original split was worth it — if the merge PASSES, the split may have been unnecessary."*

### User wants to *immediately* port the merge milestone without prototyping it

Refuse. *"Merge milestones go through the full pipeline: prototype → validate → self-test → port. Skipping prototype means porting an unvalidated interaction. The kit's value is catching interaction failures cheap; port-only skips the catch."*

### One source milestone fails the bot but the user wants to merge anyway

Refuse explicitly. *"m3-greed-meter has FAIL verdict. Merging an unvalidated mechanic with a PASS one inherits the failure into the new milestone with extra interaction risks. Fix or kill m3 first."*

## What this skill does NOT do

- **Doesn't write the merged HTML prototype.** That's `/gmk-prototype` after this skill produces the spec.
- **Doesn't run the merged validation.** That's `/gmk-validate` after the prototype is written.
- **Doesn't modify the source milestones.** Both sources retain their PASS verdicts; the merge is a separate entry.
- **Doesn't 3-way or N-way merge.** Two at a time only.
- **Doesn't auto-pick the merge name.** User picks the slug; the kit suggests `m{a}+{b}-{interaction-name}` but doesn't enforce.
- **Doesn't infer interactions.** If the user can't articulate the interaction, the skill stops and refuses to write the milestone. Co-authorship, not auto-generation.

## Notes for the model running this skill

- **The hardest part is the interaction-specific metric.** Most user attempts produce "union of source metrics," which doesn't test the interaction. Push for a *new* metric that's neither in m1 nor m3 alone.
- **Watch for "let's just put them both in the game" framing.** That's not a merge milestone — that's two separate ports. If the user can't say what changes about the *experience* by having both active, they're ship-stacking, not interaction-testing. Tell them: *"You don't need a merge milestone for this. Port both, ship both, done."*
- **Risk severities are independent of whether to proceed.** A 🔴 isn't a refusal — it's a flag. The user decides.
- **Source milestones' `validation.metrics` is useful here**. If m1's `clear_rate` is 67% and m3's is 88%, the merge milestone shouldn't *automatically* expect 88% — the interaction may suppress one of them. Mention this if relevant: *"m1's clear_rate baseline is 67%. After merge, expect this to drop if the decay timer punishes slow play."*
- **Don't generate the merged hypothesis alone.** Co-author. Solo-model hypotheses sound clean but miss what the user knows about their own mechanic.
- **Cite gmk-prototype-rules when the merge requires rule revisits**. Combined action space may exceed the 50-actions-per-state heuristic for grid shape, etc.
