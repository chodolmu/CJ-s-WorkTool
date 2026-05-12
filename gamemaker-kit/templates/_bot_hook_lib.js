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
  // Required callbacks:
  //   reset(seed, rng)    — set initial state, accept seed for determinism
  //   isOver()            — return true when run is finished
  //   legalActions()      — return array of action descriptors (any shape)
  //   apply(action)       — mutate state by applying action
  //   collectSummary()    — return { score, custom, ... } base metrics
  //
  // Optional:
  //   maxActions          — override default 5000
  //   maxDurationMs       — override default 600000 (sim time, not wall)
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

      // ---- introspection (for /gmk-validate preflight) ----
      _gmkApiVersion: 1,
    };
  }

  // Expose under the global the kit expects.
  global.__gmk = {
    createRng,
    makeHook,
  };
})(typeof window !== 'undefined' ? window : globalThis);
