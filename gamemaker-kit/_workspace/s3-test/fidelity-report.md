# S3 dogfood — merge3 M1 fidelity-report

**Date**: 2026-05-30
**Module**: M1 (Match-3 core board) from `_workspace/s1-test/genre-decisions.json` (project `merge3-dogfood`, status=approved)
**Build**: `_workspace/s3-test/prototypes/m1-match3-core.html`
**Skill exercised**: `gmk-module-build` (Layer 2, reference-clone fidelity gate) — dogfood via D7 path-substitution (no SKILL edit; the build targets `_workspace/s3-test/` instead of a real project's `.gamemaker-kit/`).
**Purpose**: prove the fidelity gate *works* (concept S3 quit signal: "module이 playable 아니면 STOP" + audit #7 conflict-resolution validated end-to-end). NOT to force a PASS.

---

## VERDICT: **FAIL (correct signal)** — fidelity gate fired and caught a real miss

The gate works. It measured both numeric conventions and correctly flagged that M1 does not yet satisfy C2 (near-miss). A green verdict here would have meant the gate was blind; a red verdict on a known-untuned build is the gate doing its job. This is the dogfood passing — the *gate* passed, the *build* is told what to fix.

---

## Numeric conventions (machine-gated, bot trial)

Bot: deterministic policy (cycle through legalActions), 30 seeds, headless via `_bot_hook_lib.js`. Determinism check (prototype-rules §5): two runs seed=0 deep-equal excluding `duration_ms` → **PASS**.

| Conv | Acceptance | Measured (`collectSummary().custom`) | Verdict | Source strength |
|------|-----------|--------------------------------------|---------|-----------------|
| **C9** | `late_level_moves` range [12,18] | `15` | ✅ **PASS** | `verified: true` (gamigion Homescapes) |
| **C2** | `loss_margin_moves` <= 2 | losses had margins {41, 2, 19, 5}; only 1/4 ≤ 2 | ❌ **FAIL** | `verified: true` (naavik Royal Match) |

**Why C2 failed (real fidelity miss):** the level's TARGET (700) is low relative to the bot's play strength → 26/30 wins (over-easy), and the 4 losses were unlucky boards that lost *big*, not by-one. C2 ("near-miss engineering — give ~exactly the average moves so the player wins-on-last or loses-by-one") requires the level to be tuned so losses cluster at margin ≤ 2. That is a **data-driven balance task** (the same lever as C1 `vanilla_win_rate_pct == 80`), i.e. `economy-balancer` territory — out of scope for this dogfood, which only proves the gate measures and verdicts correctly. The gate surfacing this is exactly the intended behavior.

## Confirm-only conventions (needs_metric — user .html observation, Step 5)

Dogfood note: confirmed by Claude as observation proxy (D7 evidence, not a real user gate).

| Conv | Statement | Observable on screen? |
|------|-----------|----------------------|
| **C7** | Generous, readable power-ups — big-radius/re-targeting; larger pieces with distinct color+shape for fast board reads. | **Y** — `.pu` renders 💎 at 30px (vs 24px base) with a dashed gold border (distinct color+shape); match-4+ spawns it; adjacency triggers a row+col big-radius clear (+50). All three C7 facets (size, distinct shape, big radius) present. |

`confirm: { confirmed: true, per_convention: { C7: true } }`

---

## Weak-source log (detail §10 / m3 — fidelity soundness traceability)

Both numeric gates this run came from **`verified: true` dev-grade sources** (naavik deep-dive, gamigion design insights). No weak/video-only acceptance values were gated in M1. (Contrast: merge3 C5 `lives_max==5` is `verified:true` too, but C5 is not in M1's covers_conventions — it lands in M4.) → No silent weak-source trust in this verdict.

---

## What this dogfood proves (S3 quit signal)

1. **gmk-module-build builds a playable module** from an approved genre-decisions.json entry — board renders, swap-match-clear-cascade works, power-ups spawn, move-limit + target make losing-by-one *reachable* (the level mechanic C2 needs). ✓
2. **The fidelity gate is machine-measurable** — `collectSummary().custom.{loss_margin_moves, late_level_moves}` flows to the wrapped `summary().custom` (the M1/validate seam the evaluator M1 flagged), and gmk-validate's fidelity branch can compare against `acceptance`. ✓
3. **The gate discriminates** — C9 PASS, C2 FAIL on the same build. A gate that can't fail is no gate. ✓
4. **Conflict resolution works end-to-end** (audit #7) — a reference-clone module reached a verdict via *fidelity*, never via a fun-hypothesis. The hypothesis path was never invoked. ✓

## Next (real project, not dogfood)
- Tune M1's TARGET/move-economy toward C2 (near-miss) — `@economy-balancer` against `loss_margin_moves` + `vanilla_win_rate_pct` (C1). Then re-validate. This is the normal post-FAIL loop, not a gate defect.
