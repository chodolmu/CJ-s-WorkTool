---
name: gmk-self-test
description: Walk the user through a structured self-test session for a milestone — playing their own prototype, reviewing the ~20 suspicious bot seeds /gmk-validate flagged, recording free-form notes, then thematic-coding the user's *own* notes (not external feedback) to compute pass/fail on the self-test rows of the hypothesis. Writes to milestones.json under self_test. Use when the user says "/gmk-self-test <name>", "테스트 세션", "내가 직접 플레이 검증", "code my notes", or has finished a play session and wants the subjective half of milestone gating. Run AFTER /gmk-validate has produced bot results + suspicious-seed catalog. No external humans — gmk's scope is development-completion, and the user attests to fun themselves.
model: sonnet
---

# gmk-self-test — Play it yourself, code your own notes, gate the milestone

The bot's already told you whether the prototype is broken or shallow. This skill does the half the bot can't: **did the prototype feel the way the hypothesis predicted, to the one person whose verdict actually matters — you?**

`gmk-self-test` replaces v0.1's `gmk-feedback`. The kit's scope is **development completion**, not external playtesting. There is no Discord scraping, no tester-pool messaging, no friend-of-friend distribution skill. You play the prototype, you write notes, the kit codes the notes. External-human feedback collection (Steam reviews, Discord beta, friends-and-family playtests) is out of scope — collect it through your own channels if you want it.

## Why "your own notes," not "vibes"

A pile of half-finished thoughts after a 20-minute play session is unstructured. Without method, you remember the last thing you noticed, call it the verdict, and ship a milestone the prototype didn't actually pass.

Thematic coding is the cheap version of qualitative research, applied to one person — yourself:

1. Play the prototype, including the suspicious-bot seeds the validator flagged.
2. While playing, write notes in your own words.
3. After playing, the skill reads your notes, tags them with codes (`said-satisfying`, `lost-after-30s`, `confused-by-controls`, etc.).
4. Counts codes across this session and previous sessions.
5. Compares to what the hypothesis said would happen.

Coding the user's *own* notes is not the same as coding external testers. You are not your own tester — you wrote the hypothesis, the prototype, and the notes. The point of coding is to slow you down enough that the loudest sentence in your last 20 minutes doesn't get to overrule the rest.

## Preconditions

1. **Milestone exists** in `.gamemaker-kit/milestones.json`.
2. **Validation has run** (`validation` block present on the milestone, in one of these accepted states):
   - `validation.verdict === "PASS"`: proceed normally.
   - `validation.verdict === "FAIL"`: warn but allow override with `--force`. *"Bot validation failed. Self-testing a prototype the bot says is broken is information about your tolerance for jank, not the mechanic. Fix or kill first?"*
   - `validation.verdict === "INCONCLUSIVE"` AND milestone's `shape === "shader"`: **accept**. Shader-shape milestones return INCONCLUSIVE by design (see `gmk-prototype-rules` Rule 11); self-test is the gate, not bot. Proceed normally — no `--force` needed. `[Rule 14] /gmk-self-test ← /gmk-validate — verified shader INCONCLUSIVE is an accepted precondition state, not a dead-end.`
   - `validation.verdict === "INCONCLUSIVE"` AND shape ≠ shader: warn but allow override with `--force`. *"Bot validation was inconclusive on a non-shader milestone. Usually this means too few runs or a stuck prototype. Re-run /gmk-validate with --sample-size 400, OR --force into self-test if you trust your eyes here."*
   - `validation.skipped === true` (a deliberate `/gmk-validate --skip --reason "..."`): accept. The skip reason is visible in the play menu so the user knows the bot-row half of the verdict was intentionally empty. `[Rule 14] /gmk-self-test ← /gmk-validate --skip — verified explicit skip is an accepted precondition state.`
   - If `validation` is missing entirely: stop with *"Run /gmk-validate first. Without bot validation, there are no suspicious-seed runs to prioritize and the bot-row half of the verdict is empty. [Rule 14] /gmk-self-test → /gmk-validate — verified target's preconditions can be satisfied from current state."*
