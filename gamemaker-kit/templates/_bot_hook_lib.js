// gamemaker-kit — bot hook shared library
// Inlined into every prototype template. Do NOT modify per-prototype.
// The point of this file living separately in templates/ is so /gmk-prototype
// copies it verbatim — no LLM gets a chance to "improve" the LCG or break
// the action API by accident. If the contract changes, change it HERE and
// every template gets the update on next clone.

(function (global) {
  'use strict';

  // ---- Deterministic RNG (LCG) ---------------------------------------------
  // Same seed -> same sequence. Used by both prototype game logic AND the bot.
  // Numerical Recipes constants. Do not change.
  function createRng(seed) {
    let state = (seed >>> 0) || 1; // 0 is degenerate for LCG
    return {
      next() {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state;
      },
      // Float in [0, 1)
      nextFloat() {
        return this.next() / 0x100000000;
      },
      // Int in [0, n)
      nextInt(n) {
        return Math.floor(this.nextFloat() * n);
      },
      // Pick a random element from an array
      pick(arr) {
        return arr[this.nextInt(arr.length)];
      },
      // Re-seed mid-game (rare; usually not needed)
      reseed(s) {
        state = (s >>> 0) || 1;
      },
      get state() { return state; },
    };
  }

  // ---- Hook scaffold --------------------------------------------------------
  // Game-specific code provides callbacks; this returns the standard
  // window.__gmk_botHook__ object.
  //
  // Required callbacks (5):
  //   reset(seed, rng)    — set initial state, accept seed for determinism
  //   isOver()            — return true when run is finished
  //   legalActions()      — return array of action descriptors (any shape)
  //   apply(action)       — mutate state by applying action
  //   collectSummary()    — return { score, custom, ... } base metrics
  //
  // Optional callbacks (4, Wave B — Procedural Personas in /gmk-validate use
  // these if present; absent ones fall back to random / null signals):
  //   stateSignature()        — string. State-coverage metric in gmk-validate.
  //                             Should distinguish states cheaply (e.g.
  //                             JSON.stringify([grid, score])). Don't fake.
  //   riskEstimate(action)    — number 0..1. Survivor persona. Higher = more
  //                             likely to lose. Omit if no honest signal.
  //   progressEstimate()      — number 0..1. Runner persona. 0=start, 1=goal.
  //                             Omit if "progress" is meaningless for the game.
  //   noveltyScore(action)    — number 0..1. Explorer persona. Higher = state
  //                             this action leads to is "less seen." Omit if
  //                             you can't measure novelty cheaply.
  //
  // Behavior when an optional callback is missing:
  //   - The hook exposes a corresponding query (hasPersonaSignal, etc.) so
  //     /gmk-validate can detect absence and fall back to uniform-random
  //     action choice for that persona. The validator records `fallback_used`
  //     in the trial result so suspicious-run analysis isn't blamed on the
  //     persona being toothless.
  //   - Implementing fake signals (e.g. riskEstimate() = 0.5 always) is worse
  //     than omitting: it pollutes the Survivor persona with noise that looks
  //     like signal. Rule of thumb in gmk-prototype-rules §4.
  //
  // Other optional spec fields:
  //   maxActions          — override default 5000
  //   maxDurationMs       — override default 600000 (sim time, not wall)
  //
  // API version (`_gmkApiVersion`) stays at 1 — these additions are purely
  // additive. v0.1 prototypes with only the five required callbacks remain
  // fully compatible.
  //
  // The hook wraps these with crash containment, action counting, bounded-runs
  // safety, and the standard summary surface.
  function makeHook(spec) {
    let rng = createRng(0);
    let actionsTaken = 0;
    let crashed = false;
    let crashReason = null;
    let startedAt = 0;
    let stuck = false;
    const maxActions = spec.maxActions || 5000;
    const maxDurationMs = spec.maxDurationMs || 600000;

    const hasStateSignature    = typeof spec.stateSignature    === 'function';
    const hasRiskEstimate      = typeof spec.riskEstimate      === 'function';
    const hasProgressEstimate  = typeof spec.progressEstimate  === 'function';
    const hasNoveltyScore      = typeof spec.noveltyScore      === 'function';

    function safeNum(v) {
      const n = Number(v);
      if (!Number.isFinite(n)) return null;
      if (n < 0) return 0;
      if (n > 1) return 1;
      return n;
    }

    return {
      // ---- lifecycle ----
      startGame(seed = 0) {
        try {
          rng = createRng(seed);
          actionsTaken = 0;
          crashed = false;
          crashReason = null;
          stuck = false;
          startedAt = (typeof performance !== 'undefined' ? performance.now() : Date.now());
          spec.reset(seed, rng);
        } catch (err) {
          crashed = true;
          crashReason = 'startGame: ' + String(err).slice(0, 200);
        }
      },

      isOver() {
        if (crashed) return true;
        if (stuck) return true;
        if (actionsTaken >= maxActions) return true;
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        if (now - startedAt > maxDurationMs) return true;
        try {
          return !!spec.isOver();
        } catch (err) {
          crashed = true;
          crashReason = 'isOver: ' + String(err).slice(0, 200);
          return true;
        }
      },

      // ---- action interface ----
      legalActions() {
        if (crashed || stuck) return [];
        try {
          const actions = spec.legalActions() || [];
          if (actions.length === 0 && !spec.isOver()) {
            // Game logic dead-ended without ending the run. Mark stuck.
            stuck = true;
          }
          return actions;
        } catch (err) {
          crashed = true;
          crashReason = 'legalActions: ' + String(err).slice(0, 200);
          return [];
        }
      },

      act(action) {
        if (crashed || stuck) return;
        try {
          spec.apply(action);
          actionsTaken++;
        } catch (err) {
          crashed = true;
          crashReason = 'act: ' + String(err).slice(0, 200);
        }
      },

      // ---- measurement ----
      summary() {
        let base = { score: null, build_used: null, custom: {} };
        if (!crashed) {
          try {
            base = Object.assign(base, spec.collectSummary() || {});
          } catch (err) {
            crashed = true;
            crashReason = 'collectSummary: ' + String(err).slice(0, 200);
          }
        }
        const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        // NOTE: `duration_ms` is intentionally wall-clock-based — it measures
        // trial-level reporting (how long the bot took to play out the run on
        // *this machine*), not gameplay sim time. Because it's wall-clock,
        // it varies across same-seed runs.
        //
        // `gmk-prototype-rules` §5 row 4 (determinism check) and `gmk-validate`
        // preconditions (iv) both exclude `duration_ms` from the deep-equal
        // comparison for this reason. All OTHER summary fields — score,
        // actions_taken, crashed, stuck, build_used, custom.* — must be
        // identical across same-seed runs, or the prototype is non-deterministic.
        return {
          score: base.score,
          duration_ms: Math.round(now - startedAt),
          actions_taken: actionsTaken,
          crashed,
          crashed_reason: crashReason,
          stuck,
          build_used: base.build_used,
          custom: base.custom || {},
        };
      },

      // ---- persona signals (Wave B, optional) ----
      // Each returns null if the prototype omitted the callback. /gmk-validate
      // reads these per legal action and falls back to uniform-random when
      // the answer is null. Errors thrown by the user callback do NOT crash
      // the run — they degrade to null and are logged at trial finish.
      stateSignature() {
        if (!hasStateSignature || crashed || stuck) return null;
        try {
          const s = spec.stateSignature();
          return typeof s === 'string' ? s : (s == null ? null : String(s));
        } catch (err) {
          return null;
        }
      },
      riskEstimate(action) {
        if (!hasRiskEstimate || crashed || stuck) return null;
        try {
          return safeNum(spec.riskEstimate(action));
        } catch (err) {
          return null;
        }
      },
      progressEstimate() {
        if (!hasProgressEstimate || crashed || stuck) return null;
        try {
          return safeNum(spec.progressEstimate());
        } catch (err) {
          return null;
        }
      },
      noveltyScore(action) {
        if (!hasNoveltyScore || crashed || stuck) return null;
        try {
          return safeNum(spec.noveltyScore(action));
        } catch (err) {
          return null;
        }
      },

      // ---- introspection (for /gmk-validate preflight) ----
      _gmkApiVersion: 1,
      _gmkPersonaCapabilities: {
        stateSignature:    hasStateSignature,
        riskEstimate:      hasRiskEstimate,
        progressEstimate:  hasProgressEstimate,
        noveltyScore:      hasNoveltyScore,
      },
    };
  }

  // Expose under the global the kit expects.
  global.__gmk = {
    createRng,
    makeHook,
  };
})(typeof window !== 'undefined' ? window : globalThis);
