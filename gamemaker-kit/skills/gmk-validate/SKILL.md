---
name: gmk-validate
description: Run 200 headless Playwright bot games against an HTML prototype to objectively gate whether a milestone passes. Reads the milestone's hypothesis from milestones.json, calls window.__gmk_botHook__ to drive deterministic self-play, computes clear rate / dominant strategy / crashes / hypothesis-specific metrics, writes the verdict back into milestones.json. Use when the user says "/gmk-validate <name>", "validate prototype", "run bot", "마일스톤 검증", or wants the objective half of milestone gating before sharing to humans. Run AFTER /gmk-prototype has produced the HTML and registered the milestone.
model: sonnet
---

# gmk-validate — Bot the prototype, gate the milestone

This is the **objective** half of the gate. The bot can't tell you if the game is fun — but it can tell you, before you waste any human attention, whether the prototype is broken, trivially solvable, or stuck on a single dominant strategy.

If a prototype fails this gate, you do not show it to humans. You fix it or kill it.

## What this skill does, end to end

1. Reads `prototypes/<name>.html` and `.gamemaker-kit/milestones.json`.
2. Boots Playwright Chromium headless, navigates to the file via `file://`.
3. Calls `window.__gmk_botHook__.startGame(seed)` with seeds 0..N-1 (default N=200).
4. Loops `act(choice)` until `isOver()` for each run, picking actions via the configured policy (random by default, MCTS optional).
5. Aggregates `summary()` results across runs into objective metrics.
6. Compares aggregates against the milestone's `hypothesis.measured_by` bot rows.
7. Writes a `validation` block back into `milestones.json` and prints a PASS / FAIL / INCONCLUSIVE verdict.

## Preconditions

Before running anything, verify and stop with a clear message if any fails:

1. **Milestone exists.** Read `.gamemaker-kit/milestones.json` and find an entry with `id === <name>`. If not found: list available milestone IDs and stop.
2. **Prototype file exists.** Path from milestone entry's `prototype` field. If missing: stop.
3. **Playwright is installed.** Run `npx playwright --version`. If it errors:
   - Tell the user *"Playwright isn't installed. Install with: `npm i -D playwright && npx playwright install chromium`. This is a one-time setup; the kit reuses Chromium across runs."*
   - Stop. Don't auto-install — Playwright pulls ~150MB and the user should know.
4. **Bot hook present.** Quick smoke test: launch the file, evaluate `typeof window.__gmk_botHook__`. If anything other than `"object"`:
   - Stop with *"Prototype doesn't expose `window.__gmk_botHook__`. Re-run /gmk-prototype or fix the prototype's hook block before validating."*
5. **Bot hook surface complete.** Evaluate that all five required functions exist: `startGame`, `isOver`, `legalActions`, `act`, `summary`. Missing any → stop, name the missing ones.

## Flow

### Step 1 — Resolve the run plan

Skill input: `<name>` plus optional flags. Defaults:

- `--runs 200` (number of bot games)
- `--policy random` (alternatives: `mcts`, `mixed`)
- `--max-actions 5000` (per-run safety ceiling, matches prototype default)
- `--max-duration-sec 600` (per-run wall-clock ceiling)
- `--seed-offset 0` (seeds will be `seed-offset .. seed-offset + runs - 1`)
- `--keep-traces` (off by default; on, save Playwright trace zip per crashed run)

Smaller `--runs` values are useful while iterating on the hypothesis (e.g. `--runs 20` to sanity-check). For real verdicts, 200 is the floor — fewer than that and dominant-strategy detection is unreliable.

If the milestone's `shape` is `continuous` (real-time reflexes), default `--policy random` with a tick-rate parameter (defaults to 60 ticks/sec sim time, NOT wall time — bots advance the clock through `act`). Don't use MCTS on continuous games unless the user explicitly opts in.

### Step 2 — Show the run plan, get confirmation

Before launching 200 browsers, show:

```
Validating: m1-merge-feel
  Prototype: prototypes/m1-merge-feel.html
  Hypothesis (bot rows):
    - session_length_avg  target: > 4min
  Runs: 200
  Policy: random
  Max actions/run: 5000
  Max duration/run: 600s sim
  Estimated wall time: ~2-5 min  (depends on prototype)

Proceed?
```

If the user has already confirmed in their invocation (e.g. they typed `/gmk-validate m1-merge-feel --yes`), skip the prompt.

### Step 3 — Spawn the runner

Generate a small Node script in-memory or as a temp file at `.gamemaker-kit/.validate-runner.cjs` and execute it. The runner is responsible for the Playwright loop. Skeleton:

```javascript
// .gamemaker-kit/.validate-runner.cjs
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ bypassCSP: true });
  const page = await ctx.newPage();

  const fileUrl = 'file://' + path.resolve(process.argv[2]).replace(/\\/g, '/');
  const runs = parseInt(process.argv[3], 10);
  const policy = process.argv[4]; // 'random' | 'mcts' | 'mixed'
  const seedOffset = parseInt(process.argv[5], 10);
  const maxActions = parseInt(process.argv[6], 10);

  const results = [];
  for (let i = 0; i < runs; i++) {
    const seed = seedOffset + i;
    await page.goto(fileUrl);

    // Hook smoke check (cheap; catches reload-time errors)
    const ok = await page.evaluate(() => typeof window.__gmk_botHook__ === 'object');
    if (!ok) { results.push({ seed, crashed: true, reason: 'hook-missing' }); continue; }

    try {
      await page.evaluate((s) => window.__gmk_botHook__.startGame(s), seed);

      let actions = 0;
      while (actions < maxActions) {
        const over = await page.evaluate(() => window.__gmk_botHook__.isOver());
        if (over) break;
        const legal = await page.evaluate(() => window.__gmk_botHook__.legalActions());
        if (!legal || legal.length === 0) break;

        const choice = pickAction(legal, policy, seed + actions);
        await page.evaluate((a) => window.__gmk_botHook__.act(a), choice);
        actions++;
      }

      const summary = await page.evaluate(() => window.__gmk_botHook__.summary());
      results.push({ seed, ...summary, actions_taken: actions });
    } catch (err) {
      results.push({ seed, crashed: true, reason: String(err).slice(0, 200) });
    }
  }

  await browser.close();
  process.stdout.write(JSON.stringify(results));
})().catch((e) => { console.error(e); process.exit(1); });

function pickAction(legal, policy, seed) {
  // 'random': deterministic LCG seeded with `seed`
  // 'mcts': depth-3 lookahead — only available if action space is small AND game is deterministic
  // 'mixed': 80% random + 20% mcts (hedges)
  // Default to random for any prototype that the policy can't handle.
  const r = lcg(seed) / 0xffffffff;
  return legal[Math.floor(r * legal.length)];
}
function lcg(s) { return ((s * 1664525 + 1013904223) >>> 0); }
```

Important: **do not** import the runner from a long-lived location — it lives at `.gamemaker-kit/.validate-runner.cjs` (gitignore-able) and gets overwritten each run.

### Step 4 — Aggregate results

Once the runner finishes, parse stdout JSON. Compute the always-on objective metrics:

| Metric | Definition | Why it matters |
|---|---|---|
| `clear_rate` | runs where `summary.score >= clear_threshold` ÷ total runs (if game has a clear concept; else null) | < 5% = too hard for a random bot to ever reach the interesting state. > 95% = game plays itself. |
| `crash_rate` | crashed runs ÷ total runs | > 1% = prototype is unstable; fix before any other gate matters. |
| `dominant_strategy_ratio` | most-common action sequence prefix (length 5) frequency ÷ total runs | > 0.6 = the game has one obvious play; the mechanic isn't a real choice. Computed only for grid/discrete shapes; null for continuous. |
| `session_length_avg_ms` | mean `summary.duration_ms` across non-crashed runs | Compared directly to hypothesis if the hypothesis names it. |
| `actions_taken_avg` | mean `summary.actions_taken` across non-crashed runs | Sanity check — < 5 actions/run usually means the game ends too fast for any pillar to land. |