3. **Self-test rows exist** in the hypothesis. Filter `hypothesis.measured_by` to `kind === 'self-test'`. If zero such rows:
   - Tell the user *"This milestone's hypothesis has no self-test rows. Either it's bot-only by design (rare smell — pure-bot hypotheses can't tell you about feel), or you forgot to add one. Add a self-test row in milestones.json or run /gmk-prototype again, then come back."*
   - Stop.
4. **Hypothesis header migration check.** Open `prototypes/<name>.html` header comment. If it contains `human:` rows in `MEASURED BY`, warn once and offer to migrate to `self-test:` (per `gmk-prototype-rules` Rule 10). Apply the migration only with user confirmation; don't rewrite silently.

_Standard preconditions (milestone-id resolution, empty/partial state, refuse-chain cycle guard, kit_version read contract, pillars.kind read contract) follow `gmk-prototype-rules` Rule 13-14, 16, 17._

## Flow

### Step 1 — Locate the play surface

Read the milestone's `prototype` path. Confirm the file exists. Build the **play menu** the user will work through:

```
Self-test plan — m1-merge-feel
  Prototype: prototypes/m1-merge-feel.html

  Suspicious bot seeds queued for replay (in priority order):
    1. seed=17 — entropy-low (bot did the same thing 47 times)
    2. seed=42 — entropy-low (similar pattern, different persona: Treasure)
    3. seed=88 — entropy-high (bot flailed, action_entropy 3.1 bits)
    4. seed=3  — duration-bottom (run died in 11 sec)
    5. seed=199 — crashed (reason: 'collectSummary: undefined')
    ... (up to ~20 total)

  Open-play (no specific seed): always available — just load the prototype.

  Hypothesis (self-test rows):
    - user_says_satisfying       target: PASS (your call)
    - decision_tension_felt      target: PASS (your call)

  Suggested session length: 15-25 min. Less than 10 min and the notes are too thin to code.

Ready to play? When you finish, run /gmk-self-test <name> --record and I'll prompt for notes.
```

If `validation.suspicious_seeds` is empty (rare — usually means a tiny trial or no outliers detected), surface a single line saying "no suspicious seeds — open-play only" and continue.

If `_workspace/milestones/<id>/ux-flow.md` exists, read it and surface its FTUE checklist alongside the play menu — these are things the user authored as "what should happen the first time someone plays". The user verifies those during the session and reports back in Step 2 (one of the optional prompt fields). Without the file, this section is silently skipped.

If the user runs the skill without `--record` flag, this is all the skill does — print the play menu and stop. Recording happens in the next invocation. (Splitting "plan the session" from "code my notes" keeps the play session itself screen-free of the kit.)

### Step 2 — Record the session (`--record` flag)

When the user comes back with `/gmk-self-test <name> --record`:

Prompt them through the session note template (see structure.md → `.gamemaker-kit/self-tests/<m>/session-{date}.md`). Show the template inline and ask them to fill it in their own words. **Do not** auto-generate notes. Do not fill in "what happened" by reading the validation results — you'd be coding what the bot did, not what the user felt.

Required fields (the skill refuses to save until all four are populated; the user can write "skip" in any field if they truly have nothing):

1. **Duration (min)** — how long they played.
2. **Suspicious seeds reviewed** — which of the queued seeds they actually replayed, freeform list (e.g. `17, 42, did not reach 88`).
3. **What happened in plain words** — paragraph or bullets. The user writes; the skill doesn't suggest content.
4. **Re: hypothesis** — for each self-test row, a verdict: `PASS | FAIL | NEEDS_MORE_PLAY`. This is the user's *own* gut call before coding.

