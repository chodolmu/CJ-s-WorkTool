---
name: gmk-sound-plan
description: Draft a milestone's audio plan — name each SFX and BGM cue, declare its trigger / duration / intent, sketch the adaptive-music layers if any, and surface mix conflicts before audio production. Writes _workspace/milestones/<id>/sound-plan.md. Use when the user says "/gmk-sound-plan <milestone>", "sound list", "SFX 목록", "BGM plan", "adaptive music", or after /gmk-design-system and before audio implementation. Read-only on milestones.json + pillars.json + design-system.md; writes one markdown file. No external services or audio generation — spec only.
model: sonnet
---

# gmk-sound-plan — Name every cue, claim every layer, before any audio is recorded

In a 2D, ≤5-minute-session game, audio carries more pillar load than the user usually realizes. The "satisfying merge" pillar fails far more often on a flat/missing thunk than on a slightly-off visual particle.

This skill writes down — **before** any sound is recorded, sourced, or generated — every cue the milestone uses, what each cue's job is, how loud/long it should be relative to the others, and where the mix will fight itself.

Output: a markdown spec listing SFX, BGM, and (optionally) adaptive layers, with a one-line mix-priority statement.

## Preconditions

1. **Milestone exists** in `.gamemaker-kit/milestones.json` with `pillars_targeted` non-empty.
2. **Design system spec exists** (`_workspace/milestones/<id>/design-system.md`) OR the user explicitly skips it (some milestones are simple enough). The systems list tells you which events probably need cues.
3. **Pillars are bound.** Audio choices serve pillars; mismatches are flagged.

_Standard preconditions (milestone-id resolution, empty/partial state, refuse-chain cycle guard, kit_version read contract) follow `gmk-prototype-rules` Rule 13-14, 16._

## Flow

### Step 1 — Read pillars → audio implications

For each pillar, name what audio is supposed to do:

- **Tactile-satisfaction** → punchy, transient-heavy SFX with short tails; "thunk" character
- **Discovery-joy** → rising tones at unlock moments; surprise tones at first-time reveals
- **Greed-vs-safety** → warning cues (low growl, ascending tension); reward cues (rising arpeggio)
- **Calm/focus** → ambient pad bed, low SFX presence, no sudden transients
- ... whatever pillars the user defined

Surface the chain at the top of the spec. The user may reject — accept once and continue.

### Step 2 — Enumerate SFX

Walk through the events identified in `design-system.md` (or the hypothesis IF clause if no design spec) and list which need audio.

Common categories:

- **Action confirms** — every player action that has visible feedback usually wants audio (merge, place, choose dialogue option)
- **State transitions** — game-over, win, level-up, unlock
- **Ambient / environmental** — wind, machine hum, crowd murmur (rare in 5-min sessions)
- **Negative feedback** — failed action, illegal move, game-over thud

For each SFX, write a single row:

```
## SFX

| ID                 | Trigger                              | Duration | Intent                          | Pillar served    |
|--------------------|--------------------------------------|----------|---------------------------------|------------------|
| sfx-merge          | resolveMerge() success               | ~150ms   | "thunk" — body weight, presence | tactile          |
| sfx-merge-tier2    | resolveMerge() producing tier-2      | ~200ms   | thunk + brief sparkle           | tactile, discovery |
| sfx-place          | placeDragon()                        | ~80ms    | light tap                       | tactile          |
| sfx-illegal        | bot/user attempts illegal merge      | ~50ms    | dry buzz, low presence          | (negative)       |
| sfx-game-over      | isOver() with no win                 | ~600ms   | descending tone                 | (negative)       |
| sfx-unlock-species | first time a new tier appears        | ~400ms   | rising arpeggio                 | discovery        |
```

Cap practical: ~10 SFX per milestone. More usually means the milestone is too event-dense.

### Step 3 — BGM plan

For 5-min sessions, BGM is one or two layers, not a 5-track adaptive system. Three honest options:

| BGM type | When to pick it |
|---|---|
| **None** | Session is so short that BGM intrudes; SFX carries everything. |
| **Single loop** | One ambient track, ~30-60sec, loops seamlessly. Most common choice. |
| **Two-layer adaptive** | A bed track always playing + an "activity" layer that fades in when the player is in flow (e.g. >3 actions in last 5 seconds). |

If the user picks adaptive, write the layer specs:

```
## BGM (two-layer adaptive)

### Bed layer
- Always plays from startGame() to isOver().
- ~45sec loop. Ambient, sparse, low-mid frequencies.
- Volume: -18 dBFS reference.

### Activity layer
- Fades in (300ms) when action_rate > 3 actions / 5 seconds.
- Fades out (500ms) when activity drops.
- ~45sec loop matching the bed's tempo (BPM tagged so layers don't clash).
- Volume: -15 dBFS reference (3 dB louder than bed when active).
- Content: percussive top layer, no melodic motifs (those would compete with SFX).
```

### Step 4 — Mix priority

The single most-cited section. State who wins when two cues fight:

```
## Mix priority (highest to lowest)

1. sfx-merge (and tier-2 variant) — must punch through everything
2. sfx-game-over — clear, undebated end state
3. BGM activity layer
4. sfx-unlock-species — duck BGM by 4 dB for 300ms when this plays
5. BGM bed layer
6. sfx-place, sfx-illegal — quietest; never compete with merges

If two priority-1 events collide (rare), the more-recent wins; the earlier
is cut at -12 dB. No layering of merge SFX.
```

