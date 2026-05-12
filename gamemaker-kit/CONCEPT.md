# gamemaker-kit

> **Prototype in HTML. Falsify fun in HTML. Port only what survives.**
>
> A Claude Code plugin that runs a game-development workflow inside a single context — from pillar definition to engine port — with **release and live-ops explicitly out of scope**.

---

## 0. One-paragraph summary

Game development isn't code development. The validation criterion is "fun", not "works". When a milestone isn't fun, the cheapest answer is to throw it away — but engines (Godot's 850 classes, Unity's package thicket) make throwing things away expensive. **gamemaker-kit forces fun-falsification at the cheapest layer**: each milestone gets a single-file HTML prototype, a Playwright bot self-plays 200 rounds across four procedural personas, the user themselves does a self-test pass with the suspicious-run subset already curated, and only milestones that survive **both** gates get ported to Godot or Unity — with a 6-stage re-validation gate after porting. The kit's endpoint is **"development complete"**; release, live-ops, marketing, and external-tester channels are out of scope by design.

---

## 1. Why this exists

- **Single-file blowup is the #1 failure pattern** (1,400+ lines is unrecoverable). → Milestone-bounded HTML prototypes with a 300-line soft cap / 600-line hard cap, structurally enforced.
- **AI cannot judge "fun"** (IEEE Spectrum; HN consensus). → The kit's promise is *fun-falsification* (catch the un-fun), never *fun-validation*. The user themselves is the only authority on "fun". (See §15.)
- **Validation-loop absence is the #1 bottleneck** (y1uda, Kevin London, godogen, MAST 21.3% — same root cause). → Playwright bot harness closes the loop in seconds; procedural personas + suspicious-run extraction prevent the "200 random trials" trap.
- **Engine API hallucination is structural** (godogen rewrote 4 times). → Mechanic validation happens in HTML/JS, where hallucination is lowest. The engine is touched only after PASS — and even then, a 6-stage re-validation catches port-time drift.
- **AI Slop backlash is now in Steam's algorithm.** → Self-test (user-as-tester) gate exists at every milestone, not just at release.
- **The real indie pain is 30-tool integration glue.** → The kit is that glue, but only inside the development envelope. Once development is complete, the kit steps out — release tools are someone else's concern.

### Supported genres (the kit's calibration envelope)

The kit's bots, metric thresholds, and persona library are calibrated for:

- **2D** (no 3D camera, no perspective math)
- **Deterministic input** (no real-time twitch reflex floors below 100 ms)
- **Session length ≤ 5 minutes** (long-session economy + retention questions are out of scope)

Outside this envelope, the kit still runs — but validation gates degrade (bots can spec but not judge), and the user is told so explicitly at `/gmk-init`. **3D, MMO, real-time PvP, and AAA-narrative are Phase 3** (or never).

### Endpoint: "development complete"

The kit's endpoint is the user's explicit declaration: *"this game is ready for release prep"*. Everything after that — Steam-page text, marketing, build pipelines, telemetry, live-ops, patch notes, community channels — is **outside the kit**. The kit does not bundle, integrate with, or recommend release tooling. It is opinionated about what it does, and it does development. (See §13 for the 4-axis frame.)

---

## 2. Workflow

```
gmk-init  →  gmk-roadmap  →  (per milestone) ──┐
                                                │
       ┌────────────────────────────────────────┘
       ↓
   ┌─────────────────────────────────────────────────────────┐
   │  Milestone cycle (repeat N times — the 4 axes run in    │
   │  parallel; see §13)                                      │
   │                                                          │
   │   axis 1 (time)     gmk-shape-advisor → gmk-prototype    │
   │   axis 2 (discipline) gmk-design-system / gmk-content-   │
   │                     plan / gmk-art-spec / gmk-art-gen /  │
   │                     gmk-sound-plan / gmk-ux-flow /       │
   │                     gmk-narrative / gmk-save-migrate     │
   │   axis 3 (validation) gmk-validate (bots, 200×4 personas)│
   │                     → gmk-self-test (user, suspicious-   │
   │                     run priority) → gmk-regression       │
   │   axis 4 (integration) gmk-merge-gate → gmk-port (6      │
   │                     stages, HTML→engine re-validation)   │
   └─────────────────────────────────────────────────────────┘
       ↓
🏁 development complete (gmk endpoint — user-declared)

┄┄┄┄┄┄┄┄┄ outside gmk ┄┄┄┄┄┄┄┄┄
Steam page · marketing · release · live-ops · patch notes · community
```

