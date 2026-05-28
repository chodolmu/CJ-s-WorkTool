#!/usr/bin/env node
// scripts/auto-runner.js — v0.10 Phase 1 auto-mode runner.
//
// OS-level Node process. NOT spawned from a Claude session — the user runs
// `node scripts/auto-runner.js` themselves (or via Windows Task Scheduler).
// See skills/gmk-auto-start/SKILL.md "Why this split."
//
// Phase 1 scope (Plan §Phase 1 — keep this narrow on purpose):
//   - Single milestone only (target.milestone_id from auto-state.json)
//   - State machine: PREFLIGHT → PICK_UNIT → INVOKE_CLAUDE → VERIFY → CHECKPOINT → loop
//   - Exits: STOP_BUDGET / CONVERGED / REQUESTED / MORNING / RUNNER_BUG
//   - Same-milestone regression only (patch_guard.js Phase 1)
//   - No hidden seed pool (Phase 2)
//   - No morning report generation (Phase 4)
//   - No cross-milestone scheduler (Phase 3)
//
// All work happens on `auto-night-<date>` branch — main is never touched.
//
// Honest scope warning: this is the v0.1 of the runner. The Phase 1 decision
// gate says "if 1 hour produced no useful work → stop and redesign". Do not
// surreptitiously bolt on Phase 2 features here.

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync, spawnSync } = require('child_process');

const stateIO = require('../runner/state_io');
const classifier = require('../runner/incident_classifier');
const patchGuard = require('../runner/patch_guard');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RUNNER_VERSION = '0.10.0-phase1';
const HEARTBEAT_INTERVAL_MS = 30 * 1000;
const PER_UNIT_BUDGET_USD_DEFAULT = 0.50;
const CONVERGENCE_NO_PROGRESS_LIMIT = 3; // 3 consecutive no-improvement units → CONVERGED

// Allowed tools the agent may call via `claude -p --allowedTools`. Kept tight:
// no Bash, no WebFetch, no Agent. The runner does NOT trust the agent with
// arbitrary shell — file edits are the entire scope of a work unit.
const ALLOWED_TOOLS = ['Read', 'Edit', 'Write', 'Glob', 'Grep'].join(',');

// Wall-clock TTL for a single `claude -p` invocation. The runner kills the
// subprocess past this. Distinct from --max-budget-usd which is Claude-side.
const PER_UNIT_WALL_MS = 10 * 60 * 1000;

