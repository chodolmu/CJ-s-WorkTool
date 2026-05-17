---
name: gmk-validate
description: Run a 200-game Playwright bot trial against an HTML prototype to gate a milestone objectively. Defaults to a persona-mix policy (Runner/Treasure/Survivor/Explorer × 50 each), computes clear rate / dominant strategy / state coverage / action entropy plus hypothesis-specific bot metrics, auto-extracts ~20 suspicious outlier seeds for /gmk-self-test, prunes early-failing trials at 30 runs to save wall time, writes the verdict and by_persona breakdown into milestones.json. Use when the user says "/gmk-validate <name>", "validate prototype", "run bot", "마일스톤 검증", or wants the objective half of milestone gating before self-test. Run AFTER /gmk-prototype has produced the HTML and registered the milestone.
model: sonnet
---

# gmk-validate — Bot the prototype, gate the milestone

This is the **objective** half of the gate. The bot can't tell you if the game is fun — but it can tell you, before you waste any of your own play time, whether the prototype is broken, trivially solvable, stuck on a single dominant strategy, or has a state space the bot can barely visit.

If a prototype fails this gate, you don't waste a self-test session on it. You fix it or kill it.

## What this skill does, end to end

1. Reads `prototypes/<name>.html` and `.gamemaker-kit/milestones.json`.
2. Runs the 5-point hook smoke check from `gmk-prototype-rules` §5 (hook exists, API version, required functions, determinism with two seed=0 runs, bounded). Abort with a named reason on any miss.
3. Boots Playwright Chromium headless, navigates to the file via `file://`.
4. Calls `window.__gmk_botHook__.startGame(seed)` with seeds 0..N-1 (default N=200).
5. Loops `act(choice)` until `isOver()` for each run, picking actions via the configured policy. Default: **persona-mix** — 50 runs each of Runner, Treasure, Survivor, Explorer.
6. After ~30 runs, evaluates each active `early_fail` row in `hypothesis.measured_by`. If a row's condition is already missed beyond rescue, marks the trial **pruned** and stops at 30 (saves ~85% wall time on doomed configurations).
7. Aggregates `summary()` results into objective metrics (always-on + persona-conditional + hypothesis-specific).
8. Auto-extracts ~20 suspicious outlier seeds (entropy/duration extremes, crashed/stuck) into `.gamemaker-kit/validations/<m>/suspicious/{seed}.json` for `/gmk-self-test` to surface.
9. Writes a `validation` block (with `by_persona` breakdown) back into `milestones.json`, and the per-trial trace into `.gamemaker-kit/validations/<m>/trial-{id}.json` + rolled-up `aggregated.json`.
10. Prints PASS / FAIL / INCONCLUSIVE with the persona-conditional and suspicious-seed callouts.

## Preconditions

Before running anything, verify and stop with a clear message if any fails:

1. **Milestone exists.** Read `.gamemaker-kit/milestones.json` and find an entry with `id === <name>`. If not found: list available milestone IDs and stop.
2. **Prototype file exists.** Path from milestone entry's `prototype` field. If missing: stop.
3. **Playwright installed.** Run `npx playwright --version`. If it errors, print:
   *"Playwright isn't installed. Install with: `npm i -D playwright && npx playwright install chromium`. This is a one-time setup; the kit reuses Chromium across runs."*
   Stop. Don't auto-install — Playwright pulls ~150MB and the user should know.
4. **Hook 5-point smoke check** (per `gmk-prototype-rules` §5):
   - (i) `typeof window.__gmk_botHook__ === 'object'`
   - (ii) `window.__gmk_botHook__._gmkApiVersion === 1`
   - (iii) `startGame`, `isOver`, `legalActions`, `act`, `summary` all `typeof === 'function'`
   - (iv) **Determinism** — two consecutive `seed=0` runs produce identical `summary()` (deep-equal). If they diverge, stop with: *"Prototype is non-deterministic. Same seed, two runs, different outcomes. Likely causes (in order): `Math.random` in game logic, `Date.now` in state, wall-clock in legalActions/isOver. Fix and rerun."*
   - (v) **Bounded** — `isOver()` becomes true within `maxActions` for at least one of `seed ∈ {0, 1, 2}`. If not, stop with: *"Prototype never ends across 3 seeds. Check the win/loss condition or lower `maxActions`."*
   Each miss has its own message; don't bundle them.