The priorities translate directly into mixer logic at engine port time.

### Step 5 — Adaptive-music conflict callouts (optional)

If using adaptive layers, surface where the system can fail:

```
## Adaptive risks

- Activity layer flicker: at action_rate near the threshold (~3/5sec), the
  layer fades in/out repeatedly. Add hysteresis (rises at 4/5, falls at 2/5).
- BPM drift: bed and activity layers must share BPM and downbeat phase.
  Easy to forget; verify at engine port time.
```

Skip this section for non-adaptive BGM.

### Step 6 — Write the spec

Path: `_workspace/milestones/<milestone-id>/sound-plan.md`. Overwrite.

Template:

```markdown
# Sound plan — {milestone.id} {milestone.name}

> Generated: {timestamp} by /gmk-sound-plan.

## Pillars → audio implications
- {pillar.id}: {implication}

## SFX
{table}

## BGM
{none | single-loop spec | two-layer adaptive spec}

## Mix priority
{ordered list, plus tie-breakers}

## Adaptive risks
{optional, only if adaptive}

## Next
- /gmk-task-split <id> — slot audio tasks into the kanban (recording/sourcing each cue)
- /gmk-prototype <id> — for the HTML prototype, audio is usually generated WebAudio (gmk-prototype-rules §6 exception when hypothesis is about audio feel)
- Engine port: implement the mix priority as a mixer config (Godot AudioServer / Unity AudioMixer)
```

### Step 7 — Don't touch milestones.json

Working doc only. Audio tasks land in `tasks[]` via `/gmk-task-split` if the user runs it.

## Output: tell the user what happens next

```
Sound plan written: _workspace/milestones/m1-merge-feel/sound-plan.md
SFX listed: 6
BGM: single-loop (~45sec, ambient)
Mix priority: 6 cues ranked, 1 ducking rule

Next:
  - /gmk-task-split m1-merge-feel — add audio tasks (record/source SFX, find BGM)
  - For the HTML prototype, sfx-merge can be generated WebAudio inline (per gmk-prototype-rules §6 exception)
```

## Edge cases & policy

### Audio is the hypothesis

If the IF clause directly invokes audio ("a meaty thunk on merge"), audio is load-bearing — the hypothesis fails if the cue is wrong. Surface loudly: *"This milestone's hypothesis depends on the audio itself. SFX quality drift will fail /gmk-self-test even if the bot passes. Spend extra design effort on sfx-merge."*

### The milestone is BGM-driven (rare in 5-min sessions)

For a milestone whose mechanic *is* the music (e.g., rhythm game prototype), the SFX table inverts — the BGM is the primary content, SFX are responses. Still works with this skill's structure; just expand the BGM section into a beat map sketch.

### User wants "no audio" for this milestone

Accept: write `## BGM\nNone (silent prototype — audio added at engine port if any).` plus `## SFX\nNone.` Note that silent prototypes will fail any audio-dependent hypothesis automatically.

### Volume references in dBFS

`-18 dBFS` etc. are conventions. If the user is unfamiliar, briefly note: *"dBFS is decibels relative to full scale; -18 is roughly 'comfortable level,' 0 is the loudest possible. Engine-specific mixers may use different scales — translate at port time."* Don't lecture.

### Cap busts

If the SFX list exceeds 12, push back: *"12+ SFX in a 5-minute session is dense. Some of these (sfx-illegal, sfx-place) are quietest-tier — verify they're earning their slot."*

### Conflict with art-spec

If the milestone's art spec mentions "particle bursts on every action" and the sound plan has only one SFX, surface: *"Art spec implies particle feedback on multiple events but sound plan has only sfx-merge. Are the other particles silent intentionally?"*

## What this skill does NOT do

- **Doesn't generate audio.** Spec only. There's no audio-generation pipeline analogous to `/art` in the current GameMaking setup.
- **Doesn't source from libraries.** The user finds/records the actual cues.
- **Doesn't write WebAudio code.** For HTML prototypes, the generated audio code lives in `/gmk-prototype`'s output (and only when the hypothesis is about audio feel, per `gmk-prototype-rules` §6).
- **Doesn't validate audio quality.** That's the user's ear and `/gmk-self-test`.
- **Doesn't implement adaptive mixing.** Specs the layers; mixer wiring happens at engine port.
- **Doesn't add to milestones.json.** Working doc only.

## Notes for the model running this skill

- **Mix priority is the load-bearing section.** Volume numbers and BGM specs drift; the priority list survives because it answers "who wins when?" Spend the most attention here.
- **Don't over-spec adaptive music.** Two layers max for a 5-min session. The complexity ramps fast; most milestones don't need it.
- **Resist over-emoting.** "The merge feels DEEP and POWERFUL and EMBODIED" is over-direction. "Punchy transient, ~150ms, body weight" is the spec language. Match the user's vocabulary but lean concrete.
- **Frequency conflicts matter.** If two SFX share the 200-800Hz mid range and play within 100ms of each other, they'll mud. Flag those collisions in the mix priority section.
- **Pillars first.** If the user picks BGM that contradicts a pillar (anti_example: "no harsh transients" but the user wants synth stabs), flag it: *"`synth stabs` matches the anti-example for tactile-satisfaction pillar. Reconsider, or override with a one-line rationale."*
- **The HTML prototype usually doesn't get audio.** Per `gmk-prototype-rules` §6, external audio files are out. The exception is hypothesis-is-about-audio, in which case WebAudio generation inline is allowed (and the SFX list informs that code).