Optional fields the skill prompts for but doesn't require:
- Suspicious-run-by-run notes (what the bot saw vs what the user saw)
- "Quotes from yourself you want to remember" — things the user blurted out while playing
- **FTUE check** (only if `ux-flow.md` exists): for each item in the ux-flow's FTUE checklist, did it land? `pass | fail | n/a`. A FAIL here is flagged in Step 4 as a `ftue-miss` theme so the user can correlate "felt off" with "the first 60 seconds didn't go as planned".

Save to `.gamemaker-kit/self-tests/<m>/session-{YYYY-MM-DD}.md`. If a file with the same date already exists, append a `-{HH-MM}` suffix to disambiguate. **Session notes are immutable** once written — re-running this skill the same day creates a new session.

### Step 3 — Code the user's own notes

After saving the session note, run thematic coding **across all sessions for this milestone** (the just-saved one plus any prior ones).

For each session note, tag for each self-test row:

- `says_satisfying` — did the user use the word "satisfying" or a clear synonym ("juicy", "snappy", "feels good", "chunky", Korean equivalents like "손맛")? Note: the hypothesis row's metric name tells you which synonyms count. If the row says "satisfying," expand to near-synonyms; don't expand to unrelated positives ("fun", "cool"). Be strict — the hypothesis was written precisely.
- `decision_tension_felt` — did they describe weighing options, hesitating, "do I push my luck"-type language?
- `completed_first_run` — did they describe finishing/winning OR explicitly say they bounced before a clear endpoint?
- ... whatever the self-test rows specify.

For each row, count distinct sessions (not distinct sentences within one session) that hit the code. A user who writes "satisfying" three times in one session counts as 1 toward `says_satisfying`.

Output a per-row tally:

```
Row: user_says_satisfying
  Target: PASS (your call)
  Hits  : 2026-05-09 ("really satisfying when they pop"),
          2026-05-12 ("the thunk is the right kind of chunky")
  Misses: 2026-05-10 (no relevant language)
  Sessions: 2/3 (last verdict from user: PASS)
  Coded verdict: PASS  (matches user's own call)
```

If a synonym call is judgment-heavy, surface it:

```
  Edge case: 2026-05-11 said "smooth" — sometimes synonymous with "satisfying"
             in game-feel contexts, sometimes a control/responsiveness comment.
             Coded: NO (responsiveness ≠ satisfaction).
```

Don't hide edge cases. The user reads them and will overrule when wrong.

### Step 4 — Open-ended themes pass

Independent of the hypothesis, tag the notes for themes that emerged unprompted. Useful categories:

- **What landed.** `discovery-moment`, `lost-track-of-time`, `wanted-more`, `replayed-immediately`.
- **What missed.** `confused-by-controls`, `bored-after-30s`, `bounced-before-mechanic-appeared`, `said-jam-feeling`.
- **What broke.** `crashed`, `softlocked`, `couldnt-figure-out-goal`, `frame-rate-bad`.
- **What surprised.** `expected-different-genre`, `compared-to-Y`.
- **Pillar-violation flags.** Cross-reference against `pillars.json` `anti_examples`. If the user's own words match an anti-example, **flag loudly**.

Pillar-violation hits are alarms. The whole point of anti-examples (set in `/gmk-init`) is that the user pre-committed to "if this language appears, the pillar is broken." When the user later writes that exact thing — even about their own prototype — the pre-commitment fires. Don't soften.

### Step 5 — Suspicious-seed correlation

For each suspicious seed the user reviewed (from Step 2 field 2), correlate:

| Seed | Bot's reason | User's note (verbatim) | Agreement? |
|---|---|---|---|
| 17 | entropy-low | "I see why — there's no reason to do anything but merge red" | bot+user agree (mechanic-too-narrow signal) |
| 42 | entropy-low | "weird, I had way more variety when I played" | bot+user disagree (Treasure persona may be too greedy) |
| 88 | entropy-high | "I didn't review this one" | n/a |

Agreement patterns to call out:

- **Bot+user agree on a problem** → high-priority signal. Cite the seed numbers in the verdict.
- **Bot says problem, user says fine** → the persona may be biased. Suggest re-running `/gmk-validate` with the offending persona alone (`--policy treasure`) to confirm.
- **User says problem, bot didn't flag it** → the bot's metric set is missing a signal the user noticed. Note for hypothesis refinement (the user may want to add a bot row that catches this).
- **No agreement either way** → low signal; don't overweight.

### Step 6 — Compute hypothesis verdict

For each self-test row, mark PASS / FAIL / INCONCLUSIVE from Step 3 tallies plus the user's own call:

- The coded verdict and the user's own field-4 verdict should agree most of the time. When they disagree, **the user's gut call wins for FAIL but the coded verdict wins for PASS.** Reason: a user who writes "satisfying" twice and then types `verdict: FAIL` is signaling something the language missed — trust the FAIL. A user who writes nothing satisfying-like and types `verdict: PASS` is rationalizing — trust the coded read.

Aggregate verdict (mirrors `/gmk-validate`'s structure for consistency):

- **PASS** — every self-test row passes AND no pillar-violation flags fired.
- **FAIL** — any self-test row fails OR any pillar-violation flag fired.
- **INCONCLUSIVE** — fewer than 2 sessions for this milestone, OR a row's verdict depends on edge-case judgment calls the user should review.

### Step 7 — Write back to disk

Two writes:

1. `.gamemaker-kit/self-tests/<m>/coded.md` — overwrite with the latest coding across all sessions for this milestone (template per `structure.md`).

2. `.gamemaker-kit/milestones.json` — merge under the milestone:

   ```json
   {
     "id": "m1-merge-feel",
     "self_test": {
       "latest_verdict": "PASS",
       "latest_session_path": ".gamemaker-kit/self-tests/m1-merge-feel/session-2026-05-12.md",
       "latest_session_at": "2026-05-12",
       "pillar_violations": [],
       "verdict_reason": "Both self-test rows passed across 2 sessions. No anti-example matches. Bot+user agreement on seeds 17, 42.",
       "coded_at": "2026-05-12T22:15:00Z"
     }
   }
   ```

   **v0.4 deprecation**: do NOT write `self_test.sessions[]` body or `self_test.coded_themes` (deprecated — see `structure.md` § v0.4 deprecated fields). The full session history lives on disk at `.gamemaker-kit/self-tests/<m>/session-{date}.md` (immutable) + `coded.md` (latest roll-up); the milestones.json block keeps only the *latest pointer*.

Do NOT touch `validation`, `merge_gate`, `ported_to`, `tasks`, `killed`, or anything else. Self-test only owns the `self_test` block.

If a previous `self_test` block exists, **overwrite** the rolled-up fields (`latest_verdict`, `latest_session_path`, `latest_session_at`, `verdict_reason`, `coded_at`). Prior session files on disk are preserved; their history is recoverable from filesystem timestamps.

If a v0.1 `human_feedback` block exists on the milestone (from before the v0.2 rename), migrate it: rename the key to `self_test_legacy`, leave the data, write the new `self_test` block as usual. Print a one-time note that v0.1's `human_feedback` is preserved for archive purposes.

### Step 8 — Print the report

Plain text. Long-form OK — the user reads carefully.

```
m1-merge-feel — SELF-TEST: PASS

  Sessions: 2 (2026-05-09, 2026-05-12)   Total play time: 40 min
  Suspicious seeds reviewed: 17, 42, 88 (session 1) · 3, 199 (session 2)

  Hypothesis (self-test rows):
    ✓ user_says_satisfying       target: PASS (your call)
        hits  : 2026-05-09 "really satisfying when they pop"
                2026-05-12 "the thunk is the right kind of chunky"
        coded : PASS    your call: PASS

    ✓ decision_tension_felt      target: PASS (your call)
        hits  : 2026-05-09 "I kept second-guessing the red merge"
        misses: 2026-05-12 (no tension language)
        coded : INCONCLUSIVE (1 of 2 sessions)    your call: PASS
        → Resolved PASS (your call carries for ambiguous coded reads).

  Bot+user agreement on suspicious seeds:
    seed=17 (entropy-low)  — both flagged it: "no reason to do anything but merge red"
                             → mechanic-too-narrow signal corroborated.
    seed=42 (entropy-low)  — bot flagged, user disagreed:
                             "I had way more variety when I played"
                             → Treasure persona may be too greedy.
                             Consider /gmk-validate <name> --policy treasure to confirm.

  Open themes (across sessions):
    says-juicy                 : 2  (2026-05-09, 2026-05-12)
    wanted-more-variety        : 1  (2026-05-09)

  No pillar-violation flags fired.

Both gates clear (bot validation PASS + self-test PASS).

Next:
  /gmk-port m1-merge-feel --to godot
    Converts the validated mechanic to GDScript and integrates into your
    Godot project. Outputs a port-checklist for things that don't auto-
    translate (game feel numbers, audio, physics).
```

Example for FAIL:

```
m1-merge-feel — SELF-TEST: FAIL

  Sessions: 1 (2026-05-12)   Total play time: 18 min
  Suspicious seeds reviewed: 3, 17, 199

  Hypothesis (self-test rows):
    ✗ user_says_satisfying       target: PASS (your call)
        your call: FAIL  ("felt instant and weightless")
        coded   : FAIL (matched anti-example, not synonym list)

  PILLAR VIOLATION:
    ✗ tactile-satisfaction
        anti-example: "Merging two dragons feels like clicking a button on
                       a spreadsheet — silent, instant, weightless."
        you wrote   : "felt instant and weightless"
        Near-direct match. The pillar's stated failure mode happened.

  Open themes:
    bored-after-30s            : 1
    confused-by-controls       : 1

  Bot+user agreement on suspicious seeds:
    seed=17 (entropy-low)  — both flagged it.
    seed=3  (duration-bottom) — both saw the run end fast.

Why FAIL:
  Your own verdict was FAIL, your notes hit the tactile-satisfaction anti-
  example almost verbatim, and the bot's suspicious seeds corroborate the
  same shape of problem (no decision variety + fast death).

  This is the pre-committed failure mode. The pillar isn't landing in this
  prototype shape.

Next:
  - Re-read your own session note — that's the most expensive piece of
    feedback in this round.
  - @feel-engineer m1-merge-feel — sensory FAIL. Agent reads your notes for
    sensation words (weak, limp, 휙, 둔탁) and proposes hit-stop / shake /
    particle adjustments with auditable range sweeps.
  - @playtest-analyst m1-merge-feel — if you want a structured diagnosis of
    what pattern (sensory miss vs. systemic vs. balance) before fixing.
  - /gmk-kill-milestone m1-merge-feel  — log the lesson, advance.

  Do NOT /gmk-port until this gate flips to PASS.
```

### Step 8.5 — Route to domain agents on FAIL

When the verdict is **FAIL**, the "Next:" block must include the closest domain-agent route. Routing rules (apply in order, stop at first match):

Read the pillar's `kind` field first (per gmk-prototype-rules Rule 17). If `kind` is absent, fall back to free-text classification on the pillar's `name` + `description` (the pre-v0.8 behavior — match sensation words like "tactile", "responsiveness", "juicy", "chunky").

| Condition | Recommended agent | Why |
|---|---|---|
| Pillar-violation flag fired AND the pillar's `kind` is `"sensory"` (or, on `kind` absent, free-text matches tactile / responsiveness / juicy / chunky language) | `feel-engineer` | Sensory miss — agent's catalog of feel parameters applies directly. The pillar's anti-example already named the failure word. |
| User's notes mention sensation words (`limp`, `weak`, `미적지근`, `휙`, `둔탁`, `no impact`) | `feel-engineer` | Same as above; sensation words are the agent's trigger. |
| Bot validation PASS but self-test FAIL | `feel-engineer` first, `playtest-analyst` second | "Sensory miss" pattern (bot OK + self-test FAIL on sensation). If the language isn't clearly sensory, route to playtest-analyst for diagnosis. |
| User explicitly says "I don't know why it feels off" | `playtest-analyst` | The analyst reads logs + your notes and routes — useful when you have a FAIL gut but no clear cause word. |
| Self-test row about decision tension / engagement (non-sensory) FAILed | `playtest-analyst` | Engagement issues often need log-level diagnosis (state coverage, persona spread). |

The route is a **recommendation**, never auto-invoke. The user reads, decides, runs `@feel-engineer <id>` or `@playtest-analyst <id>` themselves.

_The routing output follows `gmk-prototype-rules` Rule 15 (agent routing block format)._

Reasoning: v0.2 left self-test FAIL as "user-figures-out". v0.3 wires the closest expert. Sensory miss has a specific agent (`feel-engineer`); diffuse FAIL has the diagnostic agent (`playtest-analyst`).

## Sub-flags

| Flag | Default | Effect | Side-effect |
|---|---|---|---|
| `--record` | — | Switches the skill from "show the play menu" to "prompt for notes and code them". Without `--record`, the skill stops at Step 1 (planning). | Writes the session file `.gamemaker-kit/self-tests/<m>/session-{date}.md` (immutable, on disk) + updates `self_test.{latest_verdict, latest_session_path, latest_session_at, verdict_reason, coded_at}` on milestones.json. Does NOT write `self_test.sessions[]` body or `self_test.coded_themes` (both deprecated in v0.4). |
| `--force` | — | Allows running self-test even if `validation.verdict === 'FAIL'`. Useful when the user wants to characterise *what* the bot saw as bad, not validate the prototype. | None — milestones.json unchanged structurally. |
| `--thin-ok` | — | Accept a session with < ~80 words of notes. Default behavior is INCONCLUSIVE on note quality regardless of code hits; this flag overrides that gate. | Adds a `thin_ok: true` line at the top of that day's session.md file. Does NOT write to milestones.json (the rolled-up `latest_verdict` already encodes the outcome; the thin-acceptance lives next to the notes themselves). |
| `--launch` | `off` | Opens the prototype in the user's default browser before prompting for notes. Off by default — the skill prefers not to enforce a player. | None. |

## Edge cases & policy

### Notes written in non-English

Code in whichever language they're in. Don't translate to "normalize" — translation drifts the meaning of feel-words. Concept-match, not literal-match. Example: hypothesis row says `says_satisfying`, the user's Korean note says `손맛 좋다` — that hits the code. Surface the original quote in the report.

### Sarcasm / negative framings of positive words

"It's *so* satisfying I want to throw my phone." Don't count as `says_satisfying`. Read tone. If unsure, surface the quote and note the ambiguity rather than silently picking a side.

### User wrote nothing or three sentences

Less than ~80 words of "what happened in plain words" → INCONCLUSIVE on note quality regardless of code hits. Tell the user *"This session's notes are too thin to code reliably. Play again with notes alongside, or accept this session at face value (use --thin-ok)."*

### User's own verdict contradicts their own notes

Notes hit `says_satisfying` three times, user wrote `verdict: FAIL`. Trust the FAIL (Step 6 rule). Print both:
```
  Coded read    : PASS (3 hits of says-satisfying)
  Your call     : FAIL ("but it felt off in a way I can't name")
  → Resolved FAIL (your gut wins for FAIL when coding disagrees).
```
This is correct behavior: a user who flags FAIL despite "satisfying-ish" language is signaling something the words missed.

### Re-self-testing after more play

User does session 1 (INCONCLUSIVE), plays more for two days, runs `--record` again. The skill should:
- Append the new session note (immutable; never edits old session files).
- Re-code from scratch across *all* sessions (don't try to merge old codings — coding is cheap, drift is expensive).
- Overwrite `coded.md`. Update `self_test.{latest_verdict, latest_session_path, latest_session_at, verdict_reason, coded_at}` on milestones.json (do NOT write `coded_themes` — deprecated in v0.4; the per-theme coding lives in `coded.md` on disk).

### Suspicious seed list is stale

The user re-runs `/gmk-validate` after self-testing, generating a new suspicious-seed catalog. The next `/gmk-self-test --record` uses the new list (the skill always reads the *latest* `validation.suspicious_seeds`). Old session notes still reference the old seeds — that's correct history.

### `shape: 'shader'` milestones

Bot validation produces `INCONCLUSIVE` (no decision space). Self-test is essentially the whole gate. The skill works the same — except the suspicious-seed list is empty, so the play menu just says "open-play only" and the user judges purely on their own play.

### v0.1 migration: `human:` rows in hypothesis header

Per `gmk-prototype-rules` Rule 10, `kind: 'human'` is deprecated. If the milestone's `hypothesis.measured_by` still has `kind: 'human'` rows, warn once and treat them as `kind: 'self-test'` for this run. Offer to migrate `milestones.json` permanently. Don't migrate silently — the user should know the rename happened.

### `gmk-feedback` invocation (deprecated alias)

If the user types `/gmk-feedback`, treat it as a legacy alias for `/gmk-self-test` with a one-time warning: *"`/gmk-feedback` is renamed to `/gmk-self-test` in v0.2 — external-human feedback is out of scope. Same flow, run continuing."* Don't fail on the old name; the alias is courtesy. The skill directory itself is `gmk-self-test`; the CHANGELOG entry in Wave D documents the rename.

## What this skill does NOT do

- **Doesn't ingest external-human feedback.** Discord, Steam, friends, email — none of it. gmk's end-point is *development completion*. External feedback is collected through the user's own channels, after gmk's scope ends.
- **Doesn't fetch the play surface in a browser for the user.** They open the prototype themselves (or use a `--launch` flag if they want, but the skill doesn't enforce a player).
- **Doesn't auto-trigger /gmk-port on PASS.** Mirror `/gmk-validate`'s discipline: verdicts are advisory; the user decides next move.
- **Doesn't re-validate.** Bot and self-test gates are independent; if the user wants both fresh, they run both.
- **Doesn't redact or anonymize.** The user wrote the notes; the notes are saved verbatim.
- **Doesn't draft "thanks for playing" messages.** There's no one to thank but yourself.
- **Doesn't compute "sentiment scores."** "% positive of my own thoughts" is fake-precision noise. Code counts per code only.

## Notes for the model running this skill

- **The user is not their own tester.** They wrote everything in the loop, so coding's purpose is to slow them down, not to discover unknowns. Be honest in the coding pass; don't try to make the user feel good.
- **Anti-example matches are sacred.** Pre-committed at `/gmk-init` time as the failure mode the user bet against. If their *own words* hit one, do not soften. The user can override the verdict; you don't pre-soften.
- **Quote verbatim.** Paraphrasing kills the texture. The user wants their own words back, in context.
- **Don't try to fix the prototype.** That's not this skill. If the notes suggest a fix, mention it as a hypothesis to test, not a prescription.
- **Sample size matters but isn't sacred.** Two sessions agreeing strongly is better than five wavering. State both in INCONCLUSIVE cases.
- **Verdict reason is mandatory** — especially on FAIL/INCONCLUSIVE. The user needs to know which input drove the verdict so they can act.
- **The user's gut wins for FAIL, the coded read wins for PASS.** Asymmetric because the failure modes are asymmetric: a user who feels FAIL despite their own positive language is signaling something words miss; a user who feels PASS despite no positive language is rationalizing.
- **Migration warnings are once-per-session.** If `human:` rows appear, warn once, migrate (with consent), don't re-warn on the next invocation.
- **Cite `gmk-prototype-rules` when refusing.** "/gmk-self-test refused: hypothesis has no self-test rows (gmk-prototype-rules §10 — kind must be 'bot' or 'self-test')."
- **Don't reach for external channels in any error message.** No "share with friends and re-run" suggestions. That's out of scope; don't tempt the user toward it.