5. **Persona capabilities** — read `_gmkPersonaCapabilities` from the hook. Log which optional callbacks exist:
   - `stateSignature`: gates the `state_coverage` metric. Missing → metric reported as `null` (not zero — absence ≠ failure).
   - `riskEstimate`: gates the Survivor persona. Missing → Survivor falls back to uniform-random with `fallback_used: 'risk'` flagged.
   - `progressEstimate`: gates the Runner persona. Missing → Runner falls back the same way.
   - `noveltyScore`: gates the Explorer persona. Missing → Explorer falls back the same way.

   The default `persona-mix` policy is still 4 × 50; falling-back personas don't get skipped (we still want their *random* baselines for comparison). The trial result records which personas were toothless so suspicious-run analysis doesn't blame them.

_Standard preconditions (milestone-id resolution, empty/partial state, refuse-chain cycle guard, kit_version read contract) follow `gmk-prototype-rules` Rule 13-14, 16._

## Flow

### Step 1 — Resolve the run plan

Skill input: `<name>` plus optional flags. Defaults:

- `--runs 200` (total bot games)
- `--policy persona-mix` — 50 Runner / 50 Treasure / 50 Survivor / 50 Explorer. Alternatives: `random`, `mcts`, `mixed`, or a single persona name (`runner` / `treasure` / `survivor` / `explorer`).
- `--max-actions 5000` (per-run safety ceiling, matches `gmk-prototype-rules` §9)
- `--max-duration-sec 600` (per-run sim-time ceiling, matches §9)
- `--seed-offset 0` (seeds will be `seed-offset .. seed-offset + runs - 1`)
- `--prune` (default ON for `persona-mix`; off for explicit single-persona runs — early_fail decisions need persona context to be fair)
- `--keep-traces` (off by default; on, save Playwright trace zip per crashed run)

For `shape: 'continuous'` (real-time reflexes), persona-mix is still valid — personas re-bias the *choice* among legalActions; tick rate doesn't change.

For `shape: 'shader'` (visual-only milestones reaching Wave D), bot validation contributes little. The skill still runs preflight (hook smoke check) but reports `verdict: 'INCONCLUSIVE'` with reason `'shader-shape-not-bot-gateable'` and points the user at `/gmk-self-test` immediately.

### Step 2 — Show the run plan, get confirmation

Before launching 200 browsers, show:

```
Validating: m1-merge-feel
  Prototype: prototypes/m1-merge-feel.html
  Hook callbacks: stateSignature ✓  riskEstimate ✓  progressEstimate ✓  noveltyScore ✗
                  (Explorer will fall back to random — noted)
  Hypothesis (bot rows):
    - session_length_avg_ms   target: > 240000   (n=200, conf=0.90)
    - dominant_strategy_ratio target: < 0.6      (guardrail)
  Early-fail rules:
    - after 30 runs: session_length_avg_ms < 60000 → prune
  Policy: persona-mix (50 each of Runner/Treasure/Survivor/Explorer)
  Runs: 200      Max actions/run: 5000      Max duration/run: 600s sim
  Estimated wall time: ~2-5 min  (depends on prototype)

Proceed?
```

If the user typed `/gmk-validate <name> --yes`, skip the prompt.

### Step 3 — Spawn the runner

Generate `.gamemaker-kit/.validate-runner.cjs` (gitignore-able, overwritten each run) and execute it via `node`. The runner owns the Playwright loop and applies the persona policy per-action.