---

## 3. Directory layout (inside the user's game project)

```
ZooMerge/                                # user's game project
├─ godot/                                # the actual engine project
├─ prototypes/                           # gmk-managed HTML prototypes
│   ├─ m1-merge-feel.html
│   └─ ...
├─ .gamemaker-kit/                       # gmk internal state (git-tracked recommended)
│   ├─ pillars.json                      # vision + pillars (user-editable)
│   ├─ milestones.json                   # full milestone schema (gmk updates)
│   ├─ validations/<m>/                  # bot 200×4 results
│   │   ├─ aggregated.json
│   │   └─ suspicious/<seed>.json        # ~20 outliers for self-test priority
│   ├─ self-tests/<m>/                   # user's own-play notes
│   ├─ merge-gates/<m>.md                # pre-merge gate output
│   └─ port-checklists/<m>.md            # 6-stage port verification
└─ _workspace/                           # user-facing markdown dashboard
    ├─ vision.md                         # north star (pillars, human-friendly)
    ├─ roadmap.md                        # milestone list + dependency graph
    ├─ dashboard.md                      # overwritten each /gmk-status
    └─ milestones/<id>/
        ├─ kanban.md                     # per-discipline backlog
        ├─ system-spec.md                # systems-designer output
        ├─ feel-numbers.md               # feel-engineer output
        ├─ feel-edits.md                 # feel-engineer edit list
        ├─ economy-numbers.md            # economy-balancer output
        ├─ balance-rationale.md          # economy-balancer rationale
        ├─ playtest-diagnosis-*.md       # playtest-analyst output
        └─ notes.md                      # user free-form
```

**File-absorption first**: everything is plain Markdown / JSON in the user's repo. VS Code reads it, git versions it, Notion / Linear / etc. can be one-way mirrors if the user wants — gmk never syncs back. `_workspace/` is the user's daily-driver view; `.gamemaker-kit/` is the kit's machine state.

---

## 4. Skill matrix (v0.2 — ~28 skills, 4 domain agents)

### Group A — common / axis infrastructure (6)

| Skill | Model | Axis | Role |
|---|---|---|---|
| `gmk-init` | opus | 1 | Project init: pillars.json + vision.md + supported_genres_check |
| `gmk-roadmap` | sonnet | 1 | Milestone decomposition + dependency graph → roadmap.md |
| `gmk-brainstorm` | sonnet | 1 | Opt-in 5-stage diverge/converge (MDA lens) |
| `gmk-task-split` | sonnet | 1·2 | Milestone → per-discipline backlog → kanban.md |
| `gmk-status` | sonnet | 2 | Dashboard + kanban + blocker detection + next-action |
| `gmk-loop` | sonnet | all | Minimal dispatcher (Plan → Build → Validate → Integrate); max-iteration=1 |

### Group B — methodology / HTML prototyping rulebook (6) ★

| Skill | Model | Axis | Role |
|---|---|---|---|
| `gmk-prototype-rules` | sonnet | 2·4 | 300/600-line cap, `__gmk_botHook__` API contract, hook self-check |
| `gmk-shape-advisor` | sonnet | 1·2 | Hypothesis → shape (grid / continuous / dialogue / shader) |
| `gmk-portability-check` | sonnet | 4 | Porting-risk catalog (hallucination-likely patterns) |
| `gmk-mechanic-merge` | sonnet | 1·4 | Combine two validated prototypes into integration milestone |
| `gmk-kill-milestone` | sonnet | 1 | Cleveland-rule trigger to retire + restart |
| `gmk-mock-inject` | sonnet | 2 | Placeholder asset / dependency injection (cross-discipline unblock) |