// ---------------------------------------------------------------------------
// CLI parsing — minimal; the real config lives in auto-state.json. CLI args
// are escape hatches the user can use to override what /gmk-auto-start wrote.
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { _flags: {} };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq > 0) {
      out._flags[a.slice(2, eq)] = a.slice(eq + 1);
    } else {
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        out._flags[a.slice(2)] = next;
        i++;
      } else {
        out._flags[a.slice(2)] = true;
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Path helpers — auto-mode state lives under projectRoot/.gamemaker-kit/auto/
// Kit-shipped scripts live under kitRoot (= this script's parent's parent).
// ---------------------------------------------------------------------------

const KIT_ROOT = path.resolve(__dirname, '..');

function autoDir(projectRoot)       { return path.join(projectRoot, '.gamemaker-kit', 'auto'); }
function autoStateFile(projectRoot) { return path.join(autoDir(projectRoot), 'auto-state.json'); }
function lockFile(projectRoot)      { return path.join(autoDir(projectRoot), 'runner.lock'); }
function incidentsFile(projectRoot) { return path.join(autoDir(projectRoot), 'auto-incidents.json'); }
function checkpointDir(projectRoot) { return path.join(autoDir(projectRoot), 'checkpoints'); }
function baselineFile(projectRoot, milestoneId) {
  return path.join(projectRoot, '.gamemaker-kit', 'validations', milestoneId, 'baseline-locked.json');
}

// ---------------------------------------------------------------------------
// git helpers (scoped to projectRoot)
// ---------------------------------------------------------------------------

function git(projectRoot, args, opts) {
  return execFileSync('git', args, Object.assign({ cwd: projectRoot, encoding: 'utf8' }, opts || {}));
}

function gitTry(projectRoot, args) {
  const res = spawnSync('git', args, { cwd: projectRoot, encoding: 'utf8' });
  return { ok: res.status === 0, stdout: res.stdout, stderr: res.stderr, status: res.status };
}

function todayStamp() {
  const d = new Date();
  return d.getUTCFullYear() + '-' +
    String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(d.getUTCDate()).padStart(2, '0');
}

function ensureAutoBranch(projectRoot) {
  const base = `auto-night-${todayStamp()}`;
  const existing = gitTry(projectRoot, ['branch', '--list', base + '*']);
  const list = existing.ok ? existing.stdout.split('\n').map((s) => s.replace(/^\*?\s+/, '').trim()).filter(Boolean) : [];
  let name = base;
  let n = 2;
  while (list.includes(name)) {
    name = `${base}-${n++}`;
  }
  git(projectRoot, ['checkout', '-b', name]);
  return name;
}

// ---------------------------------------------------------------------------
// Heartbeat — fires every HEARTBEAT_INTERVAL_MS until clearHeartbeat() is
// called. Updates runner.lock's heartbeat_at field so /gmk-auto-status can
// distinguish "running" from "crashed."
// ---------------------------------------------------------------------------

function startHeartbeat(lockPath) {
  const h = setInterval(() => {
    try { stateIO.refreshHeartbeat(lockPath); }
    catch (_) { /* heartbeat failure is non-fatal */ }
  }, HEARTBEAT_INTERVAL_MS);
  h.unref();
  return h;
}

function clearHeartbeat(h) { if (h) clearInterval(h); }

// ---------------------------------------------------------------------------
// Stop signal — runner polls auto-state.json each CHECKPOINT for
// stop_requested. /gmk-auto-stop sets it. SIGKILL is never used (Plan §Edge
// Cases): the runner exits cleanly at the next checkpoint.
// ---------------------------------------------------------------------------

function readStopRequest(projectRoot) {
  const r = stateIO.loadAutoState(autoStateFile(projectRoot));
  return r.ok && r.state.stop_requested === true;
}

// ---------------------------------------------------------------------------
// Budget tracking. Each `claude -p` invocation should return its USD cost in
// the JSON output (per claude-code output-format=json contract). The runner
// accumulates it into state.budget.usd_spent and exits when the cap is hit.
// ---------------------------------------------------------------------------

function budgetRemaining(state) {
  return Math.max(0, (state.budget.usd_cap || 0) - (state.budget.usd_spent || 0));
}

function hoursElapsed(state) {
  const start = new Date(state.budget.started_at || state.started_at).getTime();
  return (Date.now() - start) / 3600000;
}

// ---------------------------------------------------------------------------
// claude -p invocation per work unit.
//
// Contract:
//   - Fresh session every time (no --resume — Drift trap defence per Plan §"4
//     함정" #3).
//   - Strict JSON I/O. Prompt asks for an output shape; runner refuses to
//     apply anything that doesn't parse.
//   - Budget cap PER UNIT (not session) so a runaway unit can't drain the
//     whole night's budget.
//   - --allowedTools constrained — see ALLOWED_TOOLS above.
//
// Returns { ok, response, cost_usd, raw_stdout, raw_stderr, exit_code } or
// { ok: false, classifier_input }.
// ---------------------------------------------------------------------------

function invokeClaudeUnit(opts) {
  const {
    projectRoot, prompt, unitBudgetUsd, sessionTag,
  } = opts;

  const args = [
    '-p',
    '--output-format', 'json',
    '--max-budget-usd', String(unitBudgetUsd),
    '--allowedTools', ALLOWED_TOOLS,
    '--session-id', sessionTag,
  ];

  const res = spawnSync('claude', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    input: prompt,
    timeout: PER_UNIT_WALL_MS,
    maxBuffer: 16 * 1024 * 1024,
  });

  if (res.error) {
    return {
      ok: false,
      classifier_input: {
        source: 'claude',
        kind: 'spawn-error',
        message: res.error.message,
        exit_code: -1,
      },
    };
  }
  if (res.status !== 0) {
    return {
      ok: false,
      classifier_input: {
        source: 'claude',
        kind: 'non-zero-exit',
        message: (res.stderr || '').slice(0, 1000),
        exit_code: res.status,
        http_status: extractHttpStatus(res.stderr),
      },
      raw_stdout: res.stdout,
      raw_stderr: res.stderr,
    };
  }

  let parsed;
  try { parsed = JSON.parse(res.stdout); }
  catch (err) {
    return {
      ok: false,
      classifier_input: {
        source: 'claude',
        kind: 'json-parse-error',
        message: err.message,
        exit_code: 0,
      },
      raw_stdout: res.stdout.slice(0, 4000),
    };
  }

  return {
    ok: true,
    response: parsed,
    cost_usd: Number(parsed.total_cost_usd || parsed.cost_usd || 0),
    raw_stdout: res.stdout,
    raw_stderr: res.stderr,
    exit_code: 0,
  };
}

