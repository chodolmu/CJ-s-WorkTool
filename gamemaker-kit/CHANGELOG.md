# Changelog

All notable changes to `gamemaker-kit` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [SemVer](https://semver.org/).

---

## [0.4.0] — 2026-05-15

v0.3 closed the structural skeleton (agent wiring + dev-complete endpoint). v0.4 is the **quality-of-life** release on top: orphan sub-flags get definitions, the 27 precondition-handling skills converge on one pattern, the agent routing block standardizes its output format, and the schema sheds 9 trace fields that were write-only since v0.2. **No new SKILLs, no new agents.** Backward-compatible reads (v0.3 files validate as-is); breaking writes (v0.4 skills no longer emit the 9 deprecated fields).

This release was driven by a **3-view audit** (cold-read / adversarial / schema-first). No dogfood — v0.4 confirms gmk's audit-only stance for backlog derivation.

### Added

**`gmk-prototype-rules` — three new rules (skill-wide patterns):**
- **Rule 13 — Milestone-id resolution + empty/partial state.** Standardizes how 27 skills respond to malformed input: `.gamemaker-kit/` missing, `pillars.json` missing or skipped, `milestones.json` empty, `<milestone-id>` not found. Resolution table + refuse-message language policy + hand-edit policy.
- **Rule 14 — Refuse-chain cycle guard.** Forces a skill's refuse-message that recommends "Run /gmk-X first" to verify the target skill's preconditions are satisfied. Closes a class of dead-end flows (e.g., self-test → validate → self-test on shader milestones).
- **Rule 15 — Agent routing block (output format).** Fixes the on-screen format for routing recommendations to `systems-designer` / `feel-engineer` / `economy-balancer` / `playtest-analyst`. 8 routing skills now emit the same shape.

**Sub-flags sections — 7 skills got formal flag catalogs:**
- `gmk-validate` — 12 flags including `--rebaseline` (formerly orphaned in `gmk-regression`) and `--accept-regression` (same).
- `gmk-port` — 8 flags including `--force-rebuild` (now formally an alias for `--stage 1`) and `--to <engine>` (formerly referenced by `gmk-self-test` without definition).
- `gmk-self-test`, `gmk-kill-milestone`, `gmk-narrative`, `gmk-ux-flow`, `gmk-dev-complete`, `gmk-prototype` — each got a Sub-flags table inventorying every recognized `--flag`.

**Sanity script:**
- `scripts/check-plugin-meta.sh` — verifies version field consistency between `plugin.json` / `marketplace.json` and a sanity floor on `skills/` count before tagging a release.

**Schema example coverage:**
- `_workspace/examples/pillars-example.json` NEW — pillars.json schema reference. Previously only milestones.json had an example.

**`kit_version` field (optional):**
- v0.4 writes `kit_version: "0.4.0"` at the top of `pillars.json` and `milestones.json`. v0.3 files without it are treated as `"0.3.0"`. v0.5 may begin requiring this field.

**Persistence of `--accept-warnings`:**
- `gmk-dev-complete --accept-warnings` now writes `warnings_acknowledged_at` per warned gate. Subsequent runs only re-print warnings that are *new* since the acknowledgment. Pre-v0.4 was per-invocation only.

**Lock file robustness (`gmk-loop`):**
- `.gamemaker-kit/.loop.lock` now records `pid` + `host` in addition to `started_at`. Stale locks (> 60 min) auto-clear; locks with dead PIDs auto-clear; user no longer needs to delete the lock file manually for the common case.

**Save-migrate ↔ merge-gate wiring (v0.3 J carry-over):**
- `gmk-merge-gate` Step 5.5 — warning-only check that a milestone touching persistent files has a current `save-migration.md`. No new SKILL; existing wiring just got the missing edge.

**Dashboard archive:**
- `gmk-status --archive` snapshots the current dashboard to `_workspace/dashboard-archive/dashboard-{YYYY-MM-DD-HHMM}.md` before regenerating.

### Changed

**Deprecated fields (9 — write-only since v0.2, read by nobody):**
- `hypothesis.trials[]`, `validation_history[]`, `re_validation_history[]`, `kill_history[]`, `kill_category`, `kill_followup`, `validation.guardrails`, `self_test.coded_themes`, `self_test.sessions[]` body.
- v0.4 skills no longer write these. v0.3 files containing them validate; skills ignore them. **No data loss** — fields are not auto-stripped. The git commit history of `milestones.json` is the canonical trace for kill/revive/regression/re-port cycles.
- `self_test` now stores only `latest_verdict`, `latest_session_path`, `latest_session_at`, `pillar_violations`, `verdict_reason`, `coded_at`. Full session history lives on disk at `.gamemaker-kit/self-tests/<m>/session-{date}.md` (immutable) + `coded.md` (latest roll-up).

**`structure.md` (canonical schema reference):**
- Added: path convention (relative-to-project-root), `validation.policy` enum, `merge_gate.touched_files` format, `validation.metrics.custom` semantics, port-checklist frontmatter spec, `kit_version` semantics, deprecated fields table.
- Added: `_workspace/milestones/<id>/portability-check.md` (was unspecced in v0.3).

**`gmk-portability-check`:**
- Now writes `_workspace/milestones/<id>/portability-check.md`. v0.2's "Wave A reserved" status is resolved — markdown file is the canonical artifact.

**Shader template + `gmk-prototype` shader path messaging:**
- "Wave D stub" language retired. Shader template is **intentionally minimal** by design (not pending completion). `gmk-prototype-rules` Rule 11 is the canonical reference for the shader path; `gmk-validate` returns INCONCLUSIVE by design; `gmk-self-test` is the gate.

**`example.json` fixes:**
- `_kill_reason` (with underscore prefix from v0.2) → `kill_reason` (the actual field name used by skills).
- Example uses v0.4 shape (no deprecated fields) and includes `kit_version`.
- `merge_gate.touched_files` shows a real example value (was empty array).
- `validation.metrics.custom` shows a real example metric (was empty object).

**Retired "future skill" promises:**
- `gmk-task-split` line 143 — "use a dedicated future skill to delete tasks" replaced with "hand-edit milestones.json" (no future SKILL coming).
- `gmk-kill-milestone` line 259 — "future skills will read kill_history" replaced with "git log is the trace" (kill_history is deprecated).

### Sub-flag orphans resolved (`gmk-validate` / `gmk-port` / `gmk-prototype`)

Before v0.4 these flags were referenced by other skills but had no definition. v0.4 defines them:

| Flag | Skill | Previously referenced from |
|---|---|---|
| `--rebaseline` | gmk-validate | gmk-regression |
| `--accept-regression` | gmk-validate | gmk-regression |
| `--skip --reason` | gmk-validate | (new in v0.4) |
| `--force-rebuild` | gmk-port (alias for `--stage 1`) | gmk-port itself + agent diagnosis text |
| `--to <engine>` | gmk-port | gmk-self-test |
| `--no-systems-designer` | gmk-port | gmk-port itself |
| `--regen` | gmk-prototype | gmk-kill-milestone, gmk-shape-advisor |

### Documentation

- 27 skills got a 1-line Rule 13-14 citation at the bottom of their Preconditions section.
- 8 routing skills got a 1-line Rule 15 citation in their agent-routing section.
- v0.4 audit artifacts saved at `_workspace/v0.4-audit-coldread.md`, `v0.4-audit-adversarial.md`, `v0.4-audit-schema.md`, `v0.4-skeleton-audit.md`, `v0.4-backlog.md`.

### Migration notes from v0.3

- v0.3 milestones.json / pillars.json — **no migration required**. v0.4 skills read them identically.
- The 9 deprecated fields remain in v0.3 files until the user manually strips them. v0.4 skills ignore them entirely. Stripping is optional and lossless (the data is recoverable from disk-side trial files or git history).
- v0.4 skills *start writing* `kit_version`. v0.3 files without it are treated as `"0.3.0"`. The first time a v0.4 skill writes to an old file, it adds `kit_version`.
- `--accept-warnings` on `gmk-dev-complete` now persists. Users upgrading from v0.3 will see warnings re-emerge once on first run after upgrade, then stay acknowledged.
- Lock files (`.loop.lock`) gain `pid` + `host` fields. v0.3 lock files (timestamp-only) auto-clear at 60 min as a fallback.

### Non-goals (v0.4 deliberately did not do)

- **No new SKILLs.** v0.3 added one (`gmk-dev-complete`); v0.4 adds zero. All defects fixed via existing-skill edits.
- **No new agents.** 4 specialists are sufficient.
- **No dogfood.** Backlog derivation is audit-only as of v0.3 + v0.4.
- **No 4-axis model changes.** v0.2's time/discipline/validation/integration model stands.
- **No `--autocode` for HTML.** Scaffold-only generation (v0.3 decision) preserved.
- **No shader-full-template expansion.** Minimal is the design.
- **No `kit_version` read-enforcement.** v0.4 only writes the field; v0.5 may begin to require it.
- **No mining SKILL for the deprecated 9 fields.** They go away (decision 1 of v0.4 backlog).

---

## [0.3.0] — 2026-05-14

v0.2 shipped ~28 skills + 4 domain agents — the *forms* were there. v0.3 is a **skeleton-completion** release: a 7-axis audit identified that the agents had no wired entry points from the SKILLs, the project-level "development complete" endpoint promise had no SKILL behind it, and structure.md had drifted 11+ file kinds out of date. v0.3 closes all of that. **No new feature axes, no new agent types, no schema breaking changes.** One new SKILL (`gmk-dev-complete`) and many cross-skill wirings.

This release was driven by audit, not by dogfood. The v0.2 dino-run dogfood findings (11 items) were intentionally deferred to a v0.4 backlog candidates list — they describe behaviors of a specific game, not skeleton holes of the plugin.

### Added

**New SKILL (1)**
- `gmk-dev-complete` NEW — project-level endpoint. Reads `pillars.json` + `milestones.json` and runs 6 structural checks (live milestones, all shipped, every pillar covered by ≥1 shipped milestone, no unresolved merge-gates, no unacknowledged forced overrides, pillars locked). Writes `_workspace/dev-complete-report.md` and prints `DEV_COMPLETE | COMPLETE_WITH_WARNINGS | NOT_COMPLETE`. Read-only on canonical state; no agents invoked. **Past `DEV_COMPLETE`, gamemaker-kit deliberately does nothing further** — release / live-ops / external feedback live outside the plugin per CONCEPT §1.

**Agent wiring (★★★ K)** — the largest defect identified by v0.3 audit. v0.2 declared 4 agents but no SKILL referenced them. v0.3 wires the 4 agents into the SKILL workflow as recommended routing destinations (SKILLs surface the route; user runs `@agent` themselves — never auto-invoked, preserving `max-iteration=1` single-supervisor model):
- `gmk-design-system` → `systems-designer` (≥4 systems / ≥5-state machine / ≥3 couplings)
- `gmk-prototype` → `feel-engineer` (continuous/shader/sensory pillar) + `economy-balancer` (numeric bot rows)
- `gmk-content-plan` → `economy-balancer` (curve has numeric knobs)
- `gmk-validate` → `playtest-analyst` (crash/persona/state-starvation FAIL) + `economy-balancer` (dominant strategy)
- `gmk-self-test` → `feel-engineer` (sensation-word FAIL) + `playtest-analyst` (diffuse FAIL)
- `gmk-regression` → `playtest-analyst` (REGRESSION or drift >25%)
- `gmk-port` Stage 1 → `systems-designer` (non-trivial system spec needed; blocks until spec written)
- `gmk-port` Stage 4 → `playtest-analyst` (FLAG/FAIL metric diff)
- `gmk-port` Stage 6 → `feel-engineer` / `economy-balancer` / `systems-designer` (routed by `--reason` keywords)
- `gmk-loop` dispatch table — surfaces the agent routes downstream SKILLs prepared

Verification: `grep -l systems-designer|feel-engineer|economy-balancer|playtest-analyst skills/` now returns 8 SKILLs (was 2).

**Endpoint wiring (★★★ S)**
- `gmk-port` Stage 6 RE_PASS now suggests `/gmk-dev-complete` if last in-flight milestone
- `gmk-status` dashboard.md adds "Project dev-complete progress" section
- `gmk-status` priority ladder adds case 8 "all shipped → /gmk-dev-complete"
- `gmk-status` "No active milestone" message specialized by reason (shipped / killed / none yet)
- `gmk-loop` shipped-state message references project-level endpoint

**structure.md ground-truth refresh (★★ L+M)**
- 11 new file-kind sections covering SKILL outputs (`design-system.md` / `content-plan.md` / `art-spec.md` / `sound-plan.md` / `ux-flow.md` / `narrative.md` / `refactor-check.md` / `save-migration.md`) and agent outputs (`system-spec.md` / `feel-numbers.md` / `feel-edits.md` / `economy-numbers.md` / `economy-edits.md` / `balance-rationale.md` / `playtest-diagnosis-{date}.md`)
- Plus `dev-complete-report.md`, `regression-report-{date}.md`, `.loop.lock`, `-mocked.html` siblings, engine-side `save-schema.json` location
- CONCEPT.md endpoint definition now references `/gmk-dev-complete` as the structural check

**Call-graph reinforcement (★)**
- `gmk-self-test` Step 1 reads `ux-flow.md` if present and surfaces FTUE checklist (C)
- `gmk-self-test` Step 2 optional FTUE-check field producing `ftue-miss` theme on FAIL
- `gmk-kill-milestone` Step 6 (new) refreshes `_workspace/roadmap.md` on kill or revive (I)
- `gmk-prototype-rules` Rule 11 (new) names per-shape validation path. Shader prototypes have *no* bot gate by design; self-test is the only gate; `dev-complete` accepts `validation.skipped: 'shader shape'` (U)
- `gmk-prototype-rules` Rule 12 (new) clarifies HTML code-generation policy — `/gmk-prototype` produces a scaffold, the user writes the mechanic body. Engine port (`gmk-port` Stage 1) is the place for autonomous code generation, not the prototype skill. (A)

### Changed

- `gmk-port` Stage 1 description: "optional systems-designer agent in Wave D" → wired as default for non-trivial systems
- 8 SKILL files now reference at least one domain agent (was 2)

### Not changed (intentional)

- **No schema changes.** `pillars.json` / `milestones.json` / agent output formats — all v0.2 files validate without modification.
- **No new agent types.** 4 agents from v0.2 are sufficient; the defect was wiring, not coverage.
- **No 4-axis model changes.** v0.2's time/discipline/validation/integration model holds.
- **dogfood-findings-v0.2.md retired** — initially renamed to `v0.4-backlog-candidates.md` during v0.3 work, then deleted entirely on 2026-05-14 post-release. Dogfood-driven backlog is not used; v0.4 will derive its backlog from a fresh audit, not from one game's behavior.

### Migration notes from v0.2

- v0.2 milestones.json / pillars.json / validations / self-tests / port checklists — all read identically. No migration step needed.
- v0.2 prototypes (`prototypes/<name>.html`) — no changes needed.
- v0.2 `_bot_hook_lib.js` — no API changes (still `_gmkApiVersion: 1`, additive).
- Users who previously wondered "what does `@feel-engineer` actually trigger?" — the answer is now in the relevant SKILL's Step N.5 routing block; agents are reachable from the workflow rather than only via direct invocation.

### v0.3 skeleton audit + backlog docs

For the rationale + the audit-driven backlog, see:
- `_workspace/v0.3-skeleton-audit.md` — 7-axis structural audit identifying 18 defects (★★★/★★/★)
- `_workspace/v0.3-backlog.md` — Wave A-E plan derived from audit

---

## [0.2.0] — 2026-05-12

v0.1 was 7 skills around the MVP loop (init → prototype → validate → share → feedback → port → status). v0.2 generalizes that loop into a **4-axis development model** (time · discipline · validation · integration) and expands to **~28 skills + 4 domain agents**, while staying inside the same endpoint: *development completion*. Release, live-ops, and external sharing remain explicitly out of scope.

### Added

**Group A — common / axis infrastructure (4 new, 1 major update, 1 minor update)**
- `gmk-roadmap` NEW — milestone decomposition with priority and dependency graph → `roadmap.md`.
- `gmk-brainstorm` NEW — opt-in 5-stage diverge/converge under the MDA lens.
- `gmk-task-split` NEW — milestone → per-discipline backlog → `kanban.md`.
- `gmk-loop` NEW — minimal dispatcher (Plan → Build → Validate → Integrate), `max-iteration=1`.
- `gmk-status` MAJOR UPDATE — dashboard.md, per-discipline kanban, blocker detection, single next-action recommendation.
- `gmk-init` UPDATE — emits `vision.md`, `pillars.json` schema, `supported_genres_check`.

**Group B — methodology (HTML prototyping rulebook, 6 new)** ★ our ground
- `gmk-prototype-rules` NEW — 300-line guard, `__gmk_botHook__` API spec, hook self-check. Cited by every other prototyping skill.
- `gmk-shape-advisor` NEW — hypothesis → prototype shape decision (grid / continuous / dialogue / shader).
- `gmk-portability-check` NEW — porting-risk catalog (hallucination-likely patterns).
- `gmk-mechanic-merge` NEW — combine two validated prototypes into an integration milestone spec.
- `gmk-kill-milestone` NEW — Cleveland-rule trigger to retire a milestone and restart.
- `gmk-mock-inject` NEW — placeholder asset / dependency injection for cross-discipline unblocking.

**Group C — per-discipline (9 new, 1 update)**
- `gmk-design-system` NEW — system diagram, state machines, coupling, invariants.
- `gmk-content-plan` NEW — content volume + 5 progression curve shapes (flat / stairs / ramp / wave / bell), intensity bumps.
- `gmk-refactor-check` NEW — LOC / branches / nesting / calls-out thresholds, dead code, comment drift; porting-risk verdict (CLEAN / WARN / HIGH RISK).
- `gmk-art-spec` NEW — asset spec, palette lock, style anchors, 4 asset categories (characters / tiles / effects / UI).
- `gmk-art-gen` NEW — `/art` (ComfyUI) wrapper with palette + anchor prompt injection.
- `gmk-sound-plan` NEW — SFX table + 3 BGM types (none / single-loop / two-layer adaptive) + mix priority.
- `gmk-ux-flow` NEW — flow + FTUE timeline + input map + 5 accessibility floor checks (color-blind / skippable tutorial / input redundancy / pause anywhere / text size).
- `gmk-narrative` NEW (optional) — branch tree, line counts, visible branch points, tone anchors.
- `gmk-save-migrate` NEW — save schema delta (integer version counter), migration pseudocode, default backup-and-replace rollback (30-day retention).
- `gmk-prototype` UPDATE — Hypothesis schema guard (`kind ∈ {bot, self-test}`, structured `target: {op, value}`, `confidence` + `sample_size` required for bot rows), `--type=shader` branch stub, `--bot-only` flag, legacy `human:` header migration.

**Group D — validation / integration (4 new, 1 rename + rewrite, 1 update, 1 new under Wave C)**
- `_bot_hook_lib.js` UPDATE — four optional persona callbacks (`stateSignature`, `riskEstimate`, `progressEstimate`, `noveltyScore`), `_gmkPersonaCapabilities` introspection, `_gmkApiVersion: 1` retained (additive only).
- `gmk-validate` UPDATE — Procedural Personas v1 (Runner / Treasure / Survivor / Explorer), `--policy persona-mix` default (50 × 4 = 200), state_coverage + action_entropy metrics, suspicious-run auto-extraction (~20), trial pruning at 30 runs, CI-aware (binomial) hypothesis row evaluation, persona fallback on missing callback.
- `gmk-self-test` NEW (renamed from `gmk-feedback`, rewritten) — own-play notes + suspicious-run priority routing, `--record` session capture flag, asymmetric verdict rule (FAIL: own-play wins; PASS: coded wins). v0.1 `human:` rows and `human_feedback` blocks auto-migrate to `self-test:` / `self_test_legacy`.
- `gmk-regression` NEW — re-run prior PASS milestones, drift detection (±10pp rates, ±25% durations), **capture-but-don't-apply** pattern (verdict downgrade only on `--accept-regression`).
- `gmk-platform-check` NEW (haiku) — 6-category compatibility scan (browser API / viewport / touch+mouse / keyboard / audio autoplay / storage §6 violations).
- `gmk-merge-gate` NEW — 3-check pre-merge gate: regression (reuses `<24h` report or invokes `gmk-regression`) + asset conflict (cross-milestone file overlap) + secret scan (gitleaks preferred, narrow-pattern fallback).
- `gmk-port` UPDATE — 6-stage port flow: Generate → Compile (1 retry) → Smoke (5 trials, 1 retry) → Metric diff (HTML 200 vs Engine 200; clear_rate / dominant_strategy / action_entropy with calibrated thresholds) → Checklist → Human RE-PASS. Preconditions require both bot PASS *and* self-test PASS. `--stage N` for surgical re-entry. Stage 4 distinguishes FLAG vs FAIL (drift may be acceptable, user decides).

**Agents (4 new)** — `agents/systems-designer.md`, `agents/feel-engineer.md`, `agents/economy-balancer.md`, `agents/playtest-analyst.md`. Anthropic 4-component spec + MAST defenses (one-way verification via `playtest-analyst`, no agent-to-agent calls, `max-iteration=1`).

**Templates**
- `templates/prototype-shader.html` NEW — vanilla WebGL2 single-file scaffold. Bot verdict defaults to INCONCLUSIVE; self-test required.

**Schemas (additive only — v0.1 milestones.json still loads)**
- `milestones.json`: `tasks[]`, `hypothesis.trials[]`, `self_test`, `merge_gate`, `ported_to.re_validation`, structured `hypothesis.measured_by.target: {op, value}`.

**Workspace files**
- `_workspace/vision.md`, `_workspace/roadmap.md`, `_workspace/dashboard.md`, `_workspace/milestones/<id>/kanban.md`, `_workspace/milestones/<id>/notes.md`, `_workspace/brainstorms/M{n}-{slug}.md` formats specified.

### Changed

- `gmk-feedback` → `gmk-self-test` (**breaking rename**). Legacy `/gmk-feedback` invocation prints one warning per project and dispatches to the new skill. v0.1 `measured_by.kind: 'human'` rows are migrated to `kind: 'self-test'` on next read; v0.1 `validation.human_feedback` blocks are preserved under `self_test_legacy` and a new `self_test` block is opened.
- CONCEPT.md rewritten — "재미 검증" → **"재미 falsification"**, supported genres listed (2D · deterministic input · sessions ≤ 5 min), development-completion endpoint stated, §13 4-axis, §14 competitive landscape, §15 academic limits.
- `_bot_hook_lib.js` — additive optional callbacks (see above); prototypes without the new callbacks still validate (hook surface returns `null`, persona falls back to random and the result records `fallback_used`).

### Removed

- `skills/gmk-share/` — external sharing (itch.io / GitHub Pages auto-deploy, link-out) is **out of scope** for the development-completion endpoint. Release, live-ops, and social channels are gmk-external by design (see CONCEPT §1, §13). Users who want a share workflow can run any deploy tool of their choice against `prototypes/*.html` directly — gmk does not bundle one.

### Migration notes (v0.1 → v0.2)

1. `/gmk-feedback <m>` still works once; output prints `[deprecated] use /gmk-self-test`. Subsequent calls in the same project go straight to `gmk-self-test`.
2. `measured_by` rows with freeform string targets (e.g. `"> 4min"`) get migrated to `{op: '>', value: 240000}` on the next `/gmk-prototype` or `/gmk-validate` invocation; a single warn is emitted listing migrated rows.
3. `measured_by.kind: 'human'` → `kind: 'self-test'` on the same migration pass.
4. `validation.human_feedback` block is renamed to `self_test_legacy` and preserved as-is; a new empty `self_test` block is opened for the next session.
5. Prototypes without the four new optional persona callbacks still validate — only the persona that needs the missing callback falls back to random, and that fact is recorded under `validation.fallback_used`.

### Breaking changes

- `gmk-feedback` is gone as a directory. The slash command alias works for one warning per project; scripts that scrape `skills/gmk-feedback/SKILL.md` will need to read `skills/gmk-self-test/SKILL.md`.
- `hypothesis.measured_by.kind: 'human'` is no longer a valid value. Reading old files triggers in-place migration, but new files must use `'bot' | 'self-test'`.
- `gmk-share` is removed. Any project relying on the old slash command must replace it with an explicit deploy step outside gmk.

---

## [0.1.0] — 2026-05-11

Initial MVP. 7 skills: `gmk-init`, `gmk-prototype`, `gmk-validate`, `gmk-share`, `gmk-feedback`, `gmk-port`, `gmk-status`. Single-file HTML prototypes + Playwright bot self-play + external human-tester feedback + Godot/Unity port. ZooMerge dogfood target.