### Group C — per-discipline (10)

| Skill | Model | Discipline | Axis | Role |
|---|---|---|---|---|
| `gmk-design-system` | sonnet | design | 2 | System diagram, state machines, coupling, invariants |
| `gmk-content-plan` | sonnet | design | 1·2 | Content volume + 5 curve shapes (flat / stairs / ramp / wave / bell) |
| `gmk-prototype` | sonnet | code | 2 | Hypothesis-guarded HTML generation; `--type=shader` branch |
| `gmk-refactor-check` | sonnet | code | 4 | LOC / branches / nesting / calls-out thresholds, porting-risk verdict |
| `gmk-art-spec` | sonnet | art | 2 | Asset spec, palette lock, style anchors (4 asset categories) |
| `gmk-art-gen` | sonnet | art | 2 | `/art` (ComfyUI) wrapper with palette + anchor injection |
| `gmk-sound-plan` | sonnet | audio | 2 | SFX table + 3 BGM types (none / single-loop / two-layer adaptive) |
| `gmk-ux-flow` | sonnet | ux | 2 | Flow + FTUE timeline + input map + 5 accessibility floor checks |
| `gmk-narrative` | sonnet | narrative | 2 | Branch tree, line counts, visible branch points (optional) |
| `gmk-save-migrate` | sonnet | data | 4 | Schema delta, migration pseudocode, backup-and-replace rollback |

### Group D — validation / integration (6)

| Skill | Model | Axis | Role |
|---|---|---|---|
| `gmk-validate` | sonnet | 3 | 4 personas × 50 trials = 200 default; state_coverage + action_entropy; suspicious-run auto-extract (~20); trial pruning at 30; CI-aware (binomial) row evaluation |
| `gmk-self-test` | sonnet | 3 | Own-play notes + suspicious-run priority routing; asymmetric verdict (FAIL: own-play wins; PASS: coded wins) |
| `gmk-regression` | sonnet | 3·4 | Re-run prior PASS milestones; drift detection (±10pp rates / ±25% durations); **capture-but-don't-apply** (verdict downgrade only on `--accept-regression`) |
| `gmk-platform-check` | haiku | 3·4 | 6-category pattern scan (browser API / viewport / touch+mouse / keyboard / audio autoplay / storage) |
| `gmk-merge-gate` | sonnet | 4 | Regression (reuse <24h report) + asset conflict + secret scan (gitleaks preferred, narrow-pattern fallback) |
| `gmk-port` | opus | 4 | 6-stage flow: Generate → Compile (1 retry) → Smoke (5 trials, 1 retry) → Metric diff (HTML 200 vs Engine 200) → Checklist → Human RE-PASS |

### Domain agents (4)

| Agent | Domain | When invoked | Refuses |
|---|---|---|---|
| `systems-designer` | system shape | Pre-prototype spec; `/gmk-port` Stage 1 | Without `pillars.json` or `pillars_targeted` (MAST FM-1.1) |
| `feel-engineer` | sensory layer | Continuous / shader shapes; self-test FAIL on sensation words | Without `systems-designer` spec |
| `economy-balancer` | numeric balance | Numeric `measured_by` row failing; content-plan follow-up | Without structured `target: {op, value}` (MAST FM-3.3) |
| `playtest-analyst` | log diagnosis + routing | Validation FAIL / self-test FAIL / regression drift / Stage 4 diff | "Fix it" requests (routes only, never edits) |

**Safety architecture**: only `playtest-analyst` reads trial logs (one-way verification — prevents the 17× cross-talk amplification, MAST FM-2.x). No agent-to-agent calls; all routing goes through the user. Every agent has `max-iteration=1`.

---

## 5. Data schema (v0.2)

