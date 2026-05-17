# gamemaker-kit

> Prototype game milestones in HTML, falsify "un-fun" with bots + your own play, port only what survives to Godot/Unity.
> **Release-readiness checkpoint: "development complete". Release and live-ops are out of scope by design.**

Claude Code plugin. Zero external accounts. ~28 skills + 4 domain agents covering 4 axes (time / discipline / validation / integration).

---

## Install

```bash
# In your Claude Code marketplace settings, add this directory as a plugin source.
# Or, from a Claude Code session:
/plugin install gamemaker-kit
```

Optional external tools (installed by you, when relevant skills need them):
- **Playwright** — required for `/gmk-validate`. `npm install -D playwright && npx playwright install chromium`
- **gitleaks** — recommended for `/gmk-merge-gate`. Falls back to a narrow regex set if missing.
- **Godot CLI** or **Unity batchmode** — required for `/gmk-port` Stages 2-3 (you already have one of these).

No accounts. No API keys. No telemetry.

---

## First-week workflow

```bash
/gmk-init                       # define 3-5 pillars, pick engine, confirm supported genre
/gmk-roadmap                    # decompose into 3-5 milestones with dependencies
/gmk-shape-advisor m1           # pick prototype shape (grid / continuous / dialogue / shader)
/gmk-prototype m1               # generate single-file HTML with __gmk_botHook__ baked in
/gmk-validate m1                # 4 personas × 50 trials = 200 default
/gmk-self-test m1               # play the suspicious-run subset yourself
/gmk-port m1 --to godot         # only if BOTH validate + self-test PASS
```

Most milestones loop `/gmk-prototype` → `/gmk-validate` → `/gmk-self-test` several times before `/gmk-port`. That's the whole point.

---

## Skills (~28)

### Common / axis infrastructure
| Skill | Purpose |
|---|---|
| `/gmk-init` | Pillars + vision + supported-genre check |
| `/gmk-roadmap` | Milestone decomposition + dependency graph |
| `/gmk-brainstorm` | Opt-in 5-stage diverge/converge (MDA lens) |
| `/gmk-task-split` | Milestone → per-discipline backlog |
| `/gmk-status` | Dashboard + kanban + blocker detection + next-action |
| `/gmk-loop` | Minimal dispatcher (Plan → Build → Validate → Integrate) |

### Methodology / HTML prototyping rulebook ★
| Skill | Purpose |
|---|---|
| `/gmk-prototype-rules` | 300/600-line cap, `__gmk_botHook__` API contract |
| `/gmk-shape-advisor` | Pick shape: grid / continuous / dialogue / shader |
| `/gmk-portability-check` | Porting-risk catalog (hallucination-likely patterns) |
| `/gmk-mechanic-merge` | Combine two validated prototypes into an integration milestone |
| `/gmk-kill-milestone` | Cleveland-rule trigger to retire + restart |
| `/gmk-mock-inject` | Placeholder asset / dependency injection |

### Per-discipline
| Skill | Discipline |
|---|---|
| `/gmk-design-system` | systems + state machines + invariants |
| `/gmk-content-plan` | 5 curve shapes (flat / stairs / ramp / wave / bell) |
| `/gmk-prototype` | HTML scaffold with hypothesis guard |
| `/gmk-refactor-check` | LOC / branches / nesting thresholds |
| `/gmk-art-spec` | asset spec + palette lock + style anchors |
| `/gmk-art-gen` | `/art` (ComfyUI) wrapper |
| `/gmk-sound-plan` | SFX table + 3 BGM types |
| `/gmk-ux-flow` | flow + FTUE + input map + 5 accessibility floors |
| `/gmk-narrative` | branch tree + line counts (optional) |
| `/gmk-save-migrate` | schema delta + migration + rollback |

### Validation / integration
| Skill | Purpose |
|---|---|
| `/gmk-validate` | 4 personas × 50 trials, suspicious-run extract (~20), trial pruning at 30, CI-aware row evaluation |
| `/gmk-self-test` | Own-play notes + suspicious-run priority; asymmetric verdict (FAIL: own-play wins; PASS: coded wins) |
| `/gmk-regression` | Re-run prior PASS milestones; **capture-but-don't-apply** (verdict downgrade only on `--accept-regression`) |
| `/gmk-platform-check` | 6-category pattern scan (browser API / viewport / touch+mouse / keyboard / audio autoplay / storage) |
| `/gmk-merge-gate` | Regression + asset conflict + secret scan (gitleaks preferred, narrow fallback) |
| `/gmk-port` | 6-stage: Generate → Compile → Smoke → Metric diff → Checklist → Human RE-PASS |

### Domain agents (4)
Invoke via `@<name>` or have a skill route to them.
| Agent | Domain |
|---|---|
| `@systems-designer` (opus) | System shape, state machines, invariants, coupling — pre-prototype |
| `@feel-engineer` (sonnet) | Hit-stop, shake, lerp, easing, SFX gain — post-system, pre-validate |
| `@economy-balancer` (opus) | XP curves, drop rates, tier caps, dominant-strategy avoidance |
| `@playtest-analyst` (opus) | The **only** agent that reads trial logs. Diagnoses + routes. Never edits. |

