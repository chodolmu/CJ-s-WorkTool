# S5 dogfood — merge3 M1 full play-through (user real-play)

**Date**: 2026-05-30
**Concept**: S5 = merge3 M1 full dogfood — the **user plays the build themselves** (concept P3's final loop: the kit must not silently fill the user's mental model; a human actually plays).
**Target**: `_workspace/s3-test/prototypes/m1-match3-core.html`
**Player**: the user (real play, ~5-10 min). NOT a Claude proxy — this is the one dogfood step concept reserves for the human.

---

## VERDICT: **PASS** — mechanism fidelity confirmed by real play; juice gap surfaced (the signal only a human gives)

The user played M1 directly and judged:
- **Mechanism fidelity = OK.** Swap → match → clear → power-up → move-limit all work "Royal Match처럼" (like the reference). The match-3 core loop is faithful.
- **Juice/연출 = empty, feels 심심 (flat).** No hit-stop, particles, screen-shake, match-feedback animation. The user noted this is *intentionally* missing (wireframe-grade module) and "굳이 고칠 필요 없다" for a dogfood, but it does make the build feel flat.

S5 PASS = the user attests the **mechanism** clones the reference. The juice gap is recorded as a separate axis (not a fidelity miss).

---

## Why the juice gap is the headline learning (not a defect)

`gmk-module-build` produces **wireframe-grade** HTML by design (same rule as gmk-prototype: test the mechanism, don't art-direct). Juice is a separate kit concern (`feel-engineer` agent territory), invoked when building a *real* game, not during a fidelity dogfood. So "심심하다" is the **expected, correct** state for a dogfood module.

But the signal is valuable: **a real human playing surfaced something neither the bot nor the visual confirm could.**

## Three-gate convergence (the S3→S4→S5 arc)

| Gate | What it caught | How |
|------|----------------|-----|
| Bot fidelity (S3) | C9 PASS / **C2 near-miss FAIL** | numeric (loss_margin_moves) |
| Visual confirm (S4) | C2 = N on screen | human observation, per-convention |
| **User real-play (S5)** | mechanism OK + **juice absent → flat** | human play, whole-feel |

Each gate caught something the others structurally couldn't:
- The **bot** quantified the near-miss miss (C2) — a number.
- The **visual confirm** let the human verify that miss is *visible* — per-convention observation.
- The **real-play** surfaced "심심하다 (flat / juice-empty)" — a *whole-experience* signal that is invisible to a per-convention checklist and to a bot metric. This is exactly the gap concept P3 reserved the human-play step to catch.

## S5 learning (kit-level)
- **kit auto-validates *mechanism fidelity*; it does NOT validate *juice/completeness*.** A reference-clone module can clear every convention gate and still feel flat to a human, because juice lives outside the convention contract (it's `feel-engineer`'s axis, invoked for real builds, not dogfood modules).
- **The human-play step (S5) is not redundant with bot + visual confirm.** It catches whole-experience signals (flatness, pacing feel) that neither a per-convention checklist nor a numeric bot metric can express. This validates concept P3's insistence on a real user play.
- For a *real* game (not dogfood): after fidelity PASS, the next axis is `@feel-engineer` for juice (hit-stop / particles / shake / match-feedback) before the build feels shippable. Out of scope for this dogfood.

## Scope note (honest)
This is a dogfood module (kit-validation merge3 M1), not a game for release. Per the user, no fix is warranted — the juice gap is expected for a wireframe-grade fidelity test. S5's job was to prove the user-play loop works and surfaces human-only signals; it did.
