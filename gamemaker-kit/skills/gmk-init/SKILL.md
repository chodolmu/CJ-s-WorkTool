---
name: gmk-init
description: Initialize a new game project with gamemaker-kit (v1.0 reference-clone-first) — capture a reference seed, run autonomous Layer-1 reference research (WebSearch/WebFetch → genre conventions + anti-tropes), propose research-grounded Design Pillar candidates for the user to ratify, run a supported-genres check (2D / deterministic input / ≤5 min sessions), choose target engine (Godot/Unity), and write pillars.json + milestones.json + research-notes.md + _workspace/vision.md. Use whenever the user says "/gmk-init", "gamemaker-kit init", "start a new game project", "레퍼런스 비슷한 게임", "design pillar 정의", "게임 프로젝트 시작", or wants to define what their game is fundamentally about before coding. Run this FIRST for any new game — research-grounded pillars are the lens through which every later milestone is judged.
model: opus
---

# gmk-init — Lock the Design Pillars

The **first thing** you do in a new game project. Pillars are the 3-5 emotional/experiential commitments the game makes to its players. Every later milestone in gamemaker-kit is judged against them.

## Why pillars matter (read this once, internalize)

Code-focused PMs (TaskForge, Linear, Jira) plan around features. Games are different — features are tools, not the goal. The goal is *what the player walks away with*. Pillars name that.

A pillar can take any of these shapes — pick whichever the user finds least squishy:

- **Emotional**: "Wonder, Fear, Hope" (Subnautica)
- **Behavioral**: "One-more-run reflex" — player presses restart in under 2 seconds after dying
- **Decision-shape**: "Always a tradeoff between greed and safety" — every action costs something the player wanted
- **Sensory**: "Tactile chunkiness" — every interaction has weight, sound, follow-through

If the user pushes back on "feelings" as too subjective, **don't insist**. Drop to behavioral or decision-shape pillars instead. Those are easier to test (a bot can measure restart-time-after-death; a tester can audibly confirm tradeoff awareness) and equally good as a north star.

In gamemaker-kit:
- Every prototype must declare which pillars it targets.
- Every "fun hypothesis" (`If X then Y measured by Z`) is bound to a pillar — the form of Y depends on the pillar shape.
- A milestone that doesn't strengthen any pillar gets cut.

This is the lens. Without it, the kit is just a fancy code generator.

## Flow

> **v1.0 reference-clone-first**: pillars are no longer pulled from a blank-page conversation. The kit first researches the user's *reference* (a proven game), extracts genre conventions, and **proposes pillar candidates grounded in that research** — the user ratifies. This is concept principle **P9 (Research-Proposed, User-Ratified Pillars)**. The kit proposes; it never judges "fun." The reference-research steps (0 / 0.5) run *before* the pillar dialogue so the proposal is grounded.

### Step 0 — Capture the reference seed

Before any pillar talk, capture what the user is cloning-and-differentiating from. Ask (one at a time, conversational):

1. *"이 게임은 어떤 기존 게임이 떠오르게 해? (레퍼런스 1개 이상)"* — reference_titles
2. *"장르를 한 단어로 하면? (merge3 / match-3 / roguelike deckbuilder …)"* — genre
3. *"어디서 돌아갈 거야 — PC, 모바일, 브라우저?"* — platform
4. *"한 단어 분위기는? (cozy / tense / chaotic …)"* — vibe

Write `_workspace/<project>/.gamemaker-kit/seed.json` (atomic — write `.tmp` then rename):

```json
{
  "genre": "merge3",
  "target_family": "match3-with-meta",
  "reference_titles": ["Royal Match"],
  "platform": "PC Steam",
  "vibe": "cozy",
  "user_seed_raw": "<verbatim user phrasing>"
}
```

`target_family` disambiguates adjacent genres that share a keyword but are *different families* (e.g. match-3-with-meta vs pure-merge). If the genre has no such ambiguity, set it equal to `genre`. **If the user names a genre with a known family split and you can't tell which they mean, ask** — family mismatch is a research *precondition*, not something to fix in synthesis later.

**If the user has no reference** (pure original idea): skip to Step 1 (blank-page pillar dialogue, the pre-v1.0 path). Reference-clone-first is the *default*, not a requirement — gmk does not gatekeep.

### Step 0.5 — Autonomous reference research (Layer 1)