```javascript
// .gamemaker-kit/.validate-runner.cjs
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ bypassCSP: true });
  const page = await ctx.newPage();

  const fileUrl = 'file://' + path.resolve(process.argv[2]).replace(/\\/g, '/');
  const runs = parseInt(process.argv[3], 10);
  const policy = process.argv[4];        // 'persona-mix' | 'random' | 'runner' | ...
  const seedOffset = parseInt(process.argv[5], 10);
  const maxActions = parseInt(process.argv[6], 10);
  const pruneOn = process.argv[7] === 'true';
  const earlyFailJSON = process.argv[8]; // JSON-encoded early_fail rules

  const results = [];
  let pruned = false; let prunedReason = null;

  for (let i = 0; i < runs; i++) {
    const seed = seedOffset + i;
    const persona = personaForRun(policy, i);
    await page.goto(fileUrl);

    try {
      await page.evaluate((s) => window.__gmk_botHook__.startGame(s), seed);

      let actions = 0;
      const actionLog = [];               // for entropy/dominant-strategy
      const stateSigs = new Set();        // for state_coverage
      let firstStateSig = null;

      while (actions < maxActions) {
        const over = await page.evaluate(() => window.__gmk_botHook__.isOver());
        if (over) break;
        const legal = await page.evaluate(() => window.__gmk_botHook__.legalActions());
        if (!legal || legal.length === 0) break;

        // Persona-weighted choice. Each persona queries its optional callbacks
        // per action; null answers degrade that persona's term to uniform.
        const choice = await chooseAction(page, legal, persona, seed, actions);
        const sig = await page.evaluate(() => window.__gmk_botHook__.stateSignature());
        if (sig !== null) {
          stateSigs.add(sig);
          if (firstStateSig === null) firstStateSig = sig;
        }

        actionLog.push(choiceKey(choice));
        await page.evaluate((a) => window.__gmk_botHook__.act(a), choice);
        actions++;
      }

      const summary = await page.evaluate(() => window.__gmk_botHook__.summary());
      results.push({
        seed, persona,
        ...summary,
        actions_taken: actions,
        action_log: actionLog,
        state_coverage: stateSigs.size,
        first_state_sig: firstStateSig,
      });
    } catch (err) {
      results.push({ seed, persona, crashed: true, reason: String(err).slice(0, 200) });
    }

    // Progress + prune check at 30
    if ((i + 1) % 25 === 0) {
      process.stderr.write(`[validate] ${i + 1}/${runs}\n`);
    }
    if (pruneOn && i + 1 === 30) {
      const verdict = evaluateEarlyFail(results, JSON.parse(earlyFailJSON));
      if (verdict) {
        pruned = true; prunedReason = verdict;
        break;
      }
    }
  }

  await browser.close();
  process.stdout.write(JSON.stringify({ results, pruned, prunedReason }));
})().catch((e) => { console.error(e); process.exit(1); });
```

Helper functions the runner needs (kept short here; the runner file inlines fuller versions):

- `personaForRun(policy, i)` — for `persona-mix` with 200 runs: `['Runner','Treasure','Survivor','Explorer'][Math.floor(i / 50)]`. For single-persona or `random`, return that.
- `chooseAction(page, legal, persona, seed, t)` — see "Persona utilities" below. Always falls back to seeded LCG random when a persona's signals are null.
- `choiceKey(action)` — stable string for action_log (used to detect dominant strategy). For object actions, `JSON.stringify`.
- `evaluateEarlyFail(results, rules)` — for each `{after_runs, condition}` rule, evaluate the condition over the first N results. Return a `prunedReason` string if any rule fires; null otherwise.

### Persona utilities (Procedural Personas v1)

Four hand-tuned scoring functions. **No evolutionary learning, no in-trial adaptation.** Score per legal action; softmax with temperature 0.5; sample with the seeded LCG.

```js
// `score(s, a)` is the hypothesis-specific score delta the action would produce.
// Personas don't know the delta directly; they use the hook's optional callbacks
// as proxies. When a callback is missing, that term degrades to 0 (uniform).
const personas = {
  Runner:   (a) => 0.8 * (progressEstimate() ?? 0) + 0.2 * (scoreSignal(a) ?? 0),
  Treasure: (a) => 0.1 * (progressEstimate() ?? 0) + 0.9 * (scoreSignal(a) ?? 0),
  Survivor: (a) => 0.5 * (progressEstimate() ?? 0) + 0.5 * (1 - (riskEstimate(a) ?? 0.5)),
  Explorer: (a) => 0.3 * (scoreSignal(a) ?? 0)     + 0.7 * (noveltyScore(a) ?? 0),
};
```

`scoreSignal(a)` is a heuristic — if `summary.score` exists, use the delta of the predicted post-action score; otherwise default 0 (random tie-breaking). Personas don't need exact scoring; the *bias* matters, not absolute correctness.

