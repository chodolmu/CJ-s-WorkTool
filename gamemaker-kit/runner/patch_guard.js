// runner/patch_guard.js — same-milestone 5-gate Phase 1 patch verifier.
//
// Called by auto-runner.js VERIFY phase, *after* claude -p produced a patch
// AND the patch was applied to the working tree on the `auto-night-<date>`
// branch. The guard's job is to decide "keep this commit" vs "git revert it
// immediately." It NEVER modifies the patch — only accepts or rejects.
//
// 5 gates, evaluated in order. First FAIL short-circuits the rest (cheap
// gates first so we don't run a 200-game regression on a 400-line diff that
// was going to be rejected for size anyway).
//
//   Gate 1  diff-size         ≤ 80 lines added+removed (ignore pure-whitespace)
//   Gate 2  structural-lint   scripts/check-plugin-meta.sh exit 0
//   Gate 3  determinism       two seed=0 runs deep-equal excluding duration_ms
//   Gate 4  same-milestone regression
//                              200-run trial, compare to baseline-locked.json
//                              (Phase 1: NOT cross-milestone — that's Phase 2)
//   Gate 5  auto-revert on FAIL
//                              if any 1-4 failed → `git revert HEAD --no-edit`
//                              so history shows the attempt + the rollback
//
// Returns:
//   { accepted: true,  gate_pass: [...], gate_fail: [],   patch_sha: <sha> }
//   { accepted: false, gate_pass: [...], gate_fail: [{gate, reason, details}],
//     reverted: true, revert_sha: <sha> }

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const DIFF_LINE_CAP = 80; // Plan §"4 함정" #1
const DETERMINISM_IGNORED_FIELDS = new Set(['duration_ms']);

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function gitHead(projectRoot) {
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }).trim();
}

function gitShow(projectRoot, sha, format) {
  return execFileSync('git', ['show', '--no-patch', `--format=${format}`, sha], {
    cwd: projectRoot, encoding: 'utf8',
  }).trim();
}

// Lines added + removed in the patch, excluding whitespace-only lines and
// excluding the diff header (---/+++/@@). The 80-line cap is per Plan §"4
// 함정" #1: "diff 80줄 cap". Pure-whitespace lines get a pass so that an
// indentation re-flow isn't counted against the budget.
function diffLineCount(projectRoot, sha) {
  const raw = execFileSync(
    'git', ['show', '--unified=0', '--no-color', sha + '^!'],
    { cwd: projectRoot, encoding: 'utf8' }
  );
  let n = 0;
  for (const line of raw.split('\n')) {
    if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('@@')) continue;
    if (line.startsWith('+') || line.startsWith('-')) {
      const body = line.slice(1);
      if (body.trim().length === 0) continue;
      n++;
    }
  }
  return n;
}

// ---------------------------------------------------------------------------
// Gate 1 — diff size
// ---------------------------------------------------------------------------

function gateDiffSize(projectRoot, sha) {
  const n = diffLineCount(projectRoot, sha);
  if (n > DIFF_LINE_CAP) {
    return {
      gate: 'diff-size',
      pass: false,
      reason: `diff has ${n} significant lines (cap ${DIFF_LINE_CAP})`,
      details: { lines: n, cap: DIFF_LINE_CAP },
    };
  }
  return { gate: 'diff-size', pass: true, details: { lines: n } };
}

// ---------------------------------------------------------------------------
// Gate 2 — scripts/check-plugin-meta.sh structural linter
// `projectRoot` here is the user's project (e.g. gmk-dogfood-merge3), but
// check-plugin-meta.sh lives in the kit (Tool/gamemaker-kit/scripts/). The
// runner passes the kit root in `kitRoot` so the guard runs the linter from
// the right CWD.
// ---------------------------------------------------------------------------

function gateStructuralLint(kitRoot) {
  const scriptPath = path.join(kitRoot, 'scripts', 'check-plugin-meta.sh');
  if (!fs.existsSync(scriptPath)) {
    return {
      gate: 'structural-lint',
      pass: false,
      reason: 'check-plugin-meta.sh not found at expected path',
      details: { path: scriptPath },
    };
  }
  const res = spawnSync('bash', [scriptPath], { cwd: kitRoot, encoding: 'utf8' });
  if (res.error) {
    return {
      gate: 'structural-lint',
      pass: false,
      reason: `failed to invoke bash: ${res.error.message}`,
      details: { code: res.status },
    };
  }
  if (res.status !== 0) {
    return {
      gate: 'structural-lint',
      pass: false,
      reason: `check-plugin-meta.sh exit ${res.status}`,
      details: {
        code: res.status,
        stdout_tail: tail(res.stdout, 2000),
        stderr_tail: tail(res.stderr, 1000),
      },
    };
  }
  return { gate: 'structural-lint', pass: true };
}