Research the reference(s) so the pillar proposal is grounded in proven genre conventions, not guesses. This is a 5-stage / 3-cycle procedure with a hard cost cap. The canonical step-by-step (queries, source-eligibility rules, cost counter, quit signals) lives in the kit's S1 detail plan — follow it exactly:

- **Pre-flight** — before *any* web call, write the research-notes head: approved genre/site query alternations, `target_family`, dev-grade source-eligibility rule, cost counter (init 0; hard cap **100 calls OR 30 active-research minutes**). No WebSearch/WebFetch until this paperwork exists.
- **Stage 1 — Genre baseline survey**: multi-term query (single keywords return near-zero) → collect non-listicle candidate URLs.
- **Stage 2 — Reference shortlist**: exactly **3** dev-grade references (`source_type ∈ {dev-blog, postmortem, academic, gdc, interview}`; listicle/marketing/store-listing excluded). Prefer within-`target_family`.
- **Stage 3 — Convention extraction (3-cycle per ref)**: 4 categories (mechanics / progression / session-length / failure-mode). Cycle 1 baseline → Cycle 2 gap-fill (only missing categories) → Cycle 3 cross-verify *high-signal* claims against sources **outside** the original domain. Qualitative claims need primary-source confirmation, not snippet capture.
- **Stage 4 — F2P contamination filter** (strict + named-exception).
- **Stage 5 — Synthesis**: dedup conventions → confirmed list ranked by cross-ref strength, anti-tropes (≥2 refs), and the reference's *delta* vs its family.

Output: `_workspace/<project>/.gamemaker-kit/research-notes.md` (atomic). Every stage increments the cost counter and writes it back. **STOP** at 100 calls or 30 active minutes — surface partial results, don't blow the cap.

**Watch for the dogfood-validity trap (concept P3)**: if the user is an *expert* in this genre, good research and bad research both "look right" to them — they fill gaps from memory. Step 2.0 (below) mitigates this by forcing research findings onto the table as explicit candidates, but be honest in the notes: a familiar-genre run tests the *workflow*, not research *validity*. Research validity is proven on an unfamiliar genre.

### Step 1 — Listen for the pillar seed

The user says something like "I want to make a merge dragon game" or "a Crossy Road clone." Don't jump to mechanics. Open with a question that fits the user — pick **one** of these (don't ask all):

- **Emotional opener** (works for users who like talking about feel): *"Before we figure out what's in the game — what does a player walk away with after their first session? Could be a feeling, could be a behavior, could be a thought."*
- **Behavioral opener** (works for users who think "feelings" sound squishy): *"What's the moment you want this game to be famous for? The thing that, if a stranger watches a stream of it, they immediately get it. Could be a specific action, a tense decision, a visual."*
- **Reference opener** (works for users with strong taste): *"What existing game does this remind you of, and what's the one thing about that game you'd want to keep, and the one thing you'd want to change?"*

Listen for any kind of seed — emotion words, behaviors, decision moments, reference touchstones. All four pillar shapes (emotional / behavioral / decision-shape / sensory) are equally valid; the user gets to pick.

**If the user pushes back on the framing itself** — "feelings are too subjective", "I just want to build features" — that's useful information, not resistance. Switch to behavioral or decision-shape framing immediately. Don't argue. The pillar still serves the same role; only the grammar changes.

If they answer with pure mechanics ("you merge dragons"), don't redirect to feelings — instead, ask: *"And when the merge lands well, what makes it land well? What separates a satisfying merge from a flat one?"* That question pulls a pillar shape out of the mechanic without forcing the user into emotion-talk.

### Step 2.0 — Propose research-grounded pillar candidates (P9)

**This is the bridge from Layer 1 research to pillars — the one place research output flows into the game's identity.** If you ran Step 0.5, do this *before* the open pillar conversation in Step 2.