function extractHttpStatus(stderr) {
  if (!stderr) return null;
  const m = /(?:HTTP\s+|status[:=]\s*)(\d{3})/i.exec(stderr);
  return m ? parseInt(m[1], 10) : null;
}

// ---------------------------------------------------------------------------
// Playwright driver — single-seed run, used by patch_guard's determinism gate
// and by the regression gate's full 200-game trial. This is the "self-owning"
// translation of gmk-validate Step 3's .validate-runner.cjs pattern that the
// handoff §Failed Approaches #4 warned about not assuming exists as a file.
//
// Phase 1 keeps it tight: persona-mix is the only policy, baseline-locked is
// the only comparison, no suspicious-seed extraction (that's Phase 2).
// ---------------------------------------------------------------------------

async function playwrightRunOnce(prototypeHtmlPath, seed) {
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch (err) {
    throw new Error(`playwright not installed: ${err.message} — see gmk-validate Preconditions §3`);
  }
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ bypassCSP: true });
  const page = await ctx.newPage();
  try {
    const url = 'file://' + path.resolve(prototypeHtmlPath).replace(/\\/g, '/');
    await page.goto(url);
    await page.evaluate((s) => window.__gmk_botHook__.startGame(s), seed);
    const maxActions = 5000;
    let actions = 0;
    while (actions < maxActions) {
      const over = await page.evaluate(() => window.__gmk_botHook__.isOver());
      if (over) break;
      const legal = await page.evaluate(() => window.__gmk_botHook__.legalActions());
      if (!legal || legal.length === 0) break;
      // Determinism probe: deterministic action choice — always pick legal[0].
      // The bot hook's LCG drives the *game*; the gate just needs same-seed
      // same-result. legal[0] gives us that without inventing a persona.
      await page.evaluate((a) => window.__gmk_botHook__.act(a), legal[0]);
      actions++;
    }
    const summary = await page.evaluate(() => window.__gmk_botHook__.summary());
    return Object.assign({}, summary, { actions_taken: actions });
  } finally {
    await browser.close();
  }
}