When a persona's primary signal is absent (e.g. Survivor with no `riskEstimate`), the runner stamps `fallback_used: ['risk']` on every run by that persona. `/gmk-self-test` surfacing then weights those persona's outliers lower (their suspiciousness is partly the kit's fault, not the prototype's).

### Step 4 — Aggregate results

Parse runner stdout JSON. Compute three layers of metrics.

**Always-on objective metrics** (one row in milestones.json regardless of hypothesis):

| Metric | Definition | Why it matters |
|---|---|---|
| `clear_rate` | runs where `summary.score >= clear_threshold` ÷ non-crashed runs (null if no clear concept) | < 5% = bot can't reach interesting states. > 95% = game plays itself. |
| `crash_rate` | crashed runs ÷ total runs | > 1% = unstable. > 5% = hard FAIL — fix before any other gate matters. |
| `dominant_strategy_ratio` | most-common 5-action prefix frequency ÷ non-crashed runs (null for `shape: 'continuous'`) | > 0.6 = single obvious play; mechanic isn't a real choice. |
| `session_length_avg_ms` | mean `summary.duration_ms` across non-crashed runs | Compared to hypothesis if named. |
| `actions_taken_avg` | mean `summary.actions_taken` across non-crashed runs | Sanity check. |
| `action_entropy` | Shannon entropy of action distribution across all runs, in bits | Low = bot does one thing (similar signal to dominant_strategy_ratio but smoother). Used by suspicious-run extraction. |
| `state_coverage` | mean number of unique `stateSignature()` values per run (across non-crashed runs); `null` if `stateSignature` callback absent | Low = bot grinds the same 3 states. High doesn't mean *fun* — but very low usually means the game collapsed to a corner. |
| `timed_out_rate` | runs where `isOver()` was forced true by the cap | > 0.5 = bounding is wrong (warn, don't auto-FAIL). |
| `stuck_rate` | runs that hit empty legalActions without `isOver()` | > 0.05 = prototype bug (downgrade to FAIL with reason `stuck-state`). |

**Persona-conditional metrics** (`by_persona` in the validation block):

For each persona in the run, compute the same always-on metrics. Plus per-persona:

- `score_avg` and `score_stdev`
- `fallback_used: string[]` — which signals degraded
- A short verdict per persona: `PASS|FAIL|INCONCLUSIVE` against the hypothesis's bot rows applied to that subset

Aggregate-level interpretations the report should call out:

- If Runner's `clear_rate` is high but Treasure's is near zero → the win condition rewards rushing only, the scoring axis is underweighted in the design.
- If Explorer's `state_coverage` is the same as Random's → the noveltyScore callback isn't producing meaningful signal (or the game's branching is shallow).
- If Survivor's `crash_rate` is much higher than others → "risky" actions are crashing the prototype, not just losing the game. That's a bug, not a balance issue.

**Hypothesis-specific rows** — for each entry in `hypothesis.measured_by` where `kind === "bot"`:

- Match `metric` to an always-on metric or a key in `summary.custom`.
- Parse `target` (`>`, `<`, `==`, `between`) into a comparator.
- If `confidence` is set (0.80/0.90/0.95), apply a one-sided binomial / normal CI check sized by `sample_size` (default = `--runs`). The reported `actual` is the point estimate; the `passed` field is the CI-aware decision.
- Compute pass/fail per row.

### Aggregate verdict

- **PASS** — every bot row passes (CI-aware) AND `crash_rate < 0.01` AND (`dominant_strategy_ratio < 0.6` or null) AND `stuck_rate < 0.05`.
- **FAIL** — any bot row fails its CI check, OR `crash_rate >= 0.05`, OR `dominant_strategy_ratio >= 0.7`, OR `stuck_rate >= 0.05`, OR the trial was pruned (pruning *is* a fail with an early exit).
- **INCONCLUSIVE** — anything in between (e.g. a row passes the point estimate but not the CI; or a guardrail is borderline). Always print *why* inconclusive.

Crash priority: if `crash_rate >= 0.5`, don't bother with anything else. Print deduplicated crash reasons and stop. The rest is noise on top of a broken prototype.