### `pillars.json`

```json
{
  "project_name": "ZooMerge",
  "engine": "godot",
  "created_at": "2026-05-12",
  "pillars": [
    {
      "id": "tactile-satisfaction",
      "name": "손맛",
      "description": "Every interaction has a chunky payoff",
      "anti_examples": ["limp", "휙 지나감"]
    }
  ],
  "supported_genres_check": {
    "two_d": true,
    "deterministic_input": true,
    "session_under_5min": true
  }
}
```

### `milestones.json` (key blocks)

```typescript
{
  project_name: string,
  milestones: [{
    id: string,
    name: string,
    pillars_targeted: string[],
    hypothesis: {
      if: string,
      then: string,
      measured_by: [{
        metric: 'clear_rate' | 'state_coverage' | 'action_entropy'
              | 'frustration_proxy' | 'dominant_strategy_ratio'
              | 'crash_rate' | 'self_test_says_X' | string,
        kind: 'bot' | 'self-test',         // 'human' is migrated on read
        target: { op: '>' | '<' | '==' | 'between',
                  value: number | [number, number] },
        confidence: 0.80 | 0.90 | 0.95,    // required for kind='bot'
        sample_size: number,                // required for kind='bot'
        baseline?: { source, value, milestone_id? },
        early_fail?: { after_runs, condition }
      }],
      trials: [{ trial_id, started_at, config, result }]
    },
    prototype: string,
    shape: 'grid' | 'continuous' | 'dialogue' | 'shader',
    tasks: [{
      id, discipline: 'design'|'code'|'art'|'audio'|'ux'|'qa',
      title, status: 'backlog'|'in-progress'|'review'|'done'|'blocked',
      blocked_by?: string[],
      assignee?, created_at, updated_at, completed_at?
    }],
    validation?: { /* per-persona metrics + aggregate */ },
    self_test?: {
      sessions: [{ date, duration_min, notes_path,
                   suspicious_seeds_reviewed: number[],
                   verdict: 'PASS'|'FAIL'|'NEEDS_MORE_PLAY' }],
      coded_themes: [...],
      latest_verdict: 'PASS'|'FAIL'|'INCONCLUSIVE'
    },
    self_test_legacy?: { /* v0.1 human_feedback preserved verbatim */ },
    merge_gate?: {
      ran_at, regression_ok: boolean,
      asset_conflicts: [{ path, milestones: [string] }],
      secrets_detected: [{ file, line, type }],
      verdict: 'PASS'|'FAIL',
      warnings: string[]
    },
    ported_to?: {
      ported_at, engine, files_created, files_modified, checklist,
      re_validation: {
        compile_ok, smoke_run_ok,
        metric_diff: { html_metrics, engine_metrics, delta, warnings },
        visual_diff?: { roi, threshold, max_diff_pixel_ratio, passed },
        verdict: 'RE_PASS'|'RE_FAIL'|'NEEDS_TUNING',
        verdict_reason, tuned_at?
      }
    },
    killed?: boolean
  }]
}
```

All v0.2 fields are **additive**; v0.1 milestones.json still loads. `measured_by.kind: 'human'` is migrated to `'self-test'` on first read with a one-time warning; `validation.human_feedback` is preserved verbatim under `self_test_legacy`.

---

## 6. Bot validation (procedural personas v1)

`gmk-validate` runs **4 personas × 50 trials = 200 default** (`--policy persona-mix`). Personas are hand-tuned scoring functions; no evolutionary learning, no opaque RL.

| Persona | Scoring | Requires callback | Fallback |
|---|---|---|---|
| Runner | `0.8·progress + 0.2·score` | `progressEstimate` | random |
| Treasure | `0.1·progress + 0.9·score` | (uses base score) | — |
| Survivor | `0.5·progress + 0.5·(1/risk)` | `riskEstimate` | random + `fallback_used` flag |
| Explorer | `0.3·score + 0.7·novelty` | `noveltyScore` | random + `fallback_used` flag |