// ---------------------------------------------------------------------------
// Gate 3 — determinism re-check on the patched prototype.
//
// Two seed=0 runs through the bot hook should produce deep-equal summaries
// (excluding duration_ms — that's wall-clock per _bot_hook_lib.js §190-194 +
// gmk-prototype-rules §5 row 4).
//
// The runner script is provided by the caller as `playwrightRunOnce`:
//   async (prototypeHtmlPath, seed) => summaryObject
// We don't re-implement Playwright here; we just compare two summaries.
// ---------------------------------------------------------------------------

async function gateDeterminism(prototypeHtmlPath, playwrightRunOnce) {
  let s1, s2;
  try {
    s1 = await playwrightRunOnce(prototypeHtmlPath, 0);
    s2 = await playwrightRunOnce(prototypeHtmlPath, 0);
  } catch (err) {
    return {
      gate: 'determinism',
      pass: false,
      reason: `determinism probe threw: ${err.message}`,
      details: { error: err.message.slice(0, 500) },
    };
  }
  const diff = summaryDiff(s1, s2);
  if (diff.length === 0) {
    return { gate: 'determinism', pass: true };
  }
  return {
    gate: 'determinism',
    pass: false,
    reason: `same-seed runs diverged on field(s): ${diff.join(', ')}`,
    details: { diverging_fields: diff, run1: s1, run2: s2 },
    kind: 'determinism-mismatch', // for incident_classifier
  };
}

// Compare two summary objects (the output of __gmk_botHook__.summary()).
// Returns the list of differing field paths, excluding DETERMINISM_IGNORED_FIELDS.
function summaryDiff(a, b) {
  const out = [];
  walk('', a, b, out);
  return out.filter((p) => {
    // exclude wall-clock-only fields anywhere in the path
    for (const seg of p.split('.')) {
      if (DETERMINISM_IGNORED_FIELDS.has(seg)) return false;
    }
    return true;
  });
}

function walk(prefix, a, b, out) {
  // primitive equality
  if (a === b) return;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    out.push(prefix || '(root)');
    return;
  }
  // array
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      out.push(prefix);
      return;
    }
    for (let i = 0; i < a.length; i++) {
      walk(prefix + '[' + i + ']', a[i], b[i], out);
    }
    return;
  }
  // object
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    walk(prefix ? prefix + '.' + k : k, a[k], b[k], out);
  }
}

// ---------------------------------------------------------------------------
// Gate 4 — same-milestone regression.
//
// Phase 1 scope: rerun gmk-validate's 200-game persona-mix trial on the
// patched prototype and compare against the milestone's *baseline-locked*
// trial. Phase 2 will add a `seed_pool` rotation and cross-milestone replay.
//
// `runValidate` is a caller-provided async function:
//   async (prototypeHtmlPath, opts) =>
//     { metrics, by_persona, hypothesis_rows, verdict }
// — i.e. it returns a shape that matches gmk-validate's `validation` block.
//
// `baseline` is the previously-PASS trial result (read from
// .gamemaker-kit/validations/<m>/baseline-locked.json by the runner).
//
// Decision rule (Phase 1): reject if the patched verdict is anything other
// than PASS, OR if any baseline hypothesis row that was PASS is now FAIL.
// "Improved" metrics are *not* enough — we require non-regression on what
// was already locked in. Metric-hack defence (Plan §"4 함정" #2) lands in
// Phase 2 with the baseline-locked replay + hidden seed pool.
// ---------------------------------------------------------------------------

async function gateRegression(prototypeHtmlPath, baseline, runValidate) {
  if (!baseline || !baseline.metrics) {
    return {
      gate: 'regression',
      pass: false,
      reason: 'no baseline-locked.json — auto-mode refuses to validate a milestone with no prior PASS baseline',
      details: { has_baseline: false },
    };
  }
  let trial;
  try {
    trial = await runValidate(prototypeHtmlPath, { runs: 200, policy: 'persona-mix' });
  } catch (err) {
    return {
      gate: 'regression',
      pass: false,
      reason: `regression trial threw: ${err.message}`,
      details: { error: err.message.slice(0, 500) },
    };
  }
  if (trial.verdict !== 'PASS') {
    return {
      gate: 'regression',
      pass: false,
      reason: `patched trial verdict = ${trial.verdict} (need PASS)`,
      details: { verdict: trial.verdict, trial_summary: summarizeTrial(trial) },
    };
  }
  const regressedRows = [];
  const baselineRows = baseline.hypothesis_rows || [];
  const trialRows = trial.hypothesis_rows || [];
  for (const br of baselineRows) {
    if (!br.passed) continue; // only care about rows that USED to pass
    const tr = trialRows.find((r) => r.metric === br.metric);
    if (!tr || tr.passed === false) {
      regressedRows.push({
        metric: br.metric,
        was: br.actual_value,
        now: tr ? tr.actual_value : null,
        target: br.target,
      });
    }
  }
  if (regressedRows.length > 0) {
    return {
      gate: 'regression',
      pass: false,
      reason: `${regressedRows.length} baseline-PASS row(s) regressed`,
      details: { regressed_rows: regressedRows, trial_summary: summarizeTrial(trial) },
    };
  }
  return {
    gate: 'regression',
    pass: true,
    details: { trial_summary: summarizeTrial(trial) },
  };
}