### Step 5 — Suspicious-run extraction

After aggregation (or pruning), pick ~20 outlier seeds from the runs that *did* complete. Selection rule (cap each bucket; total ≤ 20):

- Entropy bottom 10% of non-crashed runs (bot did one thing) — up to 5
- Entropy top 10% (bot flailed) — up to 5
- Duration bottom 5% AND top 5% — up to 5 combined
- All crashed or stuck runs — up to 5 (oldest reason types first)

Write each as `.gamemaker-kit/validations/<m>/suspicious/{seed}.json`:

```json
{
  "seed": 17,
  "persona": "Runner",
  "reason": "entropy-low",
  "actions": ["merge", "merge", "merge", "merge", "..."],
  "summary": { "score": 12, "duration_ms": 31200, "actions_taken": 47, "crashed": false, "stuck": false, "custom": {} },
  "state_coverage": 4,
  "replay_url": "file:///C:/.../prototypes/m1-merge-feel.html?seed=17"
}
```

These are the **only** runs `/gmk-self-test` shows the user in priority. The other 180+ runs stay in `trial-{id}.json` for forensic dives but are not surfaced.

### Step 6 — Write back to disk

Three writes, in order:

1. `.gamemaker-kit/validations/<m>/trial-{trial-id}.json` — full per-run trace + config. Immutable.

   ```json
   {
     "trial_id": "t-2026-05-12-01",
     "milestone_id": "m1-merge-feel",
     "started_at": "...", "finished_at": "...",
     "config": { "policy": "persona-mix", "runs": 200, "seed_offset": 0, "prune": true },
     "pruned": false,
     "pruned_reason": null,
     "runs": [ /* per-seed records */ ],
     "aggregates": { /* always-on metrics */ },
     "by_persona": { "Runner": {...}, "Treasure": {...}, "Survivor": {...}, "Explorer": {...} }
   }
   ```

2. `.gamemaker-kit/validations/<m>/aggregated.json` — rolled across all trials for this milestone (latest-first metrics summary, no per-run data). Overwrite.

3. `.gamemaker-kit/milestones.json` — merge into the milestone entry:

   ```json
   {
     "id": "m1-merge-feel",
     "validation": {
       "ran_at": "2026-05-12T13:42:00Z",
       "trial_id": "t-2026-05-12-01",
       "runs": 200,
       "policy": "persona-mix",
       "pruned": false,
       "metrics": { /* always-on */ },
       "by_persona": { /* same shape, four keys */ },
       "hypothesis_rows": [
         { "metric": "session_length_avg_ms", "target": "> 240000", "actual_value": 287000, "ci": "[270, 304]k", "kind": "bot", "passed": true }
       ],
       "suspicious_seeds": [17, 42, 88, 3, 199, ...],
       "verdict": "PASS"
     }
   }
   ```

   **v0.4 deprecation**: do NOT write `validation.guardrails`, `hypothesis.trials[]`, or `validation_history[]`. These fields were v0.2 write-only trace data that no skill ever read; v0.4 removes the writes (see `structure.md` § v0.4 deprecated fields). The per-trial trace already lives at `.gamemaker-kit/validations/<m>/trial-{id}.json` (immutable on disk); the milestones.json roll-up keeps only the top-level `validation` block.

Don't touch `self_test`, `merge_gate`, `ported_to`, `tasks`, `killed`, or anything else — just merge under `validation`.

If a previous validation entry exists, **overwrite** the top-level `validation` block. Do not push the old one into `validation_history[]` (deprecated). The previous `trial-{id}.json` on disk is sufficient history; the milestones.json roll-up is current-only.

### Step 7 — Print the verdict report

Plain-text, no JSON dumps. Example for PASS:

```
m1-merge-feel — VERDICT: PASS  (trial t-2026-05-12-01, persona-mix × 200)

  Hypothesis (bot rows):
    ✓ session_length_avg_ms   target: > 240000   actual: 287000 (CI 270k-304k @ 0.90)

  Always-on metrics:
    clear_rate                : 67%
    crash_rate                : 0.0%
    dominant_strategy_ratio   : 31%   (no single play dominates — good)
    action_entropy            : 1.72 bits
    state_coverage            : 42 unique states / run
    actions_taken_avg         : 142

  By persona (clear_rate / session_length_avg_ms):
    Runner    72% / 295k
    Treasure  65% / 281k
    Survivor  61% / 290k
    Explorer  70% / 282k   (fallback: ['novelty'] — Explorer ran random for novelty term)

  Suspicious runs surfaced for /gmk-self-test: 17, 42, 88 (entropy-low) · 3, 199 (entropy-high) · ...

Next:
  /gmk-self-test m1-merge-feel  — play the suspicious seeds yourself, verdict the milestone
```

Example for FAIL (pruned):

```
m1-merge-feel — VERDICT: FAIL  (trial t-2026-05-12-01, PRUNED at 30 runs)

  Early-fail rule tripped:
    after 30 runs: session_length_avg_ms < 60000   actual at 30: 38000

  Always-on metrics (partial, 30 runs):
    crash_rate                : 0.0%
    dominant_strategy_ratio   : 78%   (one play dominates already)
    action_entropy            : 0.41 bits

  What the bot is telling you:
    Sessions die fast and the bot has already collapsed onto one action. The
    decision space is too narrow for the pillar 'greed-vs-safety' to land in
    this prototype shape.

Next: don't /gmk-self-test this. Either:
  - Widen the action space / soften the failure punishment, then rerun
  - /gmk-kill-milestone m1-merge-feel  — log the lesson, move on
```

### Step 8 — Don't auto-advance

Whatever the verdict, **do not** automatically call `/gmk-self-test` or `/gmk-port`. Verdicts are advisory; the user owns the GO/NO-GO call. Print "Next:" suggestions and stop.

### Step 8.5 — Route to domain agents on FAIL / borderline metrics

When the verdict is **FAIL** or **INCONCLUSIVE**, the "Next:" block must include a routing recommendation to one of the four domain agents. The user owns the routing decision; this skill just surfaces the highest-value match.

Routing table (apply *in order*, stop at first match):

| Condition | Recommended agent | Why |
|---|---|---|
| `crash_rate >= 0.05` OR `stuck_rate >= 0.05` | `playtest-analyst` | Crashes/stuck states are *systemic* failures. The analyst will read suspicious runs and route further to `systems-designer` (invariant violation) or `gmk-prototype` (re-spec). |
| Any persona's `clear_rate` is 2σ+ away from the others | `playtest-analyst` | Persona-specific failure. The analyst diagnoses *which* persona and routes accordingly. |
| `dominant_strategy_ratio >= 0.7` OR `action_entropy < 1.0` | `economy-balancer` | Single dominant play = numeric balance problem. The agent's "Dominant strategy" archetype applies directly. (Note: agent requires structured measured_by row.) |
| `state_coverage < 0.5` (where available) | `playtest-analyst` | State starvation — analyst routes to `systems-designer` (missing transition?) after reading suspicious runs. |
| Any bot row FAILs its CI check, no other guardrail tripped | `playtest-analyst` | Metric-specific failure; analyst diagnoses *why* the target was missed. |
| INCONCLUSIVE only (no guardrail tripped) | (none — recommend re-run with `--sample-size 400` OR `/gmk-self-test` for sensory check) | Not enough signal for an agent. Get more samples or human signal first. |
| Self-test row FAIL while bot rows PASS (rare at validate time, more common at self-test time) | `feel-engineer` | Sensory miss — handled by `gmk-self-test`'s own routing; surface here only if the user is jumping straight to fix without running self-test. |

**Format for the Next: block on FAIL**:

```
Next: don't /gmk-self-test this. Either:
  - @playtest-analyst m1-merge-feel  — diagnose which pattern (persona / dominant / starvation / crash) and route
  - /gmk-kill-milestone m1-merge-feel  — log the lesson, move on
  - Edit the prototype and re-run /gmk-validate
```

**Do not auto-invoke the agent.** The user reads the suggestion, then runs `@playtest-analyst <id>` (or `@economy-balancer <id>`) themselves. Playtest-analyst's preconditions (validation result exists, hypothesis structured) are already satisfied by the time this verdict prints.

_The routing output follows `gmk-prototype-rules` Rule 15 (agent routing block format)._

