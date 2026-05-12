---
name: gmk-prototype
description: Generate a single-file HTML prototype for one game milestone — declare which Pillars it targets, write a falsifiable Fun Hypothesis (If/Then/Measured-by), and inject the standard __gmk_botHook__ API so /gmk-validate can run headless bots against it. Use when the user says "/gmk-prototype <name>", "make a prototype", "milestone prototype", "마일스톤 프로토타입", or wants to test one mechanic in isolation before committing to the real engine. Run AFTER /gmk-init has locked Pillars; refuses to run without pillars.json.
model: sonnet
---

# gmk-prototype — One mechanic, one HTML file, one hypothesis

The point of this skill is **structural cheapness**. A milestone you can throw away in 30 seconds is a milestone you'll honestly evaluate. The moment a prototype lives in the real Godot/Unity project, sunk cost takes over and the team ships dead weight.

So: **one HTML file, 300-line soft cap, single Pillar focus, single falsifiable hypothesis, bot hook required.**

## Why each constraint exists

- **Single file** — Forces the mechanic to fit in one mental model. The #1 game-jam failure pattern is the 1,400-line single-file blowup; we cap at 300 instead and split *between* milestones, not within them.
- **Pillar binding** — Every milestone must point back at a pillar from `pillars.json`. A milestone that strengthens no pillar is a feature, not a milestone. Cut it.
- **Falsifiable hypothesis** — `If X then Y measured by Z`. Without measurement we can't tell pass from fail, and the kit collapses into vibes. The Y must include at least one bot-measurable metric AND at least one human-measurable signal — bots can't judge fun, humans can't sit through 200 runs.
- **Bot hook** — Headless self-play in `/gmk-validate` is the kit's structural advantage over "vibe-test the prototype." If the prototype doesn't expose `window.__gmk_botHook__`, the next step in the workflow (validate) cannot run, and the milestone is stuck.

## Preconditions

Before writing anything, verify:

1. **`pillars.json` exists** at `{project}/.gamemaker-kit/pillars.json`.
   - If missing: stop. Tell the user *"No Pillars yet. Run /gmk-init first — Pillars are the lens this prototype gets judged against."*
   - If `pillars: []` and `skipped: true`: warn the user *"Pillars were skipped at init. This prototype won't have a north star to bind its hypothesis to. Want to run /gmk-init properly first?"* — only continue if they explicitly say yes.
2. **`prototypes/` directory exists**. Create it if not.
3. **`milestones.json` exists**. Create as `{ "project_name": "...", "milestones": [] }` if missing.

## Flow

### Step 1 — Get the milestone name

Skill input is `<name>` — a short slug like `m1-merge-feel`, `m2-dragon-evo`, `crossing-tension`. Convention: `m{N}-{kebab-slug}`. If the user gave a sentence ("test the merge satisfaction"), translate to a slug and confirm.

Reject if a prototype with that name already exists at `prototypes/<name>.html`. Offer:
- overwrite (only if user explicitly confirms — old version is destroyed)
- new name (`m1-merge-feel-v2`)
- different milestone

### Step 2 — Bind to Pillars

Read `pillars.json`. Show the available pillars in plain language:

```
Available Pillars (from pillars.json):
  1. tactile-satisfaction — Every interaction has a chunky physical payoff.
  2. discovery-joy — The player wants to find out what's behind the next merge.
  3. greed-vs-safety — Every move trades score-push against survival.
```

Ask: *"Which pillar(s) is this prototype testing? Pick 1-2 — more than that and the milestone is unfocused."*

Capture as `pillars_targeted: ["tactile-satisfaction"]` (array of pillar IDs).

If the user picks 3+: push back once. *"Three pillars in one prototype usually means the hypothesis isn't sharp enough. Can we narrow this to the one or two that the milestone is really about?"* If they insist, accept.

### Step 3 — Write the Fun Hypothesis

Hypothesis is the **falsifiable** load-bearing part. Walk the user through three slots:

**If** — what mechanic/change is this prototype implementing?
> Example: *"two dragons merging triggers 0.3s hit-stop + screen shake + 8-particle burst"*

**Then** — what does the player do, decide, or feel that strengthens the targeted pillar?
> Example: *"the player loses track of time within 5 minutes — they keep merging just to feel it again"*

**Measured by** — at least one bot metric AND at least one human signal:
> Example bot metric: *"average bot session length > 4 minutes (bot acts on legalActions until isOver)"*
> Example human signal: *"3 of 5 testers spontaneously say the word 'satisfying' or equivalent"*

The pillar shape should match the measurement type (from `gmk-init`):
- **Behavioral pillar** → behavioral metric (restart time, session length, action frequency)
- **Decision-shape pillar** → decision metric (action diversity, dominant strategy ratio)
- **Sensory pillar** → tester language ("juicy", "chunky", "satisfying") + behavioral proxy
- **Emotional pillar** → tester self-report + behavioral proxy

If the user proposes a Then like *"the game is fun"* — push back. *"'Fun' is what we're trying to prove, not what we measure. What does a fun-having player **do** differently? Restart faster? Play longer? Stop checking their phone?"*