From `research-notes.md` §Synthesis (confirmed conventions + the reference's family-delta), derive **2-4 pillar candidates**. Present them to the user, each as:

```
PC{n} — "{short name}"
  근거: {which confirmed convention(s) it comes from — cite the C-id / source_url}
  한 줄: {what the player does/decides/experiences}
  Anti-example: {what would violate it}
```

Then ask the user to respond to **each** candidate explicitly: **채택 / 수정 / 거부 / "차별화 대상"** (adopt / revise / reject / "this is what I'll differentiate on").

Hard rules:
- **The kit proposes; the user ratifies. Never judge "fun" yourself** (concept §1). A candidate is just a research-grounded hypothesis until the user adopts it.
- **Every candidate must trace to a convention** (cite the source). If you can't cite where a candidate came from, you invented it — drop it. (Untraceable candidates = P9 violation = the kit hallucinating a pillar.)
- Surface *forks* the research reveals (e.g. "this reference has no decoration meta, but its family does — do you want pure-progression or story+decoration?"). Forcing the fork onto the table is how research findings reach a genre-expert user who'd otherwise fill the gap silently (P3 mitigation).
- The user's per-candidate responses become the **seed for the Step 2 conversation** below — adopted candidates are draft pillars to refine; rejected ones are differentiation notes.

Record the candidates + the user's ratification in `research-notes.md` §Synthesis (a small table: candidate / source conv / user response / final).

**If there was no reference (Step 0 skipped)**: skip Step 2.0 entirely and run Step 2 as the blank-page conversation.

### Step 2 — Propose pillars, refine through conversation

Once you have one or two anchors from Step 1 (and the ratified candidates from Step 2.0, if any), propose 3-5 pillars. The rule (Charlie Cleveland): each pillar names **what the player does, decides, or experiences**, never **what the system contains**.

**Bad pillars (system-named — these are features, not pillars):**
- "Procedural dungeons" (← system)
- "Card-based combat" (← system)
- "Crafting tree" (← system)

**Good pillars** can take any of these shapes:

| Shape | Example | Why it works |
|-------|---------|--------------|
| Emotional | "Earned loneliness" (Subnautica) | Names the felt experience |
| Behavioral | "Three-second restart" | Names an observable, measurable action |
| Decision-shape | "Greed vs. safety on every move" (Crossy Road, Dicey Dungeons) | Names the recurring choice the player faces |
| Sensory | "Chunky everything — weight, sound, follow-through" (Vlambeer games) | Names the moment-to-moment texture |

Propose them one at a time, in plain language. Match the shape to whatever the user gave you in Step 1 — don't force emotional pillars on a user who talks in behaviors:

> "Here's a first pillar I'm hearing — **Three-second restart**: when the player dies, they should be back in the game in under three seconds, mostly on reflex. Does that capture the loop you want?"

Or:

> "Here's one — **Greed vs. safety on every move**: every step the player takes should make them weigh 'do I push for the score or play it safe?' The pillar is broken if any move feels obviously correct. Does that fit?"

Iterate until the user says "yes" to 3-5 pillars. Stop at 5 — more than that and they stop being load-bearing.

### Step 3 — Anti-examples (the guardrail half)

For each accepted pillar, ask:

> "If we shipped this pillar wrong, what would the game feel like instead? Give me one example of what would *violate* this pillar."

The anti-example does the heavy lifting later. When a future prototype is being judged, "does this pillar hold?" is fuzzy — but "does this match the anti-example?" is crisp.

**Example:**
- Pillar: *Tactile satisfaction*
- Anti-example: "If merging two dragons feels like clicking a button on a spreadsheet — silent, instant, weightless — the pillar is broken."

### Step 4 — Supported-genres check (gmk scope)

Before locking the engine, run the scope check **once**. gmk's bot validation and porting checks are tuned for 2D + deterministic input + short sessions. Anything else still works, but bot signal degrades and the user should know.

Ask three questions, one at a time:

1. *"Is this a 2D game? (3D is supported but bot validation is less reliable — random/MCTS bots don't navigate 3D space well yet.)"*
2. *"Is the input deterministic? Meaning: same action from same state always produces the same next state. (Most turn-based, grid, card, deterministic-physics games are yes. Twitchy reflex games with frame-perfect inputs are usually no.)"*
3. *"Will a typical session be under 5 minutes? (Longer sessions are fine, but 200-run bot validation takes proportionally longer; if a single bot run takes 10 minutes, 200 runs is 33 hours of compute.)"*

Record each as a boolean in `supported_genres_check`. **Do not refuse** on a `false` — the kit still works. Just tell the user:

> "Heads-up: {N} of 3 scope checks are off. The kit will still work, but bot validation has reduced confidence in these conditions. The `vision.md` will note this so future-you remembers the trade-off."

If all three are `false`, push back once: *"Three of three are off — this is closer to Phase 3 territory. Want to continue anyway, or rethink the genre?"* If they continue, accept; the kit doesn't gatekeep.

### Step 5 — Pick the target engine

Now ask:

> "What engine will the final game live in — Godot or Unity? (Either way, gamemaker-kit prototypes in HTML first; this is just where the validated mechanics get ported to.)"

If the user is unsure, recommend Godot:
- The kit's MVP port skill targets Godot first (Unity is Phase 2).
- The user's existing projects (ZooMerge, ProjectFS, Puzzle) are all Godot.
- Godot's free-of-license + scripted scenes match the "iterate fast" spirit of the kit.

If the user names a different engine (Love2D, GameMaker Studio, Unreal): accept it but flag that automatic porting is not yet supported — the `/gmk-port` skill will produce a manual checklist instead of generated code.

### Step 6 — Confirm and write files

Show a plain summary before writing anything:

```
Game: {project_name}
Engine: {godot|unity|other}

Scope (gmk-friendly conditions):
  2D: ☑ / ☐
  Deterministic input: ☑ / ☐
  Session ≤ 5 min: ☑ / ☐

Pillars:
  1. {name} — {description}
     ✗ Violated when: {anti_example}
  2. {name} — {description}
     ✗ Violated when: {anti_example}
  ...

Ready to lock these in?
```

If the user confirms, write the files (next section). If not, loop back to Step 2 or 3.

## What to write

The project's working directory is the user's current game folder (e.g. `C:/GameMaking/Godot/ZooMerge/`). All gamemaker-kit state lives in three places under it:

```
{project}/
├─ prototypes/                    # empty for now; /gmk-prototype fills it
├─ .gamemaker-kit/
│  ├─ seed.json                   # this skill writes (Step 0 — reference seed; omit if no reference)
│  ├─ research-notes.md           # this skill writes (Step 0.5 — Layer 1 research; omit if no reference)
│  ├─ pillars.json                # this skill writes
│  └─ milestones.json             # this skill writes (empty)
└─ _workspace/
   └─ vision.md                   # this skill writes (human-readable mirror of pillars.json)
```

If the user's current directory is ambiguous, ask: "Which folder is your game project? (I'll create `prototypes/`, `.gamemaker-kit/`, and `_workspace/` inside it.)"

