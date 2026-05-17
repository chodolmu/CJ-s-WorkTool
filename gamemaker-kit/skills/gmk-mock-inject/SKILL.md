---
name: gmk-mock-inject
description: Inject deterministic-shape asset placeholders (colored shapes labeled with sprite IDs) and dependency stubs into an HTML prototype so the mechanic can be validated BEFORE final art/sound assets arrive. Writes a sibling file `<name>-mocked.html` — never modifies the original. Use when the user says "/gmk-mock-inject <milestone>", "mock placeholders for X", "asset 없이 검증", or before /gmk-validate when art/sound is upstream-blocked but the user wants to run the bot now.
model: sonnet
---

# gmk-mock-inject — Validate the mechanic before the assets arrive

The kit's most common dependency cycle: **the mechanic depends on art that depends on the mechanic being playable that depends on art**. This skill breaks it. It produces a "mocked" copy of an HTML prototype where missing assets are replaced with deterministic, labeled shapes — usable by the bot, debuggable by the user, **disposable** when the real art lands.

The mocked file is a sibling, not a replacement: `prototypes/<name>.html` stays untouched; `prototypes/<name>-mocked.html` is the validate-friendly version.

## Why mocking matters in the kit's flow

- **Bot doesn't care about visual fidelity.** It calls `legalActions()` / `act()` / `summary()`. Colored rectangles labeled `DRAGON_TIER_3` produce the same bot signal as final sprite sheets.
- **Self-test cares somewhat.** The user playing the mocked prototype gets crisper navigation cues (the label is visible) than they would with broken `<img>` references.
- **Audio mocking is similar** — a `data:` URI with a 200ms beep for SFX feedback lets the bot run without WebAudio CDN deps.

The mock is **temporary infrastructure**. When the real assets arrive, the user updates the original prototype and **deletes the mocked file**.

## When this skill is the right tool

✅ Use:
- The mechanic is designed and the prototype HTML is mostly written
- Final art/sound assets aren't ready yet (waiting on art task, or art produces only after self-test direction)
- The user wants to run `/gmk-validate` *now*, not wait

❌ Skip:
- The prototype already runs without assets (mechanic uses CSS shapes, generated colors) — no mock needed
- Assets are ready (just use them)
- The hypothesis is **about** the visual feel (e.g., "do the dragon sprites read at a glance") — mocking that hypothesis tests nothing

## Preconditions

1. **Prototype HTML exists** at `prototypes/<milestone-id>.html`.
2. **`prototypes/<milestone-id>-mocked.html` does not exist** — or the user explicitly accepts overwrite. If exists:
   - *"`prototypes/m2-dragon-evo-mocked.html` already exists (created {timestamp}). Overwrite? (you might want to keep it if you've hand-tuned the mock)"*
3. **The prototype's assets are identifiable.** The skill looks for:
   - `<img src="...">` tags
   - `new Image(); img.src = "..."` in script
   - `audio.src = "..."` references
   - `loadSound("...")` patterns
   - Inline TODO/FIXME comments about pending assets
   - `// mock:art-sheets` or `// mock:sfx-thud` markers (preferred — explicit)

   If none found, the skill says: *"No asset references found in `prototypes/m2-dragon-evo.html`. The prototype seems to already render with what's available; mocking may not be needed."*

_Standard preconditions (milestone-id resolution, empty/partial state, refuse-chain cycle guard, kit_version read contract) follow `gmk-prototype-rules` Rule 13-14, 16._

## Flow

### Step 1 — Scan the prototype for asset references

Read `prototypes/<milestone-id>.html`. Identify each asset by:

1. **Explicit mock markers** — comments like `// mock:art-dragons-sheet` or `<!-- mock:sfx-thud -->`. These are the cleanest input.
2. **`<img>`/`<audio>` source attributes** pointing to relative or absolute file paths that don't exist.
3. **JS asset loaders** — `new Image()`, `new Audio()`, `loadSound`, etc.

Categorize each asset:

| Type | Mock strategy |
|---|---|
| Sprite/image | Deterministic colored rectangle (or shape) + text label centered |
| Sprite sheet | Grid of distinct colored rectangles, each labeled with its frame ID |
| SFX (short, < 1s) | `data:` URI WebAudio-generated tone (e.g., 400Hz square wave 200ms) |
| BGM (longer) | Silent or 1Hz LFO synth (low cost, identifiable in output) |
| Tilemap | Tinted grid pattern, tiles labeled by tile-id |
| Font | System fallback (no mock — engine handles) |

Show the user the asset inventory:

```
Assets to mock in m2-dragon-evo.html:

  1. mock:dragon-sheet
     Found via: <!-- mock:dragon-sheet --> on line 47
     Type: sprite sheet (5 species × 4 stages = 20 frames)
     Mock: 5×4 grid of distinct colors with labels (e.g., "S0/T1", "S0/T2"...)

  2. mock:merge-sfx
     Found via: audio.src = "sounds/merge-thud.wav" on line 112  (file does not exist)
     Type: SFX
     Mock: 250Hz square wave, 200ms via WebAudio

  3. mock:bgm-loop
     Found via: bgm.src = "music/zoo-bgm.mp3"  (file does not exist)
     Type: BGM
     Mock: silent (recommended) — or low LFO synth if user wants audible BGM

Proceed?
```

