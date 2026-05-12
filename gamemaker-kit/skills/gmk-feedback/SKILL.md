---
name: gmk-feedback
description: Ingest tester replies for a shared prototype, run thematic coding (group similar reactions, count keyword frequencies, separate signal from noise), and compute pass/fail on the human rows of the milestone hypothesis. Writes results to milestones.json under human_feedback. Use when the user says "/gmk-feedback <name>", "code feedback", "테스터 응답 분석", "did the prototype pass with humans", or has 3+ tester replies pasted/saved and wants the qualitative half of the milestone gate. Run AFTER /gmk-share has gone out and replies have come back.
model: sonnet
---

# gmk-feedback — Code the replies, gate the milestone

The bot's already told you whether the prototype is broken or shallow. This skill does the half the bot can't: **did humans react the way the hypothesis predicted?**

The job isn't to be diplomatic about the feedback. It's to read 5 to 50 messy human messages and answer the specific question the milestone hypothesis asked — yes, no, or not enough data.

## Why thematic coding (and not "vibes")

A pile of tester messages is unstructured. Without a method, the user reads them, remembers the loudest opinion, and calls it consensus. That's how prototypes with one enthusiastic friend and four bored testers ship.

Thematic coding is the cheap version of qualitative research:

1. Read every reply.
2. Tag each reply with one or more **codes** — short tags like `wanted-more-juice`, `lost-after-30s`, `said-satisfying`, `confused-by-controls`.
3. Count how many distinct testers raised each code.
4. Compare to what the hypothesis said would happen.

That's it. No NLP needed. The model running this skill IS the qualitative coder.

## Preconditions

1. **Milestone exists** in `.gamemaker-kit/milestones.json`.
2. **Validation passed** (`validation.verdict === "PASS"`).
   - If FAIL/INCONCLUSIVE: warn but allow override with `--force`. Tell the user *"Bot validation didn't pass. Human feedback on a broken prototype is information about humans, not about the mechanic. Want to fix and re-share first?"*
3. **At least one tester reply available.** Either:
   - User pastes replies inline ("here are the messages: ..."), OR
   - User points at a file: `/gmk-feedback <name> --from feedback.md`, OR
   - File exists at `.gamemaker-kit/feedback/<name>-inbox.md` (per-milestone inbox the user can append to as replies trickle in).
   - If none: stop with *"No tester replies to code. Paste them inline, save them to .gamemaker-kit/feedback/<name>-inbox.md, or use --from <path>."*

## Flow

### Step 1 — Gather and normalize replies

Collect tester replies from the configured source. Normalize each into:

```
{ tester_id: "T1" | "alice" | "anonymous-3", source: "discord" | "imessage" | "itch-comment" | "unknown", text: "..." }
```

If the user provides identifiers (names, handles), keep them. If not, assign `T1`, `T2`, ... in order of appearance. **Never invent identifiers** — if two unattributed messages might be the same tester, treat them as separate `T1` and `T2` and flag it in the report.

Strip obvious noise: timestamps, "[Image]", "[Reaction]", quote prefixes (`>`), reply chains where the user is replying to themselves. Keep emoji — they often *are* the feedback ("🤯", "😴").

If `< 3 testers`: do the coding anyway, but stamp the report `n=2 — INCONCLUSIVE on sample size alone`. Three is the floor for "not just one person's opinion"; five is where consensus starts to mean something.

### Step 2 — Read the hypothesis

Pull `hypothesis.measured_by` from the milestone, filter to `kind === "human"` rows. Examples:

- `{ metric: "tester_says_satisfying", target: "3 of 5", kind: "human" }`
- `{ metric: "tester_describes_decision_tension", target: "majority", kind: "human" }`
- `{ metric: "tester_completes_first_run", target: ">= 80%", kind: "human" }`

These rows define **what counts as success**. The coding pass below tags every reply for these specific signals, plus open-ended themes.

### Step 3 — First pass: hypothesis-targeted codes

For each tester reply, tag it for each human row:

- `says_satisfying` — did the tester use the word "satisfying" or a clear synonym ("juicy", "snappy", "feels good", "chunky")? Note: the metric language in the hypothesis tells you which synonyms count. If hypothesis says specifically "satisfying", expand to its near-synonyms; don't expand to unrelated positive words ("fun", "cool"). Be strict — the hypothesis was written precisely.
- `describes_decision_tension` — did they describe weighing options, hesitating, "do I push my luck"-type language?
- `completed_first_run` — did they describe finishing/winning/seeing a clear endpoint, OR explicitly say they bounced before getting there?
- ... whatever the human rows specify.

Output a per-row tally:

```
Row: tester_says_satisfying
  Target: 3 of 5
  Hits  : T1 ("really satisfying when they pop"), T3 ("juicy"), T4 ("feels chunky")
  Misses: T2 (no relevant language), T5 ("it's fine")
  Result: 3/5 — PASS
```

If a synonym call is judgment-heavy (e.g. "smooth" — does that count as "satisfying"?), include both readings and pick one with reasoning:

```
  Edge case: T6 said "smooth" — "smooth" is sometimes synonymous with "satisfying"
             in game-feel contexts but is also a control/responsiveness comment.
             Counted: NO (responsiveness ≠ satisfaction).
```

Don't hide the edge cases — they're where the user will overrule you, and that's correct.

### Step 4 — Second pass: open-ended themes

Independent of the hypothesis, tag each reply for themes that emerged unprompted. Useful tag categories:

- **What landed.** `discovery-moment`, `lost-track-of-time`, `wanted-more`, `replayed-immediately`, `screenshotted`.
- **What missed.** `confused-by-controls`, `bored-after-30s`, `bounced-before-mechanic-appeared`, `said-game-jam-feeling`.
- **What broke.** `crashed`, `softlocked`, `couldnt-figure-out-goal`, `frame-rate-bad`.
- **What surprised.** `expected-different-genre`, `compared-to-Y` (where Y is another game).
- **Pillar-violation flags.** Cross-reference against `pillars.json` `anti_examples` — if any tester language matches an anti-example, flag it loudly.

Output the top themes by tester count:

```
Open themes (tagged across all replies):
  bored-after-30s            : 2 testers (T2, T5)
  confused-by-controls       : 1 tester  (T2)
  said-juicy                 : 3 testers (T1, T3, T4)
  pillar-violation:tactile   : 1 tester  (T5 — "felt like clicking a spreadsheet" matches anti_example exactly)
```

Pillar-violation hits are **alarms**. The whole point of anti-examples (set in `/gmk-init`) is that the user pre-committed to "if testers say this, the pillar is broken." Don't soften the language.

### Step 5 — Compute hypothesis verdict

For each human row, mark it PASS / FAIL / INCONCLUSIVE based on Step 3 tallies plus the row's `target`:

- `"3 of 5"` → integer threshold against tester count.
- `"majority"` → > 50% of tagged testers.
- `">= 80%"` → percentage threshold.
- `"any"` → at least one hit (rare; usually too weak a target — flag if seen).

