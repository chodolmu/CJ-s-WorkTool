// runner/incident_classifier.js — classify a raw failure into one of the
// categories from Plan §4.4. Pure function: takes a structured failure
// description, returns a verdict { category, retryable, severity, action }.
// No I/O. Caller (auto-runner.js) writes the result via state_io.appendIncident.
//
// Categories (Plan §4.4 + addendum):
//   playwright-flake       — transient browser failure        retry once
//   determinism-break      — same seed, different outcome     pause milestone
//   game-crash             — prototype itself crashed         normal gmk-validate path
//   agent-edit-error       — claude -p returned bad JSON      retry once with schema error
//   budget-exhausted       — budget cap hit                   clean exit
//   runner-bug             — exception in runner code         panic checkpoint, exit 2
//   claude-api-transient   — 429/5xx (handoff edge case)      retry once
//   unknown-investigate    — couldn't classify                pause this milestone only
//
// `severity` is for the morning report sort key — `hard` failures always show
// above `soft` ones. `action` is what the runner is *expected* to do next; the
// runner is not bound to it, but logging the intended action means the morning
// report can show "intended X, did Y" if the two diverged.

'use strict';

const CATEGORIES = {
  'playwright-flake':     { retryable: true,  severity: 'soft', action: 'retry-once' },
  'determinism-break':    { retryable: false, severity: 'hard', action: 'pause-milestone' },
  'game-crash':           { retryable: false, severity: 'soft', action: 'route-to-gmk-validate' },
  'agent-edit-error':     { retryable: true,  severity: 'soft', action: 'retry-with-schema-hint' },
  'budget-exhausted':     { retryable: false, severity: 'hard', action: 'clean-exit' },
  'runner-bug':           { retryable: false, severity: 'hard', action: 'panic-checkpoint-exit-2' },
  'claude-api-transient': { retryable: true,  severity: 'soft', action: 'retry-once' },
  'unknown-investigate':  { retryable: false, severity: 'hard', action: 'pause-milestone' },
};

// `failure` is whatever the calling state produced — at minimum:
//   { source: 'playwright' | 'claude' | 'patch-guard' | 'runner', ... }
// Optional additional fields the classifier looks at:
//   error_kind, exit_code, message, summary_diff, http_status, ...
function classify(failure) {
  if (!failure || typeof failure !== 'object') {
    return wrap('runner-bug', {
      reason: 'classifier received non-object failure',
      original: String(failure),
    });
  }

  const src = failure.source;
  const msg = (failure.message || '').toString();
  const exit = failure.exit_code;

  // --- runner self-bug (highest priority — never mis-attribute) -----------
  if (src === 'runner') {
    return wrap('runner-bug', failure);
  }

  // --- determinism-break (structural, not message-based) ------------------
  // patch-guard reports `summary_diff` with the differing fields (excluding
  // duration_ms). If that's populated, it IS a determinism break — message
  // text doesn't matter.
  if (src === 'patch-guard' && failure.kind === 'determinism-mismatch') {
    return wrap('determinism-break', failure);
  }

  // --- budget exhaustion --------------------------------------------------
  if (failure.kind === 'budget-exhausted' || /budget.*exceed|max-budget-usd/i.test(msg)) {
    return wrap('budget-exhausted', failure);
  }

  // --- Playwright signatures ----------------------------------------------
  if (src === 'playwright') {
    // Per Plan §4.4: "Playwright launch error, navigation timeout >30s"
    if (
      /launch|chromium.*fail|browser.*close/i.test(msg) ||
      /timeout.*30\d{3}|navigation.*timeout/i.test(msg) ||
      failure.error_kind === 'browser-launch' ||
      failure.error_kind === 'navigation-timeout'
    ) {
      return wrap('playwright-flake', failure);
    }
    // A `crashed: true` in the prototype summary is NOT a Playwright flake —
    // it's a game crash routed through Playwright. Match the explicit signal.
    if (failure.kind === 'game-crash' || failure.summary_crashed === true) {
      return wrap('game-crash', failure);
    }
  }

  // --- explicit game crash (any source) -----------------------------------
  if (failure.kind === 'game-crash' || failure.summary_crashed === true) {
    return wrap('game-crash', failure);
  }

  // --- claude -p errors ---------------------------------------------------
  if (src === 'claude') {
    const httpStatus = Number(failure.http_status);
    if (httpStatus === 429 || (httpStatus >= 500 && httpStatus < 600)) {
      return wrap('claude-api-transient', failure);
    }
    if (
      exit !== 0 && exit !== undefined ||
      failure.kind === 'json-parse-error' ||
      failure.kind === 'schema-mismatch' ||
      /json.*parse|schema|expected.*object/i.test(msg)
    ) {
      return wrap('agent-edit-error', failure);
    }
  }

  // --- fallback -----------------------------------------------------------
  return wrap('unknown-investigate', failure);
}

function wrap(category, failure) {
  const meta = CATEGORIES[category];
  return Object.assign({
    category,
    retryable: meta.retryable,
    severity: meta.severity,
    action: meta.action,
  }, {
    source: failure.source || null,
    message: (failure.message || '').toString().slice(0, 500),
    raw: failure,
  });
}

module.exports = {
  CATEGORIES,
  classify,
};