Then evaluate **hypothesis-specific** rows. For each entry in `hypothesis.measured_by` where `kind === "bot"`:

- Match `metric` name to either an always-on metric above OR a key in `summary.custom`.
- Parse `target` ("> 4min", "< 0.6", "between 100 and 500", etc.).
- Compute pass/fail per row.

Aggregate verdict:

- **PASS** — every bot row passes AND `crash_rate < 0.01` AND (`dominant_strategy_ratio` is null OR < 0.6).
- **FAIL** — any bot row fails, OR `crash_rate >= 0.05`, OR dominant-strategy detection trips at >= 0.7.
- **INCONCLUSIVE** — anything in between (e.g. one row passes but a guardrail metric is borderline). Always print *why* inconclusive.

Crashes deserve special treatment: if `crash_rate >= 0.5`, don't bother evaluating any other metric. Print the crash reasons (deduplicated) and stop. The prototype is broken; the rest of the report is noise.

### Step 5 — Write back to `milestones.json`

Update the milestone entry:

```json
{
  "id": "m1-merge-feel",
  "validation": {
    "ran_at": "2026-05-09T13:42:00Z",
    "runs": 200,
    "policy": "random",
    "metrics": {
      "clear_rate": 0.67,
      "crash_rate": 0.0,
      "dominant_strategy_ratio": 0.31,
      "session_length_avg_ms": 287000,
      "actions_taken_avg": 142,
      "custom": { "session_length_avg": "4m47s" }
    },
    "hypothesis_rows": [
      { "metric": "session_length_avg", "target": "> 4min", "actual": "4m47s", "passed": true }
    ],
    "verdict": "PASS",
    "guardrails": { "crash_rate_ok": true, "dominant_strategy_ok": true }
  }
}
```

Don't overwrite `human_feedback` or `ported_to` if present; just merge.

If a previous validation entry exists, archive it under `validation_history: [...]` so re-runs keep a record. Only the most recent run lives at the top level.

### Step 6 — Print the verdict report

A short, plain-text report to the user. No JSON dumps. Example for PASS:

```
m1-merge-feel — VERDICT: PASS

  Hypothesis (bot rows):
    ✓ session_length_avg  target: > 4min     actual: 4m47s

  Always-on metrics:
    clear_rate                : 67%
    crash_rate                : 0.0%
    dominant_strategy_ratio   : 31%   (no single play dominates — good)
    actions_taken_avg         : 142

Next:
  /gmk-share m1-merge-feel    — deploy to itch.io / GitHub Pages, get human eyes on it
  /gmk-feedback m1-merge-feel — collect tester feedback once the link is live
```

Example for FAIL:

```
m1-merge-feel — VERDICT: FAIL

  Hypothesis (bot rows):
    ✗ session_length_avg  target: > 4min     actual: 1m12s

  Always-on metrics:
    clear_rate                : 4%    (too hard — random bot rarely reaches the interesting state)
    crash_rate                : 0.0%
    dominant_strategy_ratio   : 78%   (one play dominates — mechanic isn't a real choice)

  What the bot is telling you:
    - Sessions die fast because random play is punished too hard.
    - Even when the bot survives, it converges on one action sequence — the
      decision space is too narrow for the pillar 'greed-vs-safety' to land.

Next: don't share this. Either:
  - Tighten the prototype (loosen the failure punishment, widen the action space),
    rerun /gmk-validate, or
  - Kill the milestone — log the lesson, move on. /gmk-status will mark it FAILED.
```

Example for INCONCLUSIVE:

```
m1-merge-feel — VERDICT: INCONCLUSIVE

  Hypothesis (bot rows):
    ✓ session_length_avg  target: > 4min     actual: 4m12s

  Always-on metrics:
    clear_rate                : 67%
    crash_rate                : 2.5%   (above 1% — prototype is somewhat unstable)
    dominant_strategy_ratio   : 31%
    actions_taken_avg         : 138

  Why inconclusive:
    Hypothesis row passes, but crash_rate at 2.5% means roughly 1 in 40 sessions
    crashes. Human testers will hit one of those crashes and lose trust in the
    prototype before the mechanic lands. Fix the crashes (top reason: '<reason>')
    and rerun before sharing.
```