**Metrics** (closed set, 7):
`clear_rate`, `state_coverage`, `action_entropy`, `frustration_proxy`, `dominant_strategy_ratio`, `crash_rate`, plus any `self_test_says_*` qualitative tag.

**Suspicious-run extraction** (~20 per milestone): entropy bottom 10% + entropy top 10% + duration edges 5% + crashed/stuck. Routed to `gmk-self-test` so the user reviews the high-signal trials first instead of randomly sampling.

**Trial pruning**: any persona's early_fail condition cuts that persona's run set at 30 trials. Saves ~85% of trial cost when a hypothesis is failing decisively.

**CI-aware row evaluation**: bot rows must declare `confidence` (0.80 / 0.90 / 0.95) and `sample_size`; verdict uses binomial CI, not point estimate. A bot row with `target.op: '>'` and `value: 0.6` at `confidence: 0.9` passes only if the **lower** confidence bound is ≥ 0.6.

**Bot verdict for `shape: 'shader'` is INCONCLUSIVE by design** — bots cannot judge visual fun; the verdict defers to self-test.

---

## 7. Port re-validation (6 stages)

`gmk-port` is opus. Preconditions: bot PASS **and** self-test PASS (both — not either).

| Stage | What runs | Failure handling |
|---|---|---|
| 1 — Generate | `systems-designer` Stage 1 + code generation; produces engine code **and** an engine-side bot hook (`_gmk_bot_hook.gd` / `.cs`) | Refuse if system-spec missing |
| 2 — Compile | `godot --headless --check-only` or `Unity -batchmode -quit`; 1 retry on transient failure | Output error log + halt; suggest manual fix |
| 3 — Smoke | 5 engine-side bot trials via the generated hook; 1 retry on crash | Halt; suggest Stage 1 re-generate or Stage 2 fix |
| 4 — Metric diff | HTML bot 200 vs engine bot 200; compare `clear_rate`, `dominant_strategy_ratio`, `action_entropy` against calibrated thresholds | **FLAG** (drift may be acceptable; user decides) vs **FAIL** (drift breaks the hypothesis) |
| 5 — Checklist | Auto-generated `port-checklists/<m>.md` for user review (input latency, hit-stop, physics behavior, SFX timing) | Block Stage 6 until user marks checklist done |
| 6 — Human RE-PASS | User plays the engine version; verdict input `RE_PASS` / `RE_FAIL` / `NEEDS_TUNING` | RE_FAIL → roll back; NEEDS_TUNING → loop to `feel-engineer` / `economy-balancer` in engine-tuning mode |

`--stage N` allows surgical re-entry after a partial fix. The stage validator checks all prior stages first.

---

## 8. Guard policies

- **300-line soft cap / 600-line hard cap** on prototypes (`gmk-prototype-rules`). At 600 you cannot add more code — the kit refuses, names the violation, and recommends `gmk-task-split` or `gmk-mechanic-merge`.
- **Pillar alignment**: a milestone whose hypothesis strengthens no pillar is blocked. `pillars_targeted: []` triggers a refusal.
- **`__gmk_botHook__` presence**: `/gmk-validate` refuses to run if the surface is missing or fails the hook self-check (5-point smoke from `gmk-prototype-rules` §5).
- **Hypothesis schema guard**: `kind` must be `'bot' | 'self-test'`; bot rows must declare `target: {op, value}`, `confidence`, `sample_size`. Freeform string targets are auto-migrated with a one-time warning.
- **Port preconditions**: `validation.verdict !== 'PASS'` OR `self_test.latest_verdict !== 'PASS'` blocks `/gmk-port`. Not either — both.
- **Merge-gate refusal**: regression FAIL, asset conflict on non-prototype paths, or secrets-detected block merge.
- **Capture-but-don't-apply**: `/gmk-regression` writes drift to disk but **never** downgrades a milestone's verdict — only `--accept-regression` does that, after the user reads the report.

---

