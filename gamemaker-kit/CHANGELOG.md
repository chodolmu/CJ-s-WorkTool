# Changelog

All notable changes to `gamemaker-kit` are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [SemVer](https://semver.org/).

---

## [0.7.0] — 2026-05-17

v0.6 was the first ACCURATE-verdict release after three consecutive OVERSTATED rounds. v0.7 keeps the 3-checkpoint evaluator process (Protocol 1/3/4) and closes another tranche of declared-but-half-applied standards: `kit_version` finally has a read contract, two structural-guard checks (A and C) graduate to FAIL-level, three new checks land at WARN-level, the allowlist gets line-level precision, and the rulebook's Rule 14 CYCLE form gets correctly framed as a future safety valve. Protocol 1 caught the HANDOFF's 4-candidate backlog being **UNDERSTATED** — the real implementation surface was 7 items — same anchoring pattern that hit v0.4 → v0.5 → v0.6. Protocol 3 graded the work **ACCURATE** with one minor stylistic tightening applied pre-tag.

### Added

**`gmk-prototype-rules` — Rule 16 (`kit_version` read contract):**
- 4-case table for handling the field: absent → treat as `"0.3.0"`, ≤ current → proceed, > current → warn-once-then-proceed (shape (d), warn-only), unparseable → warn and proceed as current.
- Warn-only by design — refusing on newer-version files would lock users out of their own data after any plugin upgrade/downgrade. Preserves v0.4's "no data loss" promise.
- Placeholder convention clarified: warn text uses full `MAJOR.MINOR.PATCH`, comparison logic uses `MAJOR.MINOR` only.
- Every SKILL with a `## Preconditions` section now follows the rule (verified by the amended Rule 13-14 footer; see Changed).

**`scripts/check-plugin-meta.sh` — three new checks (WARN-level in v0.7):**
- **Check D** — `kit_version` consistency. Schema example files (`_workspace/examples/pillars-example.json`, `milestones-example.json`) must declare `kit_version` matching plugin.json's MAJOR.MINOR.
- **Check E** — template line caps per Rule 2. `templates/prototype-*.html` ≤ 300 lines (soft, WARN) / ≤ 600 lines (hard, FAIL inside the WARN umbrella). v0.7 baseline: `prototype-shader.html` at 401 lines (over soft, under hard) — known carry-over from v0.4 template work, scheduled for refactor in v0.8.
- **Check F** — template `__gmk_botHook__` API version anchor. Files using the hook must either declare `_gmkApiVersion: 1` inline OR reference `_bot_hook_lib.js` (which declares it canonically). Guards against silent API drift.

**`scripts/hooks/pre-push` (NEW) — opt-in pre-push hook template:**
- Runs `scripts/check-plugin-meta.sh` and refuses the push on exit code ≠ 0.
- Opt-in via `git config core.hooksPath scripts/hooks` (not auto-installed — invasive on user clones).
- Emergency bypass: `git push --no-verify` (documented in the hook, not recommended).
- Closes the v0.6 process gap where an implementer could tag a release without running the pre-flight script.

### Changed

**Check A + Check C — WARN → FAIL.**
- Check A (Rule 14 token presence) and Check C (Rule 13-14 footer presence) are now release-blocking. Drift on either FAILs the script with exit code 1, refusing the pre-flight.
- Check B (endpoint terminology drift) stays at WARN: its case-insensitive `grep -rni 'endpoint'` regex risks false positives on legitimate prose (e.g., "API endpoint"). Whole-word `\bendpoint\b` regex + per-line allowlist is queued for v0.8.

**`scripts/.rule14-allowlist.txt` — file-level → line-level granularity.**
- v0.6 allowlist entries were per-SKILL (`gmk-mock-inject/SKILL.md`); a future patch adding a real refuse-with-rec to an allowlisted SKILL would slip past Check A undetected.
- v0.7 entries are per-line (`gmk-mock-inject/SKILL.md:26`). Each justification now cites the specific line. 9 entries cover 7 SKILLs (gmk-loop and gmk-merge-gate each have two non-refuse `/gmk-` mentions).
- Check A logic rewritten to iterate refuse-pattern hit lines and apply the allowlist per-line.

**Rule 13-14 citation footer — amended to "Rule 13-14, 16" across 27 SKILLs.**
- Every SKILL with a `## Preconditions` section now cites Rule 16 in its standard-preconditions footer. The amendment was uniform (one sed across all 27 SKILLs); audit grep `grep -l "Rule 13-14, 16" skills/*/SKILL.md` returns 28 hits (27 SKILLs + the rulebook).

**Rule 14 CYCLE form — reframed as "fallback / currently unused safety valve".**
- v0.6 docs presented CYCLE as a routine alternative to the standard form, which made Protocol 1 question whether it was dead code. v0.7 clarifies: the two known cycles (shader INCONCLUSIVE, `--skip` validation) are closed by **accept-state widening** in the target skill (see `gmk-self-test:33/35`), not by emitting the CYCLE token. CYCLE is preserved as the mandated form for *future* cycles that cannot be closed by widening either side. Currently unused — and that's the intended state.

**`kit_version` writer (`gmk-init`) — now writes `"0.7.0"`.**
- Pillars-template (L163) and milestones-template (L193) both updated. Prose anchor at L201 cross-references Rule 16 and clarifies the silent-upgrade path (additive-only schema, backward-compatible reads).

**Schema example files — `kit_version: "0.7.0"` + `_comment` updated.**
- `_workspace/examples/pillars-example.json` and `milestones-example.json` now declare v0.7. `_comment` blocks mention v0.7 schema and Rule 16. Schema itself unchanged from v0.4 (additive-only across all sub-releases).

### Honesty note

The HANDOFF v0.6 reflection listed 4 v0.7 backlog candidates. **Protocol 1 (work-start) evaluator found the real implementation surface was 7 items** — 4 candidates corrected plus 3 the HANDOFF missed (line-level allowlist granularity, pre-push hook template, three new structural checks D/E/F). One candidate (`gmk-mock-inject` cold-read audit) resolved to **NO IMPLEMENTATION WORK** — the audit completed during Protocol 1 and confirmed the allowlist decision holds; v0.7 simply records the verification.

This is the **same anchoring pattern** F21 named in the post-v0.6 HANDOFF: the previous evaluator's backlog reads convincingly because it cites real grep hits, but it shows only what *they* saw. Protocol 1's job is to look fresh — and once again it expanded scope by ~75% (4 → 7 items).

Protocol 3 (pre-release) graded v0.7 **ACCURATE** with one minor stylistic clarification applied pre-tag (placeholder MAJOR.MINOR.PATCH convention in Rule 16's 4-case table).

### Migration notes from v0.6

- **No schema changes.** Files written by v0.6 (or earlier) read identically in v0.7. The new read-side behavior (Rule 16) only adds warnings for files written by *newer* kit versions, never refuses.
- **No data loss.** v0.7 doesn't rewrite or auto-upgrade existing files. The `kit_version` field upgrades silently only when `/gmk-init` is re-invoked on a project (existing behavior since v0.4).
- **No new SKILLs, no new agents.**
- **Pre-flight is now FAIL-strict on Checks A and C.** Anyone tagging a release must `bash scripts/check-plugin-meta.sh` returning exit 0. Optional opt-in: `git config core.hooksPath scripts/hooks` to enforce via pre-push hook.

### Non-goals (v0.7 deliberately did not do)

- Did not promote Check B to FAIL (regex tightening + line-level allowlist queued for v0.8).
- Did not refactor `templates/prototype-shader.html` to fit the 300-line soft cap (queued for v0.8).
- Did not add a `pillars.kind` field reader (also write-only since v0.4 — same defect class as `kit_version`; queued for v0.8).
- No dogfood. Audit-only stance preserved (W24).
- No new SKILLs, no new agents, no new templates.

---

## [0.6.0] — 2026-05-17

v0.5 declared `[Rule 14]` tokens mandatory and renamed "endpoint" → "checkpoint" — but applied each only halfway. The external evaluator graded v0.5's self-audit **OVERSTATED** for the third release in a row. v0.6 finishes both sweeps across all affected SKILLs and adds a **structural guard** so the next half-applied standard auto-fails release pre-flight.

This release was driven by **two evaluator checkpoints, not self-audit**: Protocol 1 (work-start) corrected the backlog *before* implementation (HANDOFF v0.6 lists 15 SKILLs for the Rule 14 sweep; Protocol 1 found the real scope was 11 SKILLs with different composition — 3 ADDs, 5 REMOVEs that HANDOFF wrongly included, +2 endpoint locations HANDOFF missed). Protocol 3 (pre-release) verified the work before tag. v0.6 is the **first ACCURATE-verdict release**.

### Added

**`scripts/check-plugin-meta.sh` — three new pre-flight checks (WARN-level):**
- **Check A — Rule 14 token presence.** For each SKILL containing a refuse-with-recommendation pattern (`Run /gmk-X` or `` run `/gmk-X` ``), require at least one `[Rule 14` token. False-positive SKILLs (advisory prose, dispatch tables, usage triggers) are listed in `scripts/.rule14-allowlist.txt` with per-entry justifications.
- **Check B — `endpoint` terminology drift.** Scan live user-facing docs (`skills/`, `CONCEPT.md`, `README.md`, `_workspace/structure.md`, `.claude-plugin/marketplace.json`) for "endpoint". Intentional contrasts and frozen history are allowlisted in `scripts/.endpoint-allowlist.txt`.
- **Check C — Rule 13-14 citation footer.** SKILLs with a `## Preconditions` section must carry the `_Standard preconditions ... Rule 13-14._` footer. Same defect-class shape as MAJOR-1: declared sweep that could drift over time.
- All three are **WARN-level in v0.6** (release proceeds with warnings allowed). v0.7+ may promote to FAIL once baseline is stable.
- Existing `skills/` count check fixed: now counts `SKILL.md` files via `find` instead of raw `ls`, eliminating the latent "29 vs 30" drift v0.5 had when `skills/scripts/` was added.

**`scripts/.rule14-allowlist.txt` (NEW):**
- 7 SKILLs exempt from Check A with one-sentence justifications: `gmk-art-gen` (recovery instruction), `gmk-brainstorm` (opt-in condition), `gmk-kill-milestone` (post-action note), `gmk-loop` (dispatch advisory), `gmk-merge-gate` (warning-only row), `gmk-mock-inject` (usage trigger), `gmk-save-migrate` (advisory prose).

**`scripts/.endpoint-allowlist.txt` (NEW):**
- 5 intentional "endpoint" sites: `CONCEPT.md:11` and `:40` (rename meta-discussion), `gmk-self-test:107` (player session end, different semantic), `gmk-dev-complete:59` (contrast clause), `plugin.json:4` (intentional contrast added in v0.5).

### Changed

**Rule 14 token sweep — 11 SKILLs, 13 token sites added.**
- **`gmk-port`** — 3 sites: refuse on missing bot PASS (L25), refuse on self-test ≠ PASS (L27), re-entry sentinel after `@systems-designer` (L88).
- **`gmk-roadmap`** — 2 sites: refuse on missing pillars (L21), refuse on milestone ID collision recommending `--revive` (L203). Defensive token also on the "Pillars skipped" warning (L22).
- **`gmk-prototype`** — 2 sites: refuse on missing pillars (L20), warn on skipped pillars (L21). Both point to `/gmk-init`.
- **`gmk-regression`, `gmk-dev-complete`, `gmk-status`, `gmk-design-system`, `gmk-shape-advisor`, `gmk-ux-flow`** — one token site each, all in the Preconditions block.
- All tokens use canonical form `[Rule 14] /gmk-<this> → /gmk-<target> — verified target's preconditions can be satisfied from current state.` per `gmk-prototype-rules` Rule 14 (lines 380-398).

**`endpoint` → `checkpoint` (or `release-readiness checkpoint`) — 17 locations.**
- v0.5 changelog claimed 3 locations; the real count was 17 (Protocol 1 evaluator found +4 over HANDOFF's revised 13).
- Live docs touched: `README.md:4`, `CONCEPT.md:11/67/408`, `gmk-dev-complete/SKILL.md:3/59/228/248`, `gmk-loop/SKILL.md:128`, `gmk-status/SKILL.md:68/117/132`, `gmk-port/SKILL.md:493`, `gmk-prototype-rules/SKILL.md:279`, `_workspace/structure.md:48/532`, `.claude-plugin/marketplace.json:15`.
- Frozen history (CHANGELOG v0.3-v0.4 entries, `_workspace/v0.X-*.md` audit docs) and intentional contrasts (allowlist) left alone per Keep-a-Changelog convention.

**`gmk-dev-complete` — two "read-only" inaccuracy fixes:**
- L208 ("read-only on canonical state … nothing else") and L249 ("Doesn't write to milestones.json or pillars.json") both contradicted the `--accept-warnings` flag that writes `warnings_acknowledged_at` to merge_gate / port-checklist files. Both rewritten to surface the legitimate write paths.

**CHANGELOG cross-reference footnotes:**
- L53 and L94 of the v0.4 entry now carry `(see v0.5 Honesty note above — half-way applied until v0.5)` so a reader landing on the v0.4 claims doesn't miss the v0.5 correction. Keep-a-Changelog allows small inline cross-refs even on past entries.

### Honesty note

This release's scope was wider than the HANDOFF backlog. The HANDOFF (written immediately after v0.5's external audit) listed 15 SKILLs for the Rule 14 sweep; Protocol 1 (the work-start evaluator) found the real scope after reading each cited refuse site was 11 SKILLs — with 3 ADDs HANDOFF missed and 5 REMOVEs HANDOFF wrongly included. The endpoint sweep similarly grew from 13 cited locations to 17 actual. **The defect-class shape didn't disappear; the implementer's anchoring just shifted from "self-audit" to "HANDOFF authorship".** The lesson Protocol 1 captures: an evaluator with no stake in the previous list reads each cited site fresh, while the implementer (or HANDOFF author) reads to confirm. v0.6's process change is to require Protocol 1 + Protocol 3 evaluator checkpoints per release — costs ~3 evaluator calls, replaces ~3 OVERSTATED audits.

External evaluator graded v0.6's Protocol 3 pre-release audit as **ACCURATE**. First in the v0.4 → v0.5 → v0.6 lineage.

### Migration notes from v0.5

- No data loss. No schema changes. No deprecated fields.
- No new SKILLs, no new agents. (`scripts/` got a sanity script extension + 2 allowlist files.)
- Existing v0.5 SKILL outputs without Rule 14 tokens still work — v0.6 just adds the tokens to refuse paths going forward and adds the structural guard so future sweeps can't go halfway again.
- Pre-flight: `bash scripts/check-plugin-meta.sh` should be run before any v0.6+ tag.

### Non-goals (v0.6 deliberately did not do)

- No new audit waves beyond the 5 v0.5 evaluator backlog items + 1 structural guard. The v0.5 audit's framework holds; v0.6 just completes the work it specified (corrected by Protocol 1).
- No dogfood. Audit-only stance preserved (W24).
- No new SKILLs / agents / templates.
- No `kit_version` read-enforcement (still deferred to v0.7+ — v0.4 decision 4 holds).

---

## [0.5.0] — 2026-05-15

v0.4 deprecated 9 trace fields and announced "skills no longer write them" — but the deprecation was applied **half-way**. Two external evaluator agents (one comparative-research, one internal-coherence) audited v0.4 immediately after release and found **7 regressions** the v0.4 audit had introduced and missed. v0.5 is the **post-release hotfix** that closes those gaps.

This release was driven by **external-agent evaluation**, not by self-audit. v0.4 self-audit reported "28 defects → 0 ★★★ → all fixed". The external evaluator found 7 ★★ defects v0.4 had introduced and not seen. v0.5 fixes those.

### Fixed (the 7 regressions v0.4 introduced)

- **G-A — Rule 14 made falsifiable.** `gmk-prototype-rules` Rule 14 originally said the refuse-chain check lives "in the model's reasoning, not in the user-visible message" — un-grep-able and non-falsifiable. v0.5 introduces the `[Rule 14]` and `[Rule 14 — CYCLE]` mandatory tokens that every refuse-with-recommendation block must end with. `gmk-self-test` Preconditions §2 now explicitly accepts `validation.verdict === "INCONCLUSIVE"` when `shape === "shader"` (the v0.3 cycle Rule 14 was built for) and accepts `validation.skipped === true` (the v0.4 `/gmk-validate --skip` escape hatch).
- **G-B — `gmk-kill-milestone` deprecation completed.** v0.4 deprecated `kill_history[]` in the Step 5 kill operation but left 4 contradictory lines elsewhere in the same SKILL (lines 68, 182, 193 sub-flag table, 238 edge case) that *also* told the model to write the deprecated array. v0.5 replaces all 4 with "preserved in git history of milestones.json — `kill_history[]` was deprecated in v0.4."
- **G-C — `gmk-self-test` deprecation completed.** v0.4 deprecated `self_test.sessions[]` body + `coded_themes` in Step 7 but left 3 contradictory lines (Sub-flags `--record` side-effect, `--thin-ok` side-effect, Step 7 edge case at line 351) telling the model to write them. v0.5 fixes all 3.
- **G-D — `gmk-validate` deprecation completed.** v0.4 deprecated `validation_history[]` but left line 478 saying "Re-running on the same milestone appends to `validation_history`". v0.5 corrects to "overwrites top-level `validation` directly — no append."
- **G-E — `gmk-prototype-rules` Rule 10 rulebook fixed.** v0.4 left Rule 10 (the canonical rulebook that all other SKILLs cite) saying self-test data lands in `self_test.sessions[]` — structurally undoing the v0.4 deprecation. v0.5 corrects Rule 10's "Where it lands" table to name `self_test.latest_verdict / latest_session_path / latest_session_at / verdict_reason` (the canonical v0.4 fields) plus the on-disk session files, with a parenthetical note explaining the v0.4 deprecation.
- **G-F — `warnings_acknowledged_at` schema declared.** v0.4 introduced `--accept-warnings` persistence but didn't declare *where* the timestamp gets written. v0.5 adds the optional `warnings_acknowledged_at` field to both `merge_gates/<m>.md` and `port-checklists/<m>.md` templates in `structure.md`, including the invalidation rule (re-running the gate that produced the warning invalidates the acknowledgment).
- **G-G — Double-force → DEV_COMPLETE blocked.** v0.4's `gmk-dev-complete` C5 was a WARN regardless of which gates were forced. v0.5 splits C5: if *both* validation AND self-test are `forced: true` on the same milestone (the "zero evidence" case), C5 is **FAIL** and cannot be acknowledged via `--accept-warnings`; if only one gate is forced, C5 stays WARN. New derived fact `double_forced_gates` exposed in Step 1.

### Changed

- **"Endpoint" → "release-readiness checkpoint".** `CONCEPT.md §0 Endpoint`, `gmk-dev-complete` title, body, and a refuse-message all retired the misnomer. The project can be re-opened later by `/gmk-roadmap`, `/gmk-kill-milestone --revive`, or `/gmk-validate --accept-regression` — `DEV_COMPLETE` is a recomputable checkpoint, not a one-way terminus.

### Honesty note

The v0.4 release notes claimed "Wave γ migration policy: no data loss" and "9 fields, write-only, safe to drop". Both statements were structurally true on *read paths* (no SKILL reads the deprecated fields), but **not** on write paths — v0.4 SKILLs still told the model to write 3 of the 9 fields (G-B/C/D/E above). v0.5 completes the write-path removal. A v0.5 file is now actually free of the deprecated writes.

External evaluator graded v0.4's self-audit as **OVERSTATED**. v0.5 accepts that grade and is the corrective.

### Migration notes from v0.4

- No data loss. v0.4 files with deprecated fields still read as-is. v0.5 stops writing them across the board.
- No new SKILLs, no new agents.
- `--accept-warnings` semantics tightened: double-forced milestones cannot be acknowledged. Users with double-forced shipped milestones from v0.4 should un-force at least one gate before re-running dev-complete.
- Rule 14 tokens (`[Rule 14]` / `[Rule 14 — CYCLE]`) are new mandatory-format strings on refuse-with-recommendation outputs. Skill outputs from v0.4 sessions that lack these tokens are still readable — v0.5 just produces them going forward.

### Non-goals (v0.5 deliberately did not do)

- No new audit waves beyond fixing the 7 regressions. The v0.4 audit's structural framework holds; v0.5 only corrects the application.
- No dogfood. Audit-only stance preserved.
- No new SKILLs / agents / templates.
- No `kit_version` read-enforcement (still deferred to v0.6 or later).

---

## [0.4.0] — 2026-05-15

v0.3 closed the structural skeleton (agent wiring + dev-complete endpoint). v0.4 is the **quality-of-life** release on top: orphan sub-flags get definitions, the 27 precondition-handling skills converge on one pattern, the agent routing block standardizes its output format, and the schema sheds 9 trace fields that were write-only since v0.2. **No new SKILLs, no new agents.** Backward-compatible reads (v0.3 files validate as-is); breaking writes (v0.4 skills no longer emit the 9 deprecated fields) *(see v0.5 Honesty note above — half-way applied until v0.5)*.

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
- v0.4 skills no longer write these. v0.3 files containing them validate; skills ignore them. **No data loss** — fields are not auto-stripped. The git commit history of `milestones.json` is the canonical trace for kill/revive/regression/re-port cycles. *(see v0.5 Honesty note above — half-way applied until v0.5)*
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