### Step 2 — Generate the mock injections

For each asset, generate a deterministic mock. **Deterministic** means: same asset ID → same color/shape/tone every time. The user can rely on "the red square is always dragon tier 1." Use a small hash function (e.g., sum of char codes mod 360 for hue).

**Image mock template** (canvas-rendered):

```javascript
// gmk-mock-inject: generated for "mock:dragon-sheet"
function __gmkMockSheet(id, frames, cols, rows) {
  const w = 64, h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w * cols; canvas.height = h * rows;
  const ctx = canvas.getContext('2d');
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx >= frames.length) continue;
      const frameId = frames[idx];
      const hue = (__gmkMockHash(frameId) * 47) % 360;
      ctx.fillStyle = `hsl(${hue}, 70%, 55%)`;
      ctx.fillRect(c*w, r*h, w-1, h-1);
      ctx.fillStyle = 'white';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(frameId, c*w + w/2, r*h + h/2);
    }
  }
  return canvas;
}
function __gmkMockHash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
const dragonSheet = __gmkMockSheet('dragon-sheet',
  ['S0/T1','S0/T2','S0/T3','S0/T4','S1/T1','S1/T2','S1/T3','S1/T4', /* ... */],
  4, 5);
```

**SFX mock template** (WebAudio):

```javascript
// gmk-mock-inject: generated for "mock:merge-sfx"
function __gmkMockSfx(id, hz, durationMs) {
  let actx = window.__gmkAudioCtx;
  if (!actx) actx = window.__gmkAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return function play() {
    const osc = actx.createOscillator();
    const gain = actx.createGain();
    osc.type = 'square';
    osc.frequency.value = hz;
    gain.gain.setValueAtTime(0.15, actx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + durationMs/1000);
    osc.connect(gain).connect(actx.destination);
    osc.start();
    osc.stop(actx.currentTime + durationMs/1000);
  };
}
const playMergeSfx = __gmkMockSfx('merge-sfx', 250, 200);
```

**BGM mock template** (silent):

```javascript
// gmk-mock-inject: generated for "mock:bgm-loop" (silent — change to LFO if you want audible)
function __gmkMockBgm() {
  return { play() {}, stop() {}, setVolume() {} };
}
const bgm = __gmkMockBgm();
```

### Step 3 — Replace asset references in the prototype

For each identified asset:
- Replace the `<img src="...">` with `<canvas data-gmk-mock="...">` or render via the canvas helper at draw time.
- Replace `audio.src = "..."` with the WebAudio-generated mock.
- Mark with a `// gmk-mock` comment immediately above the replacement so the user can `grep` for them.

**Don't** delete original asset reference lines — comment them out and append the mock. Keeps the file diff-able when the real assets arrive.

### Step 4 — Inject a "this is mocked" header banner

Add a bright visible banner at the top of `<body>` so the user (or self-tester) never confuses a mocked run for a final-asset run:

```html
<!-- gmk-mock-inject: this prototype runs on mocked assets -->
<div style="position:fixed; top:0; left:0; right:0; background:#ffcc00; color:#000; padding:6px; font-family:monospace; font-size:12px; text-align:center; z-index:9999; border-bottom:2px solid #000;">
  ⚠ MOCKED ASSETS — visuals/sounds are placeholders. Final assets pending.
</div>
```