## 9. Relation to other tools

- **`taskforge-pro`**: code-task PM. Can break a single prototype's coding work into sub-tasks; gmk does not duplicate this.
- **`zoodev-loop`**: ZooMerge-specific autonomous loop. Pre-dates gmk; deprecates as gmk + ZooMerge dogfood matures.
- **`/art` (ComfyUI pipeline)**: `gmk-art-gen` wraps it. The kit doesn't bundle ComfyUI; the user runs it locally per `C:\GameMaking\CLAUDE.md`.
- **gmk depends on**: Claude Code + game engine + Playwright (required, npm-installable) + gitleaks (optional, recommended). **Zero external accounts, zero API keys.**

---

## 10. Phased scope

### v0.2 (this release) — described in §1-9 above.

### v0.3 (planned)
- Visual diff for shader prototypes (currently INCONCLUSIVE; v0.3 adds ROI-based diff)
- GVGAI-style forward-model bots for combinatorially complex grid games
- Unity port path tested end-to-end (v0.2 supports both engines in spec but only Godot is dogfooded)

### v0.4 (planned)
- `gmk-loop` LangGraph upgrade (currently a dispatcher; v0.4 adds branching policies)
- Cross-milestone economy normalization (currently each milestone is balanced independently)

### Never (out of scope, structurally)
- Release / live-ops / Steam pipeline automation
- External-tester feedback channels (Discord, itch comments, etc.)
- 3D / MMO / real-time PvP
- Consumer vibe-coding market (the kit is for engine users who want risk reduction)
- Two-way sync with external tools (Notion ↔ gmk, Linear ↔ gmk, etc.)

---

## 11. First-week priorities (for a new user)

1. `/gmk-init` — define 3-5 pillars, pick engine, confirm genre envelope.
2. `/gmk-roadmap` — decompose into 3-5 milestones with dependencies.
3. `/gmk-shape-advisor m1` — pick prototype shape.
4. `/gmk-prototype m1` — generate HTML scaffold.
5. `/gmk-validate m1` — 200 bot trials, see what the personas say.
6. `/gmk-self-test m1` — play the suspicious runs, decide if it's fun.
7. (Only after both PASS) `/gmk-port m1 --to godot` — generate engine code, run 6-stage re-validation.

Most users will iterate steps 4-6 multiple times before reaching step 7. That's the entire point.

---

## 12. Open questions (deferred to v0.3+)

- **Shader prototype visual diff**: ROI selection is currently manual; can it be automated from the spec doc?
- **Cross-milestone hypothesis dependencies**: when m3's hypothesis assumes m1's PASS still holds, regression catches drift — but how to express the assumption upfront in the schema?
- **Persona library extension**: 4 personas cover the common cases for 2D / deterministic / ≤5min; what's the next persona for narrative-heavy or roguelike loops?
- **`gmk-port` Unity path**: spec is symmetric with Godot, but Unity's batch-mode quirks (asset DB, Library/) need real dogfood before v0.3 calls it production-ready.

---

## 13. The 4-axis frame

Every gmk skill belongs to one (or two adjacent) of these four axes. The frame is the kit's organizing principle — when adding a skill, the first question is "which axis?". If the answer is "all four" or "none", the skill is wrong.

| Axis | Core decision | Daily pain it addresses |
|---|---|---|
| **1 — Time** | "Does this milestone strengthen a pillar? What's next? When do we stop?" | Losing direction; not knowing how to declare done |
| **2 — Discipline** | "Which discipline is blocked? What's the priority? If art is late, what can code do?" | Cross-discipline desync |
| **3 — Validation** | "Are 200 bot trials enough? When do I self-test? Which suspicious run do I open first?" | User's time + objectivity |
| **4 — Integration** | "Is this merge risky? Asset conflicts? Secret leakage? Does the port preserve feel?" | Integration bombs |

The cycle through axes 1 → 2 → 3 → 4 → 1 is what the kit calls the **milestone loop**. `/gmk-loop` is a thin dispatcher around this cycle; it does not over-orchestrate (max-iteration=1).

