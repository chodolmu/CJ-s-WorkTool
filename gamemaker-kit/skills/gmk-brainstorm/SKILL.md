---
name: gmk-brainstorm
description: Run an opt-in 5-stage brainstorm (Frame → Diverge → Stress-test → Converge → Pillar Audit) for a stuck milestone or empty pillar slot, using the MDA lens (Mechanics / Dynamics / Aesthetics). Writes _workspace/brainstorms/M{n}-{slug}.md. Use when the user says "/gmk-brainstorm", "brainstorm milestone X", "I'm stuck", "막힌 마일스톤", or wants divergent ideas before committing to a hypothesis. Opt-in — skip if the user already knows what they want.
model: sonnet
---

# gmk-brainstorm — 5-stage divergence/convergence with pillar audit

Brainstorming is opt-in for a reason: when you know what you want to build, brainstorming is overhead. This skill is for the **other case** — you have a pillar with no milestone, or a milestone whose hypothesis you can't sharpen.

The 5 stages are non-negotiable. Skipping divergence (going straight to "let's build X") is how the kit ends up with one-pillar games where every milestone is a variation of the same idea.

## When this skill is the right tool

✅ Use when:
- A pillar has no milestone proposal that fits (gmk-roadmap surfaced a gap)
- A milestone's hypothesis keeps coming out fuzzy
- The user explicitly says "I want to brainstorm"
- An existing milestone failed and the user wants a fresh approach to the same pillar

❌ Don't use when:
- The user already has a clear mechanic in mind — go straight to `/gmk-prototype`
- The user is debugging an existing prototype — that's a prototype problem, not an ideation problem
- It's the start of a project — run `/gmk-init` and `/gmk-roadmap` first; brainstorm fills *gaps* in those, not the whole project

If the user invokes this skill when they don't actually need it, say so: *"You named a specific mechanic in your last sentence — sounds like you know what you want. We can skip brainstorming and go straight to /gmk-prototype. OK?"*

## Preconditions

1. **`pillars.json` exists.** Brainstorming without pillars is unfocused; refuse if missing or `skipped: true`.
2. **Brainstorm target** — the user must tell you what we're brainstorming about. Accepts:
   - A pillar ID — *"brainstorm for greed-vs-safety"*
   - An existing milestone ID — *"brainstorm m4-push-pull-greed, the hypothesis is too vague"*
   - A free-text problem — *"I want a mechanic that makes the player decide between speed and score"*
3. **`_workspace/brainstorms/` directory exists.** Create if missing.

## Flow

The 5 stages are run sequentially, with **the user in the loop at every stage**. Don't batch them.

### Stage 1 — Frame

Get the problem statement explicit. Read it back to the user.

Ask the user to fill three slots:

- **What pillar(s) is this for?** (1-2; if more than 2, the brainstorm will be unfocused)
- **What's the constraint?** (What can't we change? Examples: "must work in 2D grid", "must fit a 5-minute session", "must not require networking")
- **What's the discomfort?** (Why are you stuck — is the mechanic boring? Out of theme? Solving the wrong thing?)

If the user can't answer the constraint or discomfort, push back once: *"Without knowing what we can't change or why you're stuck, divergence is just random. Try this — what would be the **dumbest** version of a fix? That usually surfaces the constraint."*

Write Frame to the file (Step 7 covers writing). Show the framing back:

```
Frame
  Pillar(s): greed-vs-safety
  Constraint: 2D grid, ≤5min session, no networking
  Discomfort: my current ideas all reduce to "press button X for score" — there's no real tradeoff
```

### Stage 2 — Diverge (≥ 10 raw ideas)

Now generate ideas. **Use the MDA lens** — surface ideas from each of three layers:

| Layer | Question | Example outputs |
|-------|----------|-----------------|
| **Mechanics** (rules) | "What rule could create the tradeoff?" | "Score multiplier decays if you don't act every 3 sec" |
| **Dynamics** (behavior at play) | "What player behavior would emerge?" | "Players queue up moves to combo, get punished for hesitating" |
| **Aesthetics** (felt experience) | "What feeling does this produce?" | "Greedy panic — adrenaline of wanting one more move" |

For each idea, write a one-line description. **Aim for ≥10 ideas across all three layers.** Don't filter, don't quality-check yet — that's Stage 3's job. Wild ideas pull the median up.

Prompt the user for their ideas too. *"What did you have? Let me add to it."* The model and the user co-author this list. **Don't generate alone** — co-authored brainstorms surface what the user actually cares about; solo-model brainstorms surface what's in the training data.

End Stage 2 with the full list visible:

```
Diverge (12 ideas):
  M1.  Score multiplier decays if no move for 3 sec     (M)
  M2.  Combo doubles if next move within 1 sec, resets fully if you wait    (M)
  M3.  Every move costs a resource; doing nothing also costs less of it    (M)
  M4.  Risk pool that grows with score and triggers cascading game-over at threshold    (M)
  D1.  Players queue moves and watch them resolve — wrong queue is punished    (D)
  D2.  Players self-impose "I'll only merge X-tier or higher" rules    (D)
  D3.  Optional risk button: 2x score, 50% chance of -1 life    (D)
  D4.  Two boards in parallel — you split attention between them    (D)
  A1.  Color/sound shifts to anxious when score is high — sensory pressure    (A)
  A2.  Music speeds up with score — biological urgency    (A)
  A3.  Coin sound on every greedy move; thud on every safe one    (A)
  A4.  Visual "ghost" of optimal play shown after death — regret loop    (A)
```

### Stage 3 — Stress-test

Now apply pressure. For each idea, ask three questions in a small table:

| Idea | Risk (what kills this?) | Pillar fit (which pillar, how strong?) | Bot-measurable? |
|------|--------------------------|----------------------------------------|-----------------|
| M1 | Decay timer is annoying, not tense | greed-vs-safety (medium) | yes — `idle_time_distribution` |
| M2 | Players brute-force max combo, becomes optimization | greed-vs-safety (high if balanced) | yes — `combo_length_distribution` |
| M3 | Resource bookkeeping kills flow | greed-vs-safety (low — feels like an RPG) | yes |
| ... | ... | ... | ... |

**Walk every idea through this.** Don't skip "obvious good" ideas — the stress-test is what separates feeling-good from being-good.

After the table, name the **risk patterns**:
- "Three ideas die to 'becomes optimization' — the pillar is easy to break with min-maxing."
- "Two ideas are sensory-only — they decorate the tradeoff but don't create it."

Bot-measurable = `yes` is **not** a quality marker. It's a fact about the idea. Unmeasurable ideas can still be brilliant — they just need self-test as the gate, not bot validation.

### Stage 4 — Converge

Pick **1-3 ideas** to carry forward. Ask the user to point at the ones with:

- Strong pillar fit
- A measurable signal (bot or self-test)
- A failure mode they're willing to risk (something *could* go wrong, but it's a worthwhile risk)

If the user wants to keep more than 3, push back: *"More than three and we're back to a backlog. The point of Converge is to leave with something we can act on. Top 3?"*

For each surviving idea, write a **one-paragraph hypothesis draft**:

```
Survivor: M2 — Combo doubles within 1 sec, resets fully if you wait

Hypothesis draft:
  IF   each merge within 1 second of the previous doubles the score multiplier,
       and a 2+ second gap resets it to 1x
  THEN players adopt a "rush vs. think" loop — fast greedy plays vs. slow safe ones
  MEASURED BY:
    bot:        time_between_actions_distribution shows bimodal peaks (fast cluster <800ms, slow cluster >2s)
    self-test:  user can name the rush/think moments verbally
```

This draft becomes the hypothesis seed for `/gmk-prototype` later. **Don't** auto-write it into `milestones.json` — that's `/gmk-prototype`'s job, and it'll do its own pillar binding + falsification pass.

### Stage 5 — Pillar audit

For each surviving idea, ask the **hard question**:

> "If this mechanic ships and works perfectly, does the pillar actually land — or does it land **near** the pillar but not on it?"

This catches the trap where an idea is *adjacent* to a pillar but doesn't strengthen it. Examples:

- Pillar: `greed-vs-safety`. Idea: "combo decay forces fast play." Audit: this creates **rush**, not **tradeoff**. If the optimal play is always "go fast," there's no greed-vs-safety; it's just speed-vs-loss. Mark the idea as pillar-adjacent, not pillar-on.

For each surviving idea, classify:
- **Pillar-on** — strengthens the named pillar directly
- **Pillar-adjacent** — touches the pillar but doesn't create the experience the pillar names
- **Pillar-orthogonal** — interesting on its own, but for a different pillar

Pillar-orthogonal ideas aren't bad — write them down in the brainstorm output and ask the user: *"This one's interesting but it's actually a {other-pillar} idea. Should we add it to a brainstorm for that pillar, or shelve?"*

Pillar-adjacent ideas need either (a) reframing into pillar-on, or (b) cutting. **Don't keep pillar-adjacent ideas as-is** — they look like progress but produce milestones that "kind of work" without strengthening anything.

### Step 6 — Choose what becomes a milestone

End with a concrete recommendation:

```
Brainstorm output for greed-vs-safety:

Pillar-on (carry forward to /gmk-prototype):
  - M2: Combo doubles within 1 sec, resets fully if you wait
        → suggested milestone: m4-rush-vs-think

Pillar-adjacent (need reframing if you want to use):
  - M1: Score multiplier decays without action
        → creates rush, not tradeoff. Reframe?
  - D3: Optional risk button
        → creates risk-taking, not greed (greed implies wanting more; risk-taking accepts loss)

Pillar-orthogonal (interesting, but for different pillar):
  - A4: Ghost replay of optimal play shown after death
        → this is a discovery-joy or learning-loop idea, not greed-vs-safety

Next:
  /gmk-prototype m4-rush-vs-think
  or
  /gmk-brainstorm discovery-joy  (re-use the ghost-replay idea)
```

### Step 7 — Write `_workspace/brainstorms/M{n}-{slug}.md`

Write the full session to `_workspace/brainstorms/M{n}-{slug}.md`. **Never overwrite** an existing brainstorm — append a `-v2` suffix if the user is re-brainstorming the same target. Format follows `_workspace/structure.md` § brainstorms.

Filename: if the brainstorm target is a pillar (e.g., `greed-vs-safety`), name the file `pillar-greed-vs-safety-{date}.md`. If it's a milestone (e.g., `m4-push-pull-greed`), name it `m4-push-pull-greed-{date}.md`.

## Edge cases & policy

### User produces fewer than 10 diverge ideas

Push **once**: *"Ten is a floor, not a target — under ten and convergence has no real material. Want me to add three more from the MDA lens before we stress-test?"* If they say no, accept and continue with fewer; record the count in the file.

### User wants to skip stress-test ("I already know which one I want")

That's a sign brainstorming wasn't the right tool. Ask once: *"If you already picked, the stress-test is your friend — it usually surfaces the *reason* the pick will fail. Want to run it anyway, or skip to /gmk-prototype?"* Respect the user's call.

### Every idea is pillar-adjacent

If Stage 5 classifies every surviving idea as pillar-adjacent, the **pillar might be the wrong shape**. Surface this:

> "Every idea here touches the pillar without strengthening it. That sometimes means the pillar is a feeling that ideas can't directly create — it's a *consequence* of other mechanics, not a mechanic itself. Worth re-running /gmk-init on this pillar to reshape it?"

Don't loop back automatically. Let the user decide.

### Brainstorm target is a free-text problem (no pillar/milestone)

Allowed. Bind the brainstorm to the **closest pillar** by asking: *"This problem sounds like it's for pillar X — sound right?"* If no pillar fits, that itself is a pillar-coverage gap.

### Re-running brainstorm on the same target

Append `-v2`, `-v3` suffix to filename. Don't overwrite — the old brainstorm is a learning trace. Show the user a one-line summary of the previous run: *"Previous brainstorm for greed-vs-safety on 2026-05-10 picked M2; result: m4-rush-vs-think FAIL. Re-brainstorming."*

## What this skill does NOT do

- **Doesn't write prototypes** — converges on hypothesis seeds; `/gmk-prototype` builds.
- **Doesn't update milestones.json** — output is in `_workspace/brainstorms/`, separate from canonical milestones.
- **Doesn't autogenerate a "best idea"** — convergence is user-driven; the model proposes, the user picks.
- **Doesn't claim ideas are good or bad** — calls them pillar-on / adjacent / orthogonal. Quality is a user judgment.
- **Doesn't skip stages** — the 5 stages exist because skipping divergence produces same-as-last-week mechanics.

## Notes for the model running this skill

- **Co-author, don't ghost-write.** Generating 12 ideas alone is faster but produces in-training-data mechanics. Ask the user for their ideas first, then add yours.
- **Diverge means diverge.** If your 12 ideas are all variations of one mechanic, stop and ask: *"I'm circling — what's a mechanic that would be **wrong** for this pillar? Sometimes naming the wrong answer surfaces the right one."*
- **MDA layers are not equal weights.** A grid game's Mechanics layer is huge; an emotional game's Aesthetics layer is huge. Don't force "4 ideas per layer" — let the pillar shape the distribution.
- **Pillar audit is the load-bearing stage.** If everything else is rushed, do Stage 5 carefully. Skipping it is how milestones that *look* on-pillar end up failing for being adjacent.
- **Don't lecture about MDA.** The user doesn't need a games-school explanation of Hunicke/LeBlanc/Zubek 2004. The lens is for **your** structure — phrase the questions in plain language ("what rule does this create / what behavior emerges / what feeling lands").
- **Killed-milestone re-brainstorm is the highest-value use.** When a milestone fails, the temptation is to tweak the prototype. Often the right move is to re-brainstorm the pillar from scratch with the failure as a constraint ("we tried X, it became optimization — what's a version that doesn't?").