// Full 200-game persona-mix trial. Used by gate 4 (regression). Defers heavy
// lifting to spawning `node scripts/auto-runner-validate.js` if we ever split
// that out; Phase 1 inlines a minimal version here so we don't grow the
// surface area before we know the loop works.
async function runValidate(prototypeHtmlPath, opts) {
  const runs = opts.runs || 200;
  const personas = ['Runner', 'Treasure', 'Survivor', 'Explorer'];
  let chromium;
  try { ({ chromium } = require('playwright')); }
  catch (err) {
    throw new Error(`playwright not installed: ${err.message}`);
  }
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ bypassCSP: true });
  const page = await ctx.newPage();
  const results = [];
  try {
    const url = 'file://' + path.resolve(prototypeHtmlPath).replace(/\\/g, '/');
    for (let i = 0; i < runs; i++) {
      const persona = personas[Math.floor(i / Math.ceil(runs / personas.length))] || 'Runner';
      await page.goto(url);
      try {
        await page.evaluate((s) => window.__gmk_botHook__.startGame(s), i);
        let actions = 0;
        const actionLog = [];
        const maxA = 5000;
        while (actions < maxA) {
          const over = await page.evaluate(() => window.__gmk_botHook__.isOver());
          if (over) break;
          const legal = await page.evaluate(() => window.__gmk_botHook__.legalActions());
          if (!legal || legal.length === 0) break;
          // Phase 1 sticks with random-from-legal (uniform). Persona personas
          // exist in gmk-validate Step 3; the runner re-implements them in
          // Phase 2. For Phase 1 regression we just need a representative
          // distribution.
          const choice = legal[Math.floor(Math.random() * legal.length)];
          actionLog.push(typeof choice === 'object' ? JSON.stringify(choice) : String(choice));
          await page.evaluate((a) => window.__gmk_botHook__.act(a), choice);
          actions++;
        }
        const summary = await page.evaluate(() => window.__gmk_botHook__.summary());
        results.push(Object.assign({ seed: i, persona, action_log: actionLog }, summary));
      } catch (err) {
        results.push({ seed: i, persona, crashed: true, reason: String(err).slice(0, 200) });
      }
    }
  } finally {
    await browser.close();
  }
  return aggregateTrial(results);
}

function aggregateTrial(results) {
  const total = results.length;
  const nonCrashed = results.filter((r) => !r.crashed);
  const crashRate = (total - nonCrashed.length) / Math.max(1, total);
  const stuckRate = nonCrashed.filter((r) => r.stuck).length / Math.max(1, nonCrashed.length);
  const scores = nonCrashed.map((r) => r.score).filter((s) => typeof s === 'number');
  const meanDuration = mean(nonCrashed.map((r) => r.duration_ms).filter((x) => typeof x === 'number'));
  const meanActions = mean(nonCrashed.map((r) => r.actions_taken).filter((x) => typeof x === 'number'));

  // dominant_strategy_ratio: most-common 5-action prefix across non-crashed
  const prefixCounts = new Map();
  for (const r of nonCrashed) {
    const key = (r.action_log || []).slice(0, 5).join('|');
    prefixCounts.set(key, (prefixCounts.get(key) || 0) + 1);
  }
  let topPrefix = 0;
  for (const c of prefixCounts.values()) if (c > topPrefix) topPrefix = c;
  const dominantStrategy = nonCrashed.length > 0 ? topPrefix / nonCrashed.length : null;

  // crude action entropy across all actions
  const actionCounts = new Map();
  let totalActions = 0;
  for (const r of nonCrashed) {
    for (const a of (r.action_log || [])) {
      actionCounts.set(a, (actionCounts.get(a) || 0) + 1);
      totalActions++;
    }
  }
  let entropy = 0;
  if (totalActions > 0) {
    for (const c of actionCounts.values()) {
      const p = c / totalActions;
      if (p > 0) entropy -= p * Math.log2(p);
    }
  }

  const verdict =
    crashRate >= 0.05 ? 'FAIL' :
    stuckRate >= 0.05 ? 'FAIL' :
    dominantStrategy !== null && dominantStrategy >= 0.7 ? 'FAIL' :
    'PASS';

  return {
    verdict,
    metrics: {
      crash_rate: crashRate,
      stuck_rate: stuckRate,
      dominant_strategy_ratio: dominantStrategy,
      action_entropy: entropy,
      state_coverage: null, // Phase 1: not computed (Phase 2 will rejoin gmk-validate's full metric set)
      session_length_avg_ms: meanDuration,
      actions_taken_avg: meanActions,
      clear_rate: scores.length > 0 ? scores.filter((s) => s > 0).length / scores.length : null,
    },
    hypothesis_rows: [], // Phase 1: hypothesis re-evaluation lives in gmk-validate proper, not here
    by_persona: {},
    runs: total,
  };
}