### Step 4 — Pick the prototype shape

A prototype must fit one of these shapes (keeps the 300-line cap real):

| Shape | When to use | Bot hook complexity |
|-------|-------------|---------------------|
| **Grid / discrete actions** (merge games, puzzles, turn-based) | Discrete action space, deterministic state | Easiest — `legalActions()` returns a small array |
| **Continuous time / reflexes** (Crossy Road, dodgers, jumpers) | Real-time input, continuous state | Bot uses `tick(action)` at a fixed rate |
| **Dialogue / narrative branch** (visual novel, choice game) | Discrete choices over time | `legalActions()` returns dialogue options |
| **Card / draft** (deckbuilders, drafting) | Hand state + discrete plays | `legalActions()` returns playable cards |

Ask: *"Which shape fits this milestone?"* If the user is unsure, infer from the hypothesis (e.g. "session length > 4min" → continuous time; "tester says addictive on merge" → grid).

This drives the template selected in Step 5.

### Step 5 — Generate the HTML file

Write a single `prototypes/<name>.html` containing:

1. **Header comment block** with Pillar IDs, Hypothesis (If/Then/Measured-by), creation timestamp, milestone ID. Format:
   ```html
   <!--
   gamemaker-kit milestone: m1-merge-feel
   Pillars targeted: tactile-satisfaction, discovery-joy
   Hypothesis:
     IF   two dragons merging triggers 0.3s hit-stop + screen shake + 8-particle burst
     THEN the player loses track of time within 5 minutes
     MEASURED BY:
       bot:   avg session length > 4min over 200 runs
       human: 3 of 5 testers spontaneously say "satisfying"
   Created: 2026-05-09T12:00:00Z
   -->
   ```
   This block is **load-bearing** — `/gmk-validate` parses it to know what to measure, and `/gmk-feedback` parses it to compare tester language against the hypothesis.

2. **Single `<style>` block** — minimal CSS. No external CSS. Resist temptation to art-direct here; this is a mechanic test.

3. **Single `<canvas>` or `<div id="game">`** — no framework imports. No React, no Vue, no Phaser. Vanilla JS. The whole point is throwaway-cheap.

4. **Game logic** — enough to make the mechanic in the hypothesis testable. **Not** the full game. If the hypothesis is about merge feel, you don't need a high-score table.

5. **`window.__gmk_botHook__` — required**. See API below. Without this, `/gmk-validate` refuses to run and the milestone is dead.

6. **Soft 300-line cap, hard 600-line cap**.
   - At 300 lines, output a comment `<!-- WARNING: 300-line soft cap reached -->` and tell the user *"Approaching the soft cap. The prototype is doing more than one thing — consider splitting into a second milestone."*
   - At 600 lines, refuse to add more. Tell the user *"Hard cap. This isn't a prototype anymore — it's a game. Split into milestones m{N}a / m{N}b or rethink the scope."*

### Step 6 — Append to `milestones.json`

Add this milestone entry (validation fields stay null until `/gmk-validate` runs):

```json
{
  "id": "m1-merge-feel",
  "name": "Merge feel",
  "pillars_targeted": ["tactile-satisfaction"],
  "hypothesis": {
    "if": "two dragons merging triggers 0.3s hit-stop + screen shake + 8-particle burst",
    "then": "the player loses track of time within 5 minutes",
    "measured_by": [
      { "metric": "session_length_avg", "target": "> 4min", "kind": "bot" },
      { "metric": "tester_says_satisfying", "target": "3 of 5", "kind": "human" }
    ]
  },
  "prototype": "prototypes/m1-merge-feel.html",
  "shape": "grid",
  "created_at": "2026-05-09T12:00:00Z",
  "validation": null,
  "ported_to": null
}
```

### Step 7 — Open the file (optional)

If the user is on a graphical OS, offer to open `prototypes/<name>.html` in the default browser so they can manually poke at it before running `/gmk-validate`. Don't auto-open without asking.

## The `__gmk_botHook__` API — REQUIRED

Every prototype must expose this object on `window`. `/gmk-validate` calls these functions via Playwright's `page.evaluate()`. The shape is the same across all prototype shapes (grid, continuous, dialogue, card) — the contents differ.