---

## 14. Competitive landscape

### vs. Claude-Code-Game-Studios (18.2k ★, 72 skills)

| Dimension | gamemaker-kit v0.2 | CC-Game-Studios |
|---|---|---|
| Claude Code plugin | ✓ | ✓ |
| Milestone workflow | ✓ | ✓ |
| Pillar JSON schema **enforced** | ✓ | ✗ |
| Hypothesis JSON schema **enforced** | ✓ | ✗ |
| HTML single-file prototypes | ✓ | ✗ |
| Playwright bot self-play | ✓ | ✗ (checklists only) |
| Procedural personas (4) + suspicious-run extraction | ✓ | ✗ |
| Asymmetric self-test verdict (FAIL: own-play; PASS: coded) | ✓ | ✗ |
| HTML → engine port with 6-stage re-validation | ✓ | ✗ |
| Merge gate (asset conflict + secret scan) | ✓ | ✗ |
| Capture-but-don't-apply regression | ✓ | ✗ |
| Killable milestones (Cleveland rule) | ✓ | ✗ |
| Development-completion endpoint (release out of scope) | ✓ | ✗ (release-inclusive) |
| Skills | ~28 | 72 |
| Stars | 0 | 18.2k |

**Positioning**: small + sharp + four-axis coverage, not breadth.

### vs. godogen (3.2k ★)

godogen does direct-to-engine generation with screenshot self-repair. gmk validates at the HTML layer first and re-validates on port — **complementary**, not competitive. A user could use godogen for non-mechanic content (UI, screens, art mock-up tooling) and gmk for mechanic milestones.

### vs. Rosebud / Astrocade (consumer vibe-coding)

Different market entirely. gmk's ICP is **"engine users with existing projects who want risk reduction before committing engine code"** — not first-time consumers playing with prompt-driven games. Consumer vibe-coding is explicitly out of scope.

---

## 15. Academic honesty — what the kit cannot do

The kit's word for what bots produce is **falsification**, not validation. The distinction is load-bearing.

### What bots can do (with calibrated confidence)
- Detect crashes, infinite loops, broken hooks
- Detect dominant strategies (one action class > 50% of all actions)
- Detect state starvation (unreachable states; coverage < 0.5)
- Detect frustration-proxy spikes (long action streaks with no state change)
- Detect pacing-curve outliers (duration p50 outside hypothesis target)

### What bots cannot do (no matter how many trials)
- Judge whether a mechanic is **fun**
- Judge whether a visual is **beautiful**
- Judge whether an audio cue is **satisfying**
- Judge whether a narrative branch is **interesting**

The IEEE Spectrum coverage of automated-playtest research, the HN consensus over 5+ years, and gmk's own dogfood all converge on the same finding: **fun is a property of subjective experience, not of metric distributions**. A bot can rule out "this is broken" or "this is dominated by one strategy" — but it cannot rule in "this is fun".

This is why the kit uses **asymmetric self-test verdicts** (FAIL is the user's own play; PASS is the coded summary), and why `shape: 'shader'` defaults to INCONCLUSIVE on the bot side. The user is the only authority on "fun" — the kit's job is to remove the things that get in the way of the user's own judgment (broken bots, ignored outliers, balance bugs that pollute the play test).

### What the kit refuses to claim
- That it has "validated" fun.
- That it can replace human testers entirely (it replaces *external* testers; the user is still the tester).
- That it can predict release reception (release is out of scope).
- That higher bot trial counts buy higher confidence in fun (they buy higher confidence in non-fun-related metrics; fun stays the user's judgment).

The honesty here is a design principle, not just marketing language. Skills that drift toward "we've checked the fun" language are corrected during code review — the word "validate" is reserved for things that have an objective truth value.

---

*Background research: `_research/` (this folder). Implementation waves: `_workspace/extension-design.md`. Change log: `CHANGELOG.md`.*