Reasoning: this routing turns a FAIL verdict into an actionable next step. v0.2 left FAIL verdicts as "user-figures-it-out"; v0.3 wires the closest domain expert in.

## Sub-flags

Complete flag catalog. Every flag this skill recognizes is listed here; any `--<flag>` referenced elsewhere in this file that is not in this table is a documentation bug.

| Flag | Default | Effect | Side-effect on milestones.json |
|---|---|---|---|
| `--runs N` | `200` | Total bot trial count for this invocation. | Recorded in `validation.runs`. |
| `--policy <name>` | `persona-mix` | One of `persona-mix` / `random` / `mcts` / `mixed` / `runner` / `treasure` / `survivor` / `explorer`. Single-persona names skip the persona-mix distribution. | Recorded in `validation.policy`. |
| `--seed-offset N` | `0` | Seeds used are `N .. N + runs - 1`. Lets the user reproduce specific bands without re-using prior seed values. | None — derivable from `runs` + start seed. |
| `--max-actions N` | `5000` | Per-run safety ceiling (per `gmk-prototype-rules` §9). | None. |
| `--max-duration-sec N` | `600` | Per-run wall-time ceiling. | None. |
| `--prune` / `--no-prune` | `on` for `persona-mix`, `off` for single-persona | Enable / disable early-fail pruning at ~30 runs (Step 1 §6). Single-persona is `off` by default because early_fail rules are calibrated for the mixed distribution. | None. |
| `--confidence X` | `0.90` | One-sided binomial / normal CI confidence level (0.80 / 0.90 / 0.95). Used in hypothesis-row CI-aware decisions (Step 4). | None — affects `hypothesis_rows[].passed` aggregation. |
| `--sample-size N` | `= --runs` | Override for the CI's sample size if hypothesis row authored against a tighter bound. | None. |
| `--keep-traces` | `off` | If on, save Playwright trace zip per crashed run for offline inspection. | None — disk only. |
| `--rebaseline` | — | Re-runs the trial AND replaces the existing baseline (`validation` top-level) without going through the regression path. Use when `gmk-regression` warns "persona definitions may have changed" and you accept that the *baseline* should be updated, not the prototype's verdict. Previous `validation` is *not* archived (it's a manual reset, not a regression trial). Refuses if no previous `validation` exists — there's nothing to rebaseline. | Overwrites `validation` top-level. Does *not* touch `validation_history[]` (deprecated in v0.4, see CHANGELOG). |
| `--accept-regression` | — | After `gmk-regression` flagged a verdict change, commit the new trial as the authoritative `validation` (downgrades PASS → FAIL or upgrades FAIL → PASS deliberately). Refuses if no recent regression trial exists for this milestone. | Overwrites `validation` top-level with the most recent regression-trial result. `regression_of_trial` field records the prior baseline trial id for trace. |
| `--skip --reason "<text>"` | — | Marks the milestone's `validation` as deliberately skipped without running bots. Required when the mechanic is bot-trivial (no death, no score, no decision pressure). The reason is stored verbatim so `gmk-self-test` and `gmk-loop` can verify the skip was intentional. Refuses if `--reason` is missing or empty (silent skips are not allowed). | Writes `validation: { skipped: true, skipped_reason: "<text>", skipped_at: "<iso>" }`. Other validation fields are not set. |

`--rebaseline` vs `--accept-regression` vs `--skip`: three different escape hatches for three different situations.
- `--rebaseline`: the *measurement infrastructure* changed and you want to re-set the line.
- `--accept-regression`: the *prototype* drifted and you accept the new verdict.
- `--skip`: the *mechanic* doesn't admit bot signal, never did, and shouldn't.

None of these three flags auto-invoke each other; the user picks one explicitly.

## Edge cases & policy

### `legalActions()` returns empty but `isOver()` is false

Library catches this and flags `stuck: true`. Treat the run as a soft fail. If `stuck_rate >= 0.05`, verdict downgrades to FAIL with reason `stuck-state`. That's a prototype bug per `gmk-prototype-rules` §5.

### `summary()` throws or returns malformed data

Library catches; the run is marked `crashed: true` with `reason: 'collectSummary: <message>'`. Don't try to recover partial data.

### Prototypes that need user input before the bot can act