function mean(arr) {
  if (!arr.length) return null;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// ---------------------------------------------------------------------------
// Work unit prompt builder. The agent gets:
//   - The milestone hypothesis
//   - The current validation metrics (and which row is failing)
//   - The strict output schema it MUST emit
//   - An explicit no-Bash, no-WebFetch budget
//
// The output schema is what the runner parses. Any deviation → agent-edit-error.
// ---------------------------------------------------------------------------

function buildUnitPrompt(milestone, baseline, attemptN) {
  const failingRows = (baseline.hypothesis_rows || []).filter((r) => r.passed === false);
  return [
    '# Auto-mode work unit (Phase 1)',
    '',
    `Milestone: ${milestone.id}`,
    `Prototype: ${milestone.prototype}`,
    `Attempt #: ${attemptN}`,
    '',
    '## Hypothesis (current verdict from baseline-locked.json)',
    JSON.stringify(milestone.hypothesis || {}, null, 2),
    '',
    '## Failing metric rows',
    failingRows.length ? JSON.stringify(failingRows, null, 2) : '(all baseline rows previously passed — task is to keep them passing while addressing the unit_objective)',
    '',
    '## Current baseline metrics',
    JSON.stringify(baseline.metrics || {}, null, 2),
    '',
    '## Your task',
    '',
    'Propose a SMALL, FOCUSED edit to the prototype HTML that addresses a failing row',
    'without regressing any passing row. Hard constraints (the patch_guard will',
    'reject violations):',
    `  - Total diff ≤ ${patchGuard.DIFF_LINE_CAP} significant lines.`,
    '  - Prototype must remain deterministic (seed=0 twice → identical summary, excluding duration_ms).',
    '  - Must not touch templates/_bot_hook_lib.js or any file outside the prototype.',
    '  - No new external dependencies. No Bash. No WebFetch. Edit/Read/Write only.',
    '',
    '## Required output schema (strict JSON, no prose around it)',
    '',
    'You must end your response with a single fenced ```json``` block matching:',
    '```json',
    JSON.stringify({
      decision: 'edit | skip | give-up',
      rationale_one_line: 'string ≤ 200 chars',
      target_metric: 'string (which failing row this is meant to address) | null',
      files_edited: ['list of repo-relative paths actually changed'],
      expected_metric_movement: 'string ≤ 200 chars (e.g. "raise dominant_strategy_ratio from 0.04 to ≥ 0.10 by widening action space")',
    }, null, 2),
    '```',
    '',
    'If decision = "skip", do not edit any file (the runner will treat this as no-op).',
    'If decision = "give-up", explain in rationale_one_line; the runner will log and stop.',
  ].join('\n');
}

function parseUnitResponse(claudeResponse) {
  // The claude -p JSON output has a top-level shape that includes `result`
  // (the final assistant message text). We look for the trailing ```json
  // block.
  const text =
    typeof claudeResponse === 'string' ? claudeResponse :
    claudeResponse.result || claudeResponse.message || JSON.stringify(claudeResponse);
  const m = /```json\s*([\s\S]*?)```\s*$/m.exec(text);
  if (!m) return { ok: false, reason: 'no trailing ```json``` block in response' };
  try {
    const obj = JSON.parse(m[1]);
    if (!obj.decision) return { ok: false, reason: 'missing decision field' };
    return { ok: true, parsed: obj };
  } catch (err) {
    return { ok: false, reason: `json parse: ${err.message}` };
  }
}

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

async function runStateMachine(projectRoot, args) {
  // 1. Load state (must already exist via /gmk-auto-start)
  const sFile = autoStateFile(projectRoot);
  const loaded = stateIO.loadAutoState(sFile);
  if (!loaded.ok) return exitWith('RUNNER_BUG', { reason: loaded.reason });

  const state = loaded.state;
  if (state.phase !== 'preflight_ok') {
    return exitWith('RUNNER_BUG', {
      reason: `auto-state.phase = ${state.phase}, expected "preflight_ok" — run /gmk-auto-start first`,
    });
  }
  state.runner.pid = process.pid;
  state.runner.host = os.hostname();

  // 2. Acquire single-instance lock
  const lockPath = lockFile(projectRoot);
  const existing = stateIO.loadRunnerLock(lockPath);
  if (existing.present && !existing.malformed) {
    const ageMin = (Date.now() - new Date(existing.lock.heartbeat_at).getTime()) / 60000;
    if (ageMin <= 5) {
      return exitWith('RUNNER_BUG', {
        reason: `runner.lock active (PID ${existing.lock.pid}, heartbeat ${ageMin.toFixed(1)}m ago) — refusing to start a second runner`,
      });
    }
  }
  const branch = ensureAutoBranch(projectRoot);
  state.runner.branch = branch;
  stateIO.writeRunnerLock(lockPath, { branch });
  const hb = startHeartbeat(lockPath);

  // Always tear down lock + heartbeat on exit
  function teardown() {
    clearHeartbeat(hb);
    stateIO.clearRunnerLock(lockPath);
  }

  try {
    stateIO.transitionPhase(state, 'running');
    stateIO.saveAutoState(sFile, state);

    // 3. Read milestone + baseline
    const milestonesPath = path.join(projectRoot, '.gamemaker-kit', 'milestones.json');
    const milestonesDoc = stateIO.readJson(milestonesPath);
    const milestone = (milestonesDoc.milestones || []).find((m) => m.id === state.target.milestone_id);
    if (!milestone) {
      return exitWith('RUNNER_BUG', { reason: `milestone ${state.target.milestone_id} not found` });
    }

    const baselinePath = baselineFile(projectRoot, milestone.id);
    let baseline = null;
    if (stateIO.existsFile(baselinePath)) {
      baseline = stateIO.readJson(baselinePath);
    } else {
      // Phase 1 fallback: if no baseline-locked.json yet, freeze the current
      // milestones.json validation block as the baseline. This is a one-shot
      // bootstrap — Phase 2 will require the user explicitly run /gmk-validate
      // first to create the baseline.
      if (milestone.validation && milestone.validation.verdict === 'PASS') {
        baseline = {
          frozen_at: new Date().toISOString(),
          metrics: milestone.validation.metrics,
          hypothesis_rows: milestone.validation.hypothesis_rows,
          source: 'milestones.json[validation] @ runner-start (Phase 1 bootstrap)',
        };
        fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
        stateIO.atomicWriteJson(baselinePath, baseline);
      } else {
        return exitWith('RUNNER_BUG', {
          reason: `no baseline-locked.json AND milestone validation is not PASS — auto-mode refuses (Plan §"4 함정" #2 — no metric to defend against hacking)`,
        });
      }
    }

    // 4. Main loop
    let noProgressUnits = 0;
    let unitCount = 0;
    while (true) {
      // 4a. Stop conditions
      if (readStopRequest(projectRoot)) {
        return exitWith('REQUESTED', { units_completed: unitCount });
      }
      if (budgetRemaining(state) <= 0) {
        return exitWith('STOP_BUDGET', { usd_spent: state.budget.usd_spent });
      }
      if (hoursElapsed(state) >= (state.budget.max_hours || 4)) {
        return exitWith('MORNING', { hours: hoursElapsed(state) });
      }
      if (noProgressUnits >= CONVERGENCE_NO_PROGRESS_LIMIT) {
        return exitWith('CONVERGED', { units_completed: unitCount, no_progress: noProgressUnits });
      }

      // 4b. PICK_UNIT (Phase 1 = always the same milestone, increment attempt #)
      unitCount++;
      const sessionTag = `auto-${milestone.id}-${todayStamp()}-u${unitCount}`;

      // 4c. INVOKE_CLAUDE
      const unitBudget = Math.min(
        PER_UNIT_BUDGET_USD_DEFAULT,
        budgetRemaining(state)
      );
      const prompt = buildUnitPrompt(milestone, baseline, unitCount);
      const inv = invokeClaudeUnit({
        projectRoot,
        prompt,
        unitBudgetUsd: unitBudget,
        sessionTag,
      });

      if (!inv.ok) {
        const inc = classifier.classify(inv.classifier_input);
        stateIO.appendIncident(incidentsFile(projectRoot), { unit: unitCount, ...inc });
        if (inc.retryable) {
          // Phase 1 retries inline once. If the second attempt also fails,
          // treat the unit as no-progress and continue.
          const retry = invokeClaudeUnit({ projectRoot, prompt, unitBudgetUsd: unitBudget, sessionTag: sessionTag + '-r' });
          if (!retry.ok) {
            stateIO.appendIncident(incidentsFile(projectRoot), {
              unit: unitCount, retry: true,
              ...classifier.classify(retry.classifier_input),
            });
            noProgressUnits++;
            continue;
          }
          Object.assign(inv, retry);
        } else if (inc.action === 'clean-exit') {
          return exitWith('STOP_BUDGET', { usd_spent: state.budget.usd_spent });
        } else {
          // hard incident on a Phase 1 unit → log + give up the unit (pause-milestone
          // semantics map to "this milestone's done for the night"; Phase 1 has
          // exactly one milestone, so this is CONVERGED).
          return exitWith('CONVERGED', { reason: 'hard incident on unit', incident: inc });
        }
      }

      state.budget.usd_spent = (state.budget.usd_spent || 0) + (inv.cost_usd || 0);

      // 4d. Parse agent response
      const parsed = parseUnitResponse(inv.response);
      if (!parsed.ok) {
        stateIO.appendIncident(incidentsFile(projectRoot), {
          unit: unitCount,
          ...classifier.classify({ source: 'claude', kind: 'schema-mismatch', message: parsed.reason }),
        });
        noProgressUnits++;
        continue;
      }

      if (parsed.parsed.decision === 'skip') {
        noProgressUnits++;
        stateIO.transitionPhase(state, 'running');
        stateIO.saveAutoState(sFile, state);
        continue;
      }
      if (parsed.parsed.decision === 'give-up') {
        return exitWith('CONVERGED', { reason: 'agent gave up', rationale: parsed.parsed.rationale_one_line });
      }

      // 4e. Check for actual file changes (agent claimed "edit" but maybe
      // didn't actually touch anything — happens when the prompt is unclear).
      const dirty = gitTry(projectRoot, ['status', '--porcelain']);
      if (!dirty.ok || !dirty.stdout.trim()) {
        // No changes despite decision=edit. Treat as no-progress.
        noProgressUnits++;
        continue;
      }

      // 4f. Commit the proposed patch (so patch_guard can `git revert` if needed)
      git(projectRoot, ['add', '-A']);
      const commitMsg = [
        `auto-patch: u${unitCount} attempt on ${milestone.id}`,
        '',
        `Rationale: ${parsed.parsed.rationale_one_line || '(none)'}`,
        `Target metric: ${parsed.parsed.target_metric || '(none)'}`,
        `Expected: ${parsed.parsed.expected_metric_movement || '(none)'}`,
        '',
        `Co-Authored-By: auto-runner@${RUNNER_VERSION}`,
      ].join('\n');
      git(projectRoot, ['commit', '-m', commitMsg]);
      const patchSha = git(projectRoot, ['rev-parse', 'HEAD']).trim();

      // 4g. VERIFY via patch_guard
      const verdict = await patchGuard.evaluatePatch({
        projectRoot,
        kitRoot: KIT_ROOT,
        patchSha,
        prototypeHtmlPath: path.join(projectRoot, milestone.prototype),
        baseline,
        playwrightRunOnce,
        runValidate,
      });

      stateIO.appendIncident(incidentsFile(projectRoot), {
        unit: unitCount,
        kind: 'patch-result',
        accepted: verdict.accepted,
        patch_sha: patchSha,
        gate_pass: verdict.gate_pass.map((g) => g.gate),
        gate_fail: verdict.gate_fail,
        reverted: verdict.reverted || false,
        revert_sha: verdict.revert_sha || null,
      });

      // 4h. Determinism-break is a hard stop (Plan §4.4 — "재시도 없음, 마일스톤 pause")
      const determinismFailed = (verdict.gate_fail || []).some((g) => g.kind === 'determinism-mismatch');
      if (determinismFailed) {
        return exitWith('CONVERGED', { reason: 'determinism-break on patched prototype', patch_sha: patchSha });
      }

      if (verdict.accepted) {
        // Phase 1 success signal: the patch passed all gates. Note this is
        // *not* the same as "the milestone is now better" — that's measured
        // by comparing trial metrics, which the regression gate already did.
        // The morning report (Phase 4) will compute the deltas; here we just
        // log success.
        noProgressUnits = 0;
        stateIO.transitionPhase(state, 'running');
        stateIO.saveAutoState(sFile, state);
        // CHECKPOINT
        stateIO.writeCheckpoint(checkpointDir(projectRoot), `u${unitCount}-accepted`, {
          state, milestone_id: milestone.id, patch_sha: patchSha,
        });
      } else {
        // Rejection was logged in 4g; the revert commit is already in history.
        noProgressUnits++;
        stateIO.writeCheckpoint(checkpointDir(projectRoot), `u${unitCount}-rejected`, {
          state, milestone_id: milestone.id, patch_sha: patchSha, gate_fail: verdict.gate_fail,
        });
      }

      stateIO.saveAutoState(sFile, state);
    }
  } catch (err) {
    stateIO.appendIncident(incidentsFile(projectRoot), classifier.classify({
      source: 'runner', message: err.message + '\n' + (err.stack || ''),
    }));
    stateIO.writeCheckpoint(checkpointDir(projectRoot), 'panic', {
      message: err.message,
      stack: err.stack,
    });
    return exitWith('RUNNER_BUG', { reason: err.message });
  } finally {
    teardown();
  }

  function exitWith(code, payload) {
    const sFilePath = autoStateFile(projectRoot);
    try {
      const cur = stateIO.loadAutoState(sFilePath);
      if (cur.ok) {
        cur.state.phase = 'stopped';
        cur.state.exit = Object.assign({ code, exited_at: new Date().toISOString() }, payload || {});
        stateIO.saveAutoState(sFilePath, cur.state);
      }
    } catch (_) { /* best-effort */ }
    console.log(`[auto-runner] EXIT ${code} ${JSON.stringify(payload || {})}`);
    return code;
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv);
  const projectRoot = path.resolve(args._flags['project'] || process.cwd());
  if (!stateIO.existsFile(autoStateFile(projectRoot))) {
    console.error(`[auto-runner] no auto-state.json at ${autoStateFile(projectRoot)} — run /gmk-auto-start first`);
    process.exit(2);
  }
  const exitCode = await runStateMachine(projectRoot, args);
  // Map symbolic exit codes to OS exit codes
  const map = {
    STOP_BUDGET: 0,
    CONVERGED: 0,
    REQUESTED: 0,
    MORNING: 0,
    RUNNER_BUG: 2,
  };
  process.exit(map[exitCode] !== undefined ? map[exitCode] : 1);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('[auto-runner] uncaught error in main:', err);
    process.exit(2);
  });
}

module.exports = { runStateMachine, parseArgs, buildUnitPrompt, parseUnitResponse };