The banner is **always visible** on the mocked file. The bot ignores it (it's a DOM node, not state). The user playing the mocked prototype sees it constantly — that's the point.

### Step 5 — Write `prototypes/<milestone-id>-mocked.html`

Save the modified file as `<milestone-id>-mocked.html`. **Never overwrite the original** `<milestone-id>.html`.

Add a header comment in the file:

```html
<!--
gmk-mock-inject: this file is a MOCKED COPY of m2-dragon-evo.html
Generated: 2026-05-12T17:00:00Z
Mocks applied:
  - mock:dragon-sheet  (5×4 deterministic-color sheet)
  - mock:merge-sfx     (250Hz 200ms square wave)
  - mock:bgm-loop      (silent)

Delete this file when final assets arrive. Update prototypes/m2-dragon-evo.html
with real asset references and re-run /gmk-validate from the original.
-->
```

### Step 6 — Update milestones.json (optional advisory field)

If `milestones.json` has a `mocks` field (Wave A doesn't add this to schema — keep informational), update:

```json
{
  "id": "m2-dragon-evo",
  "_mocked_prototype": "prototypes/m2-dragon-evo-mocked.html",
  "_mocked_at": "2026-05-12T17:00:00Z",
  "_mocked_assets": ["dragon-sheet", "merge-sfx", "bgm-loop"]
}
```

These advisory fields let `/gmk-validate` warn the user: *"This validation run uses MOCKED assets — visual/auditory feel claims aren't testable until real assets land."*

### Step 7 — Print the next step

```
Mocked prototype written: prototypes/m2-dragon-evo-mocked.html
Original preserved: prototypes/m2-dragon-evo.html  (untouched)

Mocked: dragon-sheet, merge-sfx, bgm-loop

A yellow banner is fixed at the top of the page so you never forget this is mocked.

Next:
  /gmk-validate m2-dragon-evo --file=mocked  (bot runs the mocked version)
  /gmk-self-test m2-dragon-evo --file=mocked (self-test with caveats — visual/sound feel claims aren't testable)

When final assets arrive:
  1. Update prototypes/m2-dragon-evo.html with real asset references
  2. Delete prototypes/m2-dragon-evo-mocked.html
  3. Re-run /gmk-validate from the original
```

## Edge cases & policy

### The hypothesis is *about* the assets being mocked

Refuse:

> *"This milestone's hypothesis is about visual feel ('does the dragon sprite read at a glance'). Mocking the dragon sheet means the bot validates *the wrong thing* — the mock can't test the hypothesis. Wait for real assets, or split into a different milestone that tests non-visual mechanics first."*

### Mocked file already exists with hand-edits

The user may have hand-tweaked the mocked file (e.g., chose specific colors for clarity). Preserve them:

> *"prototypes/m2-dragon-evo-mocked.html was modified after generation. Overwriting will lose your hand-edits. Options:*
>   1. *Save current mocked.html as .bak and regenerate*
>   2. *Skip regen — keep hand-edited mock as-is*
>   3. *Overwrite (loses hand-edits)*"*

### User explicitly tags assets with `// mock:` markers

Preferred input. The skill recognizes any line containing `mock:<asset-id>` (in HTML or JS comments) and treats it as an opt-in mock point. Documented in the gmk-prototype-rules note: *"When writing a prototype that knows it'll need mocking, add `// mock:<id>` comments at each asset injection point."*

### Asset is an animation, not a static image

The skill mocks the **first frame only** plus a small "ANIM" badge:

> *"mock:dragon-merge-animation — this is animated (8 frames detected from the original). Mock renders frame 0 with an 'ANIM' badge. Bot validation works; self-test may miss timing-of-animation feedback."*

The user accepts the caveat.

### Mocking introduces a CDN reference

The skill won't do this. **All mocks are self-contained** — `data:` URIs and inline WebAudio only. If the user-written prototype already has a CDN reference, that's a Rule 6 violation; flag it but don't auto-mock around it.

### User wants to mock font

Skip. Fonts are handled by the engine port; HTML uses system fonts. Mock fonts would add visual noise without bot signal.

## What this skill does NOT do

- **Doesn't modify the original prototype.** Original stays clean for when real assets arrive.
- **Doesn't generate "good-looking" mocks.** Mocks are *legible* (labels visible) and *deterministic*, not pretty. Use real assets when you want pretty.
- **Doesn't validate the mocked prototype.** That's `/gmk-validate --file=mocked`.
- **Doesn't auto-delete the mocked file when real assets arrive.** The user deletes; the kit doesn't track. (v0.8: `/gmk-art-gen` prints a one-line reminder in its Step 6 summary when a mocked sibling exists — the reminder is informational, not a destructive auto-cleanup.)
- **Doesn't mock hypothesis-relevant assets.** If the hypothesis is about a visual or audio feel, refuse.
- **Doesn't add CDN imports.** All mocks are self-contained.

## Notes for the model running this skill

- **Deterministic colors via hash.** Same asset ID across runs/projects should produce same color. The user gets to learn "dragon-tier-3 is always green" and trust it.
- **Labels are the contract.** A mocked asset without a visible label is just a colored shape — useless for self-test debugging. Always include the asset ID as text.
- **Don't try to "auto-detect" assets the user didn't mark.** Pattern-matching for `<img>` tags works; pattern-matching for "this might be missing art" by inferring from variable names produces false positives. If the user didn't put `// mock:` markers, ask for them.
- **The yellow banner is a load-bearing UX detail.** Many users will run self-tests on the mocked file and forget — the banner kills that confusion class.
- **WebAudio quirks**: AudioContext starts in `suspended` state until user gesture. The bot doesn't click, so the WebAudio mock may produce no sound in headless mode. That's fine — the bot doesn't measure audio. Document the quirk: *"WebAudio mocks may be silent in headless validation (no user gesture). They make sound when the user clicks the page."*
- **Stay self-contained.** Mocks should work with the prototype loaded via `file://` — no `http://`, no CDN, no external fetch.
- **gmk-prototype-rules Rule 6 forbids CDN imports.** Mocks must inherit that constraint. If the original prototype already has CDN imports (a Rule 6 violation), surface it and refuse to mock around it.