**Safety architecture**: `playtest-analyst` is the one-way valve for log access — other agents must wait for its routing. No agent-to-agent calls. All agents `max-iteration=1`. (MAST-aligned; see `CONCEPT.md` §4.)

---

## What the kit refuses to do

These are **structural** refusals — preconditions that, when missing, produce a fixed refusal text rather than a "partial" deliverable.

- `/gmk-prototype` refuses if `pillars_targeted: []`. ("A milestone that targets no pillar is decoration.")
- `/gmk-validate` refuses if `__gmk_botHook__` fails the 5-point smoke check.
- `/gmk-port` refuses if either `validation.verdict !== 'PASS'` or `self_test.latest_verdict !== 'PASS'`. **Both** must pass, not either.
- `/gmk-merge-gate` refuses on regression FAIL, asset conflict on non-prototype paths, or secret detection.
- `@economy-balancer` refuses without a structured `target: {op, value}` row to anchor to.
- `@playtest-analyst` refuses "fix it" requests — it only diagnoses + routes.

---

## What "fun" means here

The kit's word for what bots produce is **falsification**, not validation. Bots can rule out "broken / dominated / starved / spiky" — they cannot rule in "fun". Fun stays the user's judgment, every milestone, no exceptions.

This is why:
- `/gmk-self-test` exists alongside `/gmk-validate`.
- Verdict is asymmetric: **FAIL is the user's own play; PASS is the coded summary**.
- `shape: 'shader'` defaults to INCONCLUSIVE on the bot side.

See `CONCEPT.md` §15 for the academic-honesty framing.

---

## Supported genres

Calibrated for:
- **2D**
- **Deterministic input** (no <100 ms twitch reflex floors)
- **Sessions ≤ 5 minutes**

Outside this envelope the kit still runs but validation gates degrade — you'll see the warning at `/gmk-init`. **3D, MMO, real-time PvP, and AAA-narrative are Phase 3 (or never).**

---

## Out of scope (forever, by design)

- Release / live-ops / Steam pipeline automation
- External-tester feedback channels (Discord, itch comments, etc.)
- Two-way sync with external tools (Notion ↔ gmk, Linear ↔ gmk)
- Consumer vibe-coding market (the kit is for engine users with existing projects)
- AI judging "fun"

If a feature request lives in one of these buckets, it gets a structural "no". This is the kit's promise to the user — see `CONCEPT.md` §10.

---

## Files in your project

```
your-game/
├─ <engine>/                       # the actual engine project
├─ prototypes/                     # gmk-managed HTML prototypes
├─ .gamemaker-kit/                 # kit state (track in git)
│   ├─ pillars.json
│   ├─ milestones.json
│   ├─ validations/<m>/            # bot 200×4 results + suspicious/
│   ├─ self-tests/<m>/             # your own-play notes
│   ├─ merge-gates/<m>.md
│   └─ port-checklists/<m>.md
└─ _workspace/                     # your daily-driver markdown view
    ├─ vision.md
    ├─ roadmap.md
    ├─ dashboard.md
    └─ milestones/<id>/
        ├─ system-spec.md          # @systems-designer output
        ├─ feel-numbers.md         # @feel-engineer output
        ├─ economy-numbers.md      # @economy-balancer output
        └─ playtest-diagnosis-*.md # @playtest-analyst output
```

VS Code reads it. Git versions it. Notion / Linear can mirror it one-way. **gmk never syncs back.**

---

## Comparison

| | gamemaker-kit v0.2 | CC-Game-Studios | godogen |
|---|---|---|---|
| Claude Code plugin | ✓ | ✓ | ✗ |
| Milestone workflow | ✓ | ✓ | ✗ |
| Pillar / hypothesis schema enforced | ✓ | ✗ | ✗ |
| HTML single-file prototypes | ✓ | ✗ | ✗ |
| Playwright bot self-play | ✓ | ✗ | ✗ |
| 4 procedural personas + suspicious-run | ✓ | ✗ | ✗ |
| HTML → engine port with 6-stage re-validation | ✓ | ✗ | ✗ (direct to engine) |
| Merge gate (asset conflict + secret scan) | ✓ | ✗ | ✗ |
| Capture-but-don't-apply regression | ✓ | ✗ | ✗ |
| Skills | ~28 | 72 | n/a |
| Stars | 0 | 18.2k | 3.2k |

**Positioning**: small + sharp + four-axis coverage. Not breadth.

---

## License

MIT.

## Documentation

- `CONCEPT.md` — full design rationale, 4-axis frame, schema spec, academic honesty (§15).
- `CHANGELOG.md` — version history + migration notes (v0.1 → v0.2).
- `_workspace/extension-design.md` — implementation design (internal).
- `skills/<skill-name>/SKILL.md` — per-skill spec (read these for exact CLI flags).
- `agents/<agent-name>.md` — per-agent spec (preconditions, deliverables, safety model).

## Issues

GitHub: https://github.com/chodolmu/gamemaker-kit