```javascript
window.__gmk_botHook__ = {
  // --- lifecycle ---

  startGame(seed = 0) {
    // Reset state, seed RNG (use seed deterministically — same seed must produce same game).
    // Do NOT auto-start animations or autoplay; bot drives the clock.
  },

  isOver() {
    // Returns true when the run is finished (win, loss, timeout, whatever the prototype defines).
  },

  // --- action interface ---

  legalActions() {
    // Returns an array of action descriptors the bot may take RIGHT NOW.
    // For grid games: [{type:'merge', from:[0,0], to:[1,0]}, {type:'place', cell:[2,3]}]
    // For continuous: [{type:'left'}, {type:'right'}, {type:'noop'}]  // bot ticks at fixed rate
    // For dialogue:   [{type:'choose', id:'option-a'}, ...]
    // Empty array => bot has no legal move; isOver() should be true or game is stuck.
  },

  act(action) {
    // Apply the action. For continuous games, also advance the simulation by one tick.
    // Returns void; bot reads new state via legalActions() / isOver() / summary().
  },

  // --- measurement ---

  summary() {
    // Returns the metrics the hypothesis declares. At minimum:
    // {
    //   score: 0,                 // game's primary scalar (or null if not score-based)
    //   duration_ms: 0,           // how long the run took (sim time)
    //   actions_taken: 0,         // total acts() called
    //   crashed: false,           // did anything throw?
    //   build_used: null,         // for deckbuilders: final deck composition; else null
    //   custom: {}                // hypothesis-specific metrics (e.g. session_length_avg components)
    // }
  },
};
```

### Hook rules the prototype MUST follow

- **Deterministic seeding**: same seed → same sequence of states given same actions. Use a seedable RNG, not `Math.random()`. (Implement a tiny LCG inline; don't import a library.)
- **Headless-safe**: no `requestAnimationFrame` driving game state. The bot drives time via `act()`. Visuals can use rAF for the human player, but state must advance only on `act()`.
- **No timers as game logic**: `setTimeout` / `setInterval` for *feel* (hit-stop visuals) is fine; for *state* (enemy spawn timer) is not — convert to action-driven counters.
- **Crash containment**: wrap `act()` body in try/catch; on throw, set an internal `crashed=true` flag and have `summary().crashed` return true. Don't let bot loops die on a single crash.
- **Bounded runs**: every prototype must define a max-actions or max-duration ceiling so a bot can't loop forever. Default: 5000 actions or 600 seconds of sim time, whichever first. Set `isOver()` true when reached.

## What NOT to put in a prototype

- **External CDN imports** — offline-fragile, slow to load 200 times for bot runs. Inline everything.
- **Asset files** — no external images, sounds. Use canvas drawing or CSS shapes. The prototype tests *mechanic*, not art.
  - Exception: if the hypothesis is *about* art/sound feel, use a tiny inline data: URI or generated WebAudio. Document why.
- **Save state / localStorage** — bots run hundreds of fresh sessions. Persistence pollutes results.
- **Analytics, tracking, telemetry** — distractions. Metrics live in `summary()`.
- **High-score tables, menus, tutorials** — not the milestone's job. Land directly in the playable state.
- **Multiple mechanics in one file** — that's two milestones. Refuse. Suggest `m1a-` and `m1b-`.

## Output: tell the user what happens next

After writing the file and updating `milestones.json`:

```
Prototype written: prototypes/m1-merge-feel.html ({lines} lines)
Milestone registered in .gamemaker-kit/milestones.json
Pillars: tactile-satisfaction
Hypothesis:
  IF   two dragons merging triggers 0.3s hit-stop + screen shake + 8-particle burst
  THEN the player loses track of time within 5 minutes
  MEASURED BY:
    bot:   session_length_avg > 4min  (200 runs)
    human: 3 of 5 testers say "satisfying"

Next:
  1. Open prototypes/m1-merge-feel.html in a browser, click around for 60 seconds.
     If it doesn't immediately make you want to keep playing, kill it now —
     don't waste bot runs on a dead prototype.
  2. /gmk-validate m1-merge-feel  — runs 200 headless bot games, reports clear rate / dominant strategy / crashes.
  3. /gmk-share m1-merge-feel     — only after bot validation passes; deploys to itch.io / GitHub Pages.
```

## Notes for the model running this skill

- **Don't generate art-directed prototypes.** Resist the urge to make it look like a real game — you'll burn lines on CSS and the user will fall in love with the wrapper instead of testing the mechanic. Wireframe-grade visuals only.
- **Don't add features beyond the hypothesis.** If the hypothesis is about merge feel, the bot doesn't need a pause menu, a settings screen, or a death animation. Every line spent on those is a line not spent on the actual mechanic.
- **The bot hook is non-negotiable.** If you find yourself thinking "I'll add the hook later," stop and add it now — most of the rules above (deterministic seeding, action-driven time, bounded runs) are easier to write *in* than to retrofit.
- **300 lines is the goal, not the budget.** A 180-line prototype is better than a 280-line one. Tight prototypes get tested honestly.
- **If the user asks for "just a quick HTML game"** without a hypothesis: explain once that a prototype without a hypothesis is just a toy, and the kit can't tell you whether it worked. Offer to write a hypothesis with them, or fall back to plain HTML generation outside the kit.
- **Deterministic seeding is for the bot, not the human.** The human player can press a "new game" button that uses `Date.now()` as seed. The bot calls `startGame(N)` with explicit seeds 0..199 for reproducibility.
- **Pillar mismatch is a smell.** If the hypothesis you wrote with the user doesn't actually strengthen the pillars they picked, name it: *"This hypothesis is about session length, but the pillar is 'greed vs. safety' — those don't connect. Either change the pillar binding, or sharpen the hypothesis."* Don't paper over it.