Full layout spec — see `_workspace/structure.md` in the kit itself. With a reference seed, `gmk-init` writes five files (seed + research-notes + pillars + milestones + vision); with no reference, the original three (pillars + milestones + vision). Later skills fill in the rest.

**research-notes.md is read downstream**: S1.5 (`gmk-genre-decide`) converts its confirmed conventions + the ratified pillars into machine-parseable `genre-decisions.json` (concept P1). Keep it well-structured — it is not a scratch file.

### pillars.json schema

```json
{
  "kit_version": "0.9.0",
  "project_name": "ZooMerge",
  "engine": "godot",
  "created_at": "2026-05-08T15:30:00Z",
  "pillars": [
    {
      "id": "tactile-satisfaction",
      "name": "Tactile satisfaction",
      "description": "Every interaction has a chunky physical payoff. The game should feel good in the hands even before the player understands the rules.",
      "kind": "sensory",
      "anti_examples": [
        "Merging two dragons feels like clicking a button on a spreadsheet — silent, instant, weightless."
      ]
    }
  ],
  "supported_genres_check": {
    "two_d": true,
    "deterministic_input": true,
    "session_under_5min": true
  }
}
```

`id` is `name` lowercased, spaces to hyphens, special characters stripped.

`kind` is the **pillar shape** the user picked in Step 1/2 (one of `sensory` / `behavioral` / `decision-shape` / `emotional`). Write it on every pillar — downstream skills (`gmk-prototype`, `gmk-self-test`) read it per `gmk-prototype-rules` Rule 17 to pick metric class and agent routing. Use the lowercase exact form (the hyphen in `decision-shape` is significant) — if a downstream skill encounters `"Sensory"` or `"DECISION-SHAPE"`, Rule 17 warns and lowercase-normalizes for that run, so the kit still works but the warning surfaces every invocation. Fix the source on first sighting. If you genuinely can't classify a pillar — e.g. the user wrote a hybrid like "satisfying decisions" — pick the *dominant* shape (here: `decision-shape`, because the metric will be decision-diversity not feel parameters) and note the ambiguity in the pillar description. The kit's free-text fallback (Rule 17 absent case) only fires for pre-v0.8 hand-edited files.