### Step 7 — Don't auto-advance

Whatever the verdict, **do not** automatically call `/gmk-share` or `/gmk-port`. Verdicts are advisory; the user owns the GO/NO-GO call. Just print "Next:" suggestions and stop.

## Edge cases & policy

### When `legalActions()` returns an empty array but `isOver()` is false

The prototype is stuck — game logic dead-ends without ending the run. Treat as a soft failure:

- Mark the run as `stuck: true` (not `crashed`).
- Bail that run, move on.
- If `stuck_rate >= 0.05`, downgrade the verdict to FAIL with reason "stuck-state". This is a prototype bug.

### When `summary()` throws or returns malformed data

Treat the run as crashed with `reason: 'summary-malformed'`. Don't try to recover partial data.

### Prototypes that need user input the bot can't provide

If the prototype requires a name, signing in, dismissing a modal, etc. before the bot can act, that's a prototype bug — `/gmk-prototype` is supposed to land you directly in the playable state. Tell the user: *"The bot can't get past the title screen. Edit the prototype to skip menus / land in the playable state on load — that's the prototype rule, not a validate rule."*

### MCTS policy — when worth it

Only use MCTS when:
- `legalActions().length` is consistently small (< 20).
- The game is deterministic (same actions from same seed produce same state).
- The user explicitly asked, OR a prior run with random policy failed with `clear_rate < 5%` and you suspect the random bot is just too dumb to find the win.

Depth: 3 by default. Higher depths multiply per-run time fast.

### Policy = `mixed`

80% random + 20% MCTS, picked per action. Useful when you want some signal that "smarter play also passes the hypothesis," not just random survival. Costs ~5x random's wall time.

### Long-running bots

If a single run hits `max-actions` without `isOver()`, log it as `timed_out: true` and include in stats. If `timed_out_rate >= 0.5`, the prototype's bound-runs constraint isn't tight enough — tell the user, don't gate on it.

### Re-running

Re-running on the same prototype just appends to `validation_history` and overwrites the top-level `validation`. There's no merge step the user has to manage.

## What this skill does NOT do

- **Doesn't measure fun.** That's `/gmk-feedback`'s job (humans only).
- **Doesn't deploy.** That's `/gmk-share`.
- **Doesn't modify the prototype.** Read-only on `prototypes/<name>.html`. If the bot reveals a problem, the user (or `/gmk-prototype` again) fixes it.
- **Doesn't try to "save" a failing prototype.** No coaxing the bot, no relaxing thresholds to make it pass. Failing fast is the kit's value prop.

## Notes for the model running this skill

- **Wall time matters.** 200 runs × even 2 seconds each is 6+ minutes. Keep the user informed: every 25 runs, print a one-liner `[validate] 25/200 runs done, 3 crashes so far, ETA 4m`.
- **Don't truncate the runner script for "cleanliness."** The runner is a black box for the user; it just needs to produce reliable JSON. Keep the error-handling robust there even if it makes the file longer than the SKILL.md examples.
- **`page.evaluate` is the only way state crosses the boundary.** Don't try to share JS objects between Node and the page — serialize through `evaluate` arguments and return values.
- **`bypassCSP: true`** in the browser context — some prototypes might inline strict CSP that blocks the eval-style hook calls. Bypassing in headless mode is fine; production runs aren't a concern here.
- **Don't install Playwright for the user.** It's a 150MB pull and a global Chromium binary. The Preconditions step tells them how; respect their choice if they decline.
- **Don't lecture on FAIL.** The report names what failed and what the bot is "telling" the user — that's enough. Resist adding three more paragraphs of advice.
- **The verdict is advisory, the data is authoritative.** If a user disagrees with the PASS/FAIL line, they can read the metrics and override. Don't argue.
- **One run, one report.** Don't chain validate calls or "re-run with different policy" automatically. The user drives.