Aggregate verdict (mirrors `/gmk-validate`'s structure for consistency):

- **PASS** — every human row passes AND no pillar-violation flags fired.
- **FAIL** — any human row fails OR any pillar-violation flag fired.
- **INCONCLUSIVE** — < 3 testers, OR a row's verdict depends on edge-case judgment calls the user should review.

### Step 6 — Write back to `milestones.json`

```json
{
  "id": "m1-merge-feel",
  "human_feedback": {
    "coded_at": "2026-05-09T16:30:00Z",
    "n_testers": 5,
    "source_path": ".gamemaker-kit/feedback/m1-merge-feel-2026-05-09.md",
    "hypothesis_rows": [
      {
        "metric": "tester_says_satisfying",
        "target": "3 of 5",
        "actual": "3 of 5",
        "hits": ["T1", "T3", "T4"],
        "misses": ["T2", "T5"],
        "passed": true
      }
    ],
    "open_themes": [
      { "code": "said-juicy", "n": 3, "testers": ["T1", "T3", "T4"] },
      { "code": "bored-after-30s", "n": 2, "testers": ["T2", "T5"] }
    ],
    "pillar_violations": [
      {
        "pillar_id": "tactile-satisfaction",
        "anti_example": "Merging two dragons feels like clicking a button on a spreadsheet — silent, instant, weightless.",
        "tester": "T5",
        "quote": "felt like clicking a spreadsheet"
      }
    ],
    "verdict": "FAIL",
    "verdict_reason": "Pillar 'tactile-satisfaction' anti-example was hit by T5 even though the bot row passed. Anti-example hits override row pass."
  }
}
```

Save the raw normalized replies to `.gamemaker-kit/feedback/<name>-coded-<YYYY-MM-DD>.md` so the user has the audit trail. Don't overwrite previous coding sessions — append timestamped files.

If a previous `human_feedback` exists, push it into `human_feedback_history: [...]` so re-codings preserve history.

### Step 7 — Print the report

Plain text. Long-form OK here — the user is going to read this carefully.

```
m1-merge-feel — HUMAN FEEDBACK: FAIL

  Testers: 5 (T1, T2, T3, T4, T5)

  Hypothesis (human rows):
    ✓ tester_says_satisfying     target: 3 of 5     actual: 3/5
        hits  : T1 "really satisfying when they pop"
                T3 "juicy"
                T4 "feels chunky"
        misses: T2, T5

  PILLAR VIOLATION:
    ✗ tactile-satisfaction
        anti-example: "Merging two dragons feels like clicking a button on
                       a spreadsheet — silent, instant, weightless."
        tester     : T5 — "felt like clicking a spreadsheet"
        Direct match. The pillar's stated failure mode happened.

  Open themes (unprompted):
    said-juicy           : 3  (T1, T3, T4)
    bored-after-30s      : 2  (T2, T5)
    confused-by-controls : 1  (T2)

Why the verdict is FAIL:

  The hypothesis row passed numerically (3 of 5 said "satisfying" or synonym).
  But T5 directly hit the tactile-satisfaction anti-example. Anti-examples are
  pre-committed failure modes — when one fires, the pillar is broken regardless
  of the headline metric.

  T2 and T5's "bored-after-30s" suggests the satisfying merge feel doesn't
  carry the loop alone. The 3 hits came from testers who play more games
  (best guess from their language); the 2 misses came from testers who got
  bored before the mechanic could land.

Next:
  - Re-read T5's full message — that's the most expensive piece of feedback
    in this round.
  - Decide: tighten the prototype to address the violation (likely +audio,
    +haptic-equivalent), then /gmk-validate and /gmk-share again. OR
  - Kill the milestone — log the lesson, advance to the next pillar.

  Do NOT /gmk-port until the verdict flips to PASS.
```

For PASS:

```
m1-merge-feel — HUMAN FEEDBACK: PASS

  Testers: 5
  Hypothesis (human rows):
    ✓ tester_says_satisfying     target: 3 of 5     actual: 4/5

  Open themes:
    said-juicy           : 4
    wanted-more          : 3
    replayed-immediately : 2

Both gates clear (bot validation PASS + human feedback PASS).

Next: /gmk-port m1-merge-feel --to godot
  Converts the validated mechanic to GDScript and integrates into your
  Godot project. Outputs a port-checklist for the things that don't
  auto-translate (game feel numbers, audio, physics).
```

## Edge cases & policy

### Tester replies in non-English

Code in whichever language they're in. Don't translate to "normalize" — translation can drift the meaning of feel-words. If the user's hypothesis is in English but replies are in Korean, do the code matching with the user's hypothesis language as the target list and Korean replies as the source — match concept, not literal string. Example: hypothesis `"says satisfying"` matches Korean `"손맛 좋다"`. Surface the original quote in the report.

### Group chats / shared replies

Sometimes one tester's reply triggers a discussion. Code the originating reply per tester; ignore meta-discussion ("yeah I agree") unless it adds new content. If T2 says "I bounced after 30 seconds" and T3 says "same here," that's 2 testers with `bored-after-30s`, not 1 + 1 generic agreement.

### Sarcasm / negative framings of positive words

"It's *so* satisfying I want to throw my phone." Don't count as `says_satisfying`. Read tone. If you're unsure, surface the quote and note the ambiguity rather than silently picking a side.

### Tester is the user themselves

Sometimes the user pastes their own playthrough notes alongside tester replies. Tag those `T0:self` and **exclude from hypothesis tallies** — the user can't be a tester for their own prototype, the bias is too high. Include in open themes with the `self` flag for context.

### Less than 3 testers but a violent reaction

A single tester saying "this is the best thing I've played all month" or "this game is hostile to humans" is data, not noise. INCONCLUSIVE on sample size, but surface the strong signal prominently. Don't bury it under "n=1 means nothing."

### Re-coding the same milestone after more replies arrive

User shares prototype, gets 2 replies, runs `/gmk-feedback`, gets INCONCLUSIVE. Three more replies come in next day, runs again. The skill should:
- Read all replies (old + new) from the inbox.
- Re-code from scratch (don't try to merge old codings — coding is cheap, drift is expensive).
- Push the previous `human_feedback` into `human_feedback_history`.

### Adversarial / off-topic replies

Some testers will reply with jokes, off-topic comments, "lol no thanks". Tag as `noise` and exclude from tallies. If `noise_rate > 50%`, the prototype's tester-message (from `/gmk-share`) wasn't sharp enough — note it as feedback for the user's outreach style, not the prototype.

### Tester contradicts themselves across two replies

T2 first message: "this is great". T2 second message (10 min later): "actually I got bored and quit." Use the **latest** message as their settled position; flag the change in the report. The user may want to reach out to T2 to understand the shift.

## What this skill does NOT do

- **Doesn't fetch replies from external services.** No Discord scraping, no email parsing. Replies come in via paste or a markdown file. (Out of scope for MVP; possibly Phase 2 with an explicit user toggle.)
- **Doesn't draft a response to testers.** No "thanks for your feedback" templates. The user owns their relationship with their testers.
- **Doesn't compute sentiment scores.** "% positive" is exactly the kind of fake-precision metric that hides what individual humans actually said. Tester counts per code only.
- **Doesn't auto-trigger /gmk-port on PASS.** Mirror the validate skill's discipline: verdicts are advisory, the user decides next move.
- **Doesn't re-validate.** Bot and human gates are independent; if the user wants both fresh, they run both skills.
- **Doesn't anonymize/redact.** Whatever the user pastes, that's what gets saved. If the user wants tester anonymity, they strip handles before pasting.

## Notes for the model running this skill

- **You are the qualitative coder.** Your job is to read carefully, tag honestly, and flag your own edge calls. Don't try to "be helpful" by stretching synonym lists or charitable readings. The user can override your call but they need to see the raw read first.
- **Anti-example matches are sacred.** They were pre-committed at `/gmk-init` time as the failure mode the user was willing to bet against. If one fires, do not soften the verdict. The user can override; you don't pre-soften.
- **Watch for the loudest-tester trap.** When one tester writes 500 words and four write 50, weigh by tester count, not word count. Use a "T2 wrote a lot" line if relevant, but tally is per-tester.
- **Quote testers verbatim in the report.** Paraphrasing kills the texture. The user wants to see the actual words.
- **Don't try to fix the prototype.** That's not this skill. If the feedback suggests a fix, mention it as a hypothesis the user might test next, not as a prescription.
- **Sample size matters but isn't sacred.** n=3 with all three converging on the same theme is stronger than n=10 split 5/5. State both numbers in INCONCLUSIVE cases.
- **Verdict reason is mandatory.** Especially on FAIL/INCONCLUSIVE — the user needs to know which input drove the verdict so they can act on it.
- **If the hypothesis has zero human rows**, this skill has nothing to gate. Tell the user: *"This milestone's hypothesis has no human-measurable rows. Either the hypothesis was bot-only by design (rare; usually a smell — pure-bot hypotheses can't tell you about fun), or you forgot to add one. Want to add a human row and re-run?"*