`supported_genres_check` is **always written**, even if every value is `false`. Later skills read it to decide whether to add caveats ("bot signal is reduced for this milestone because input is non-deterministic").

### milestones.json (initial)

```json
{
  "kit_version": "0.9.0",
  "project_name": "ZooMerge",
  "milestones": []
}
```

Milestones get appended by `/gmk-prototype` later. Don't create any here.

`kit_version` is the schema version this file conforms to (v0.9 writes `"0.9.0"`). When `/gmk-init` is re-invoked on an older project (no `kit_version` or `< current`), upgrade the value silently — the file shape is backward-compatible (additive-only across sub-releases). The read-side contract for this field is `gmk-prototype-rules` Rule 16: warn-only on files written by a newer kit version, never refuse.

### vision.md (initial)

Write a human-readable mirror of `pillars.json` to `_workspace/vision.md`. **Format:**

```markdown
# Vision — {project_name}

> Locked: {created_at}

## What this game is about

{One short paragraph the user wrote during the conversation. If the user didn't naturally produce one, ask now: "In one sentence — what's this game?" Don't auto-generate it. The user's own words are load-bearing here.}

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

{If any box is ☐, append: "The kit will still work, but bot validation has reduced confidence in these conditions."}

## Engine target

{godot | unity | other}

## What's *out* of scope (kit reminder)

- External release: Steam page, marketing, wishlist watching
- Live-ops: patch notes, review pulse
- External-human feedback collection (Discord/Steam RSS)

gmk's end-point is *development completion*, not ship.
```

This file is the user's daily north-star reference. They open VSCode, see it in the sidebar, remember what the game is *about*. If pillars change later (rare), `gmk-init --rewrite-vision` regenerates this from `pillars.json`.

## After writing

Tell the user the next step in plain language:

```
Pillars locked. Three files saved:
  {project}/.gamemaker-kit/pillars.json
  {project}/.gamemaker-kit/milestones.json
  {project}/_workspace/vision.md       ← read this in VSCode daily
  {project}/prototypes/                (empty — ready for first prototype)

Scope check: {N} of 3 gmk-friendly conditions met.

Next:
```

**If a reference seed was used (research-notes.md exists)** — Layer 1.5 comes first, so the research becomes a machine-readable contract before any milestone planning:

```
Next:
  /gmk-genre-decide — convert your reference research into genre-decisions.json (the contract every later step reads), and ratify the playable-module candidates
```

**If there was no reference (blank-page pillars)** — the pillars are already the contract, so go straight to planning:

```
Next:
  /gmk-roadmap   — break the vision into 3-8 milestones with priorities and dependencies
  /gmk-prototype — skip roadmap and go straight to a single milestone prototype
```

## Notes for the model running this skill

- **Conversation, not interrogation.** Never ask all five questions at once. One at a time, listen, build on what they said.
- **Emotion words are gold.** When the user uses one, mirror it back: "So 'satisfying' is doing a lot of work in that sentence — what kind of satisfying? Resolution, accomplishment, rhythm?"
- **3 pillars is fine.** Don't pad to 5. Subnautica had 3.
- **Anti-examples can be uncomfortable.** They're meant to be — naming the failure mode in advance is what makes them useful.
- **If the user is non-developer-coded**, skip the "engine" framing. Ask "do you want this to end up on phones, computers, or browsers?" and translate yourself: phones/computers → Godot recommended.
- **If they want to skip pillars** ("just make me a game"), explain once: "Pillars are the lens every later step uses to ask 'is this still the same game?' Without them, the kit will drift — every prototype will look like a different game. Worth ten minutes." If they still refuse, write a `pillars.json` with `pillars: []` and a flag `skipped: true` so later skills can warn them.
- **Don't gatekeep on the genre check.** Three falses still gets written — gmk does not refuse work. The check is for *future-you remembering the trade-off*, not for blocking the user.
- **vision.md uses the user's own one-line summary.** If you autogenerate it, the user reads a generic paragraph and skips past it; the file becomes dead weight. Ask for one sentence in their words.