Title screen, name entry, splash modal — all violations of the kit's spirit (`gmk-prototype-rules` Rule 6 area). Tell the user: *"The bot can't get past the entry screen. Edit the prototype to land directly in the playable state on load. That's a prototype rule, not a validate rule."* Stop.

### Single-persona runs

`/gmk-validate <name> --policy survivor` runs 200 Survivor games (or whatever `--runs` is). Useful for isolating a balance hypothesis ("does this milestone reward cautious play?"). Pruning is off by default for single-persona — early_fail decisions are calibrated for the mixed distribution.

### MCTS / mixed policies

Still supported (per v0.1) but secondary to persona-mix:

- `mcts`: depth-3 lookahead. Only viable when `legalActions().length` is small (< 20) AND the game is deterministic. Costs ~5-15x random per action.
- `mixed`: 80% random + 20% MCTS, per-action coin flip. Hedges between "smart play" and "random survival" signals.

Use when the user explicitly asks, or persona-mix produced `INCONCLUSIVE` and you want a smarter baseline.

### `shape: 'shader'` prototypes

Bot validation contributes little (no decision space). Run preflight only, then immediately stop with `verdict: 'INCONCLUSIVE'`, reason `shader-shape-not-bot-gateable`, and point the user at `/gmk-self-test`. No personas, no suspicious-run extraction.

### Re-running

Re-running on the same milestone **overwrites** top-level `validation` directly — no append to `validation_history[]` (that field was deprecated in v0.4; see CHANGELOG). The previous `trial-{id}.json` stays on disk (immutable), which is the canonical trace. `suspicious/` is overwritten by the new trial's outliers — old suspicions are gone (read them from the old `trial-{id}.json` if needed).

### Determinism check failing on Wave A migration

A v0.1 prototype using `Math.random()` without `__gmk.createRng` will fail the determinism check. Don't auto-patch; cite `gmk-prototype-rules` §3 and let the user fix.

## What this skill does NOT do

- **Doesn't measure fun.** That's `/gmk-self-test` (the user themselves only — no external humans, see Rule 10 in `gmk-prototype-rules`).
- **Doesn't deploy / share.** External release is outside gmk's scope.
- **Doesn't modify the prototype.** Read-only. If the bot reveals a problem, the user (or `/gmk-prototype` again) fixes it.
- **Doesn't try to "save" a failing prototype.** No coaxing the bot, no relaxing thresholds. Failing fast is the kit's value prop.
- **Doesn't evolve / learn the personas.** They're hand-tuned and frozen at v1. Auto-evolving personas drift away from being interpretable signal sources.

## Notes for the model running this skill

- **Cite `gmk-prototype-rules` when stopping on a rule violation.** "/gmk-validate refused (gmk-prototype-rules §5: determinism check)." Saves the user one click.
- **Wall time matters.** 200 runs × even 2 seconds each is 6+ minutes. Print progress every 25 runs: `[validate] 50/200, persona=Treasure, 1 crash so far, ETA 3m`.
- **`page.evaluate` is the only state boundary.** Don't try to share JS objects between Node and the page — serialize through `evaluate` arguments and return values.
- **`bypassCSP: true` on the browser context.** Strict CSP in a prototype shouldn't block the eval-style hook calls. Bypassing in headless is safe; production CSP isn't this skill's concern.
- **Don't install Playwright for the user.** 150MB pull + a global Chromium binary. The Preconditions step tells them how; respect their choice if they decline.
- **Don't lecture on FAIL.** Name what failed and what the bot is "telling" the user — that's enough. Resist three more paragraphs of advice.
- **The verdict is advisory; the data is authoritative.** A user who disagrees with PASS/FAIL can read the metrics and override. Don't argue.
- **One run, one report.** Don't chain validate calls or re-run with different policy automatically. The user drives.
- **Persona fallbacks are not failures.** A prototype that omits `noveltyScore` still gets a valid trial; the report just flags Explorer as `fallback_used: ['novelty']` so the user knows the Explorer numbers are essentially random.
- **Pruning saves time, not signal.** A pruned trial *is* a FAIL. Don't soft-pedal it ("the trial was cut short") — say the early_fail rule tripped and what its threshold was.