function summarizeTrial(trial) {
  if (!trial || !trial.metrics) return null;
  const m = trial.metrics;
  return {
    verdict: trial.verdict,
    clear_rate: m.clear_rate,
    crash_rate: m.crash_rate,
    dominant_strategy_ratio: m.dominant_strategy_ratio,
    action_entropy: m.action_entropy,
    state_coverage: m.state_coverage,
  };
}

// ---------------------------------------------------------------------------
// Gate 5 — auto-revert on any prior gate FAIL.
//
// Per Plan key decisions table: "`git revert` (not reset) for auto-rollback
// (history 보존)". We want the morning report to *see* the attempt and the
// rollback — silently resetting away the commit hides whether the runner
// was thrashing.
// ---------------------------------------------------------------------------

function gateAutoRevert(projectRoot, patchSha, gateFails) {
  const reason = gateFails.map((g) => `${g.gate}: ${g.reason}`).join(' | ');
  const message = `auto-revert: patch ${patchSha.slice(0, 8)} rejected by patch_guard

Failed gates:
${gateFails.map((g) => `  - ${g.gate}: ${g.reason}`).join('\n')}
`;
  try {
    execFileSync('git', ['revert', '--no-edit', patchSha], {
      cwd: projectRoot, encoding: 'utf8',
    });
    // overwrite the auto-revert message so the morning report has structured
    // context instead of git's default
    execFileSync('git', ['commit', '--amend', '-m', message], {
      cwd: projectRoot, encoding: 'utf8',
    });
    const revertSha = gitHead(projectRoot);
    return { pass: true, revert_sha: revertSha };
  } catch (err) {
    // If revert itself failed (e.g. dirty tree), this is a runner-bug. The
    // caller should surface it via incident_classifier with source: 'runner'.
    return {
      pass: false,
      reason: `git revert failed: ${err.message.slice(0, 300)}`,
      classifier_hint: { source: 'runner', message: err.message },
    };
  }
}

// ---------------------------------------------------------------------------
// orchestrator
// ---------------------------------------------------------------------------

async function evaluatePatch(opts) {
  const {
    projectRoot,
    kitRoot,
    patchSha,
    prototypeHtmlPath,
    baseline,
    playwrightRunOnce, // (path, seed) -> summary
    runValidate,       // (path, opts) -> { metrics, ... }
  } = opts;

  const gate_pass = [];
  const gate_fail = [];

  function record(result) {
    if (result.pass) gate_pass.push(result);
    else gate_fail.push(result);
    return result.pass;
  }

  // Cheap first.
  if (!record(gateDiffSize(projectRoot, patchSha))) return finalize();
  if (!record(gateStructuralLint(kitRoot))) return finalize();
  if (!record(await gateDeterminism(prototypeHtmlPath, playwrightRunOnce))) return finalize();
  if (!record(await gateRegression(prototypeHtmlPath, baseline, runValidate))) return finalize();

  return {
    accepted: true,
    gate_pass,
    gate_fail: [],
    patch_sha: patchSha,
  };

  function finalize() {
    const rv = gateAutoRevert(projectRoot, patchSha, gate_fail);
    return {
      accepted: false,
      gate_pass,
      gate_fail,
      patch_sha: patchSha,
      reverted: rv.pass,
      revert_sha: rv.revert_sha || null,
      revert_failure: rv.pass ? null : rv,
    };
  }
}

// ---------------------------------------------------------------------------
// utils
// ---------------------------------------------------------------------------

function tail(s, n) {
  if (!s) return '';
  return s.length > n ? '...' + s.slice(-n) : s;
}

module.exports = {
  DIFF_LINE_CAP,
  DETERMINISM_IGNORED_FIELDS,
  evaluatePatch,
  // exported for testing
  gateDiffSize,
  gateStructuralLint,
  gateDeterminism,
  gateRegression,
  gateAutoRevert,
  summaryDiff,
};
