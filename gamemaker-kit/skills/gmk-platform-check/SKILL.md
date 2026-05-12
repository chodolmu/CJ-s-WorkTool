---
name: gmk-platform-check
description: Fast platform-compatibility scan for an HTML prototype — checks for browser-specific APIs, viewport size hardcodes, touch-vs-mouse-only assumptions, and other portability gotchas before /gmk-port lands the milestone in an engine. Reads prototypes/<name>.html and reports a quick checklist. Use when the user says "/gmk-platform-check <milestone>", "platform check", "mobile/desktop 호환", "browser compat", or as a 30-second sanity check before /gmk-port. Read-only on the prototype; writes a short markdown checklist.
model: haiku
---

# gmk-platform-check — Thirty-second sanity check before the port

This is the cheap, fast cousin of `/gmk-portability-check`. Where `/gmk-portability-check` does a deep 12-category risk-catalog pass for engine porting, `gmk-platform-check` runs a quick scan for **HTML-side cross-platform issues** that would show up *before* the engine even enters the picture: a prototype that only works on Chrome desktop, breaks on a 320px-wide phone, or hardcodes a viewport size.

This skill is on **haiku** because the checks are pattern-matching, not interpretation. It runs in seconds.

Output: a short markdown checklist with pass/fail per category. No deep analysis. If the user wants real depth, send them to `/gmk-portability-check`.

## Preconditions

1. **Milestone exists** in `.gamemaker-kit/milestones.json`.
2. **Prototype file exists** at the milestone's `prototype` path.

That's it. No Playwright, no validation gate, no other skill required. This is meant to run any time.

## Flow

### Step 1 — Read the prototype

Read the full HTML file. The scan is regex/pattern-matching against the source, with a few semantic checks (e.g., "hardcoded viewport size" requires understanding `width=600` vs `width=100vw`).

### Step 2 — Run the checks

Six categories, each one pass/fail (or N/A if not applicable):

#### 1. Browser-specific APIs
Scan for:
- `webkit*`, `moz*`, `ms*`, `o*` vendor prefixes used without fallbacks
- `document.webkitFullscreenElement` etc. without `document.fullscreenElement` fallback
- `navigator.userAgent` sniffing
- `Intl` / `BigInt` / `Array.flat` etc. — supported broadly but worth flagging if the user's target is "older browsers"

**Pass**: no flags or all flags have fallback paths. **Fail**: any flag without a fallback.

#### 2. Viewport / responsive sizing
Scan for:
- `<meta name="viewport">` presence (✓ expected for mobile)
- Hardcoded `width="600"` / `height="800"` on the canvas or game container
- CSS using `px` only (no `vw/vh/%/rem` for game container dimensions)

**Pass**: viewport meta present AND game container scales (uses `vw/vh/%/calc` or aspect-ratio CSS). **Fail**: viewport missing OR everything is fixed px.

If the milestone is desktop-only by design, the user can pass `--target desktop` and the check passes regardless of mobile scaling.

#### 3. Touch vs mouse input
Scan for:
- `addEventListener('click', ...)` only (no `touchstart` / `pointerdown` companion)
- `addEventListener('mousemove', ...)` only (no touch equivalent)
- CSS `:hover` styles for interactive elements without `:active` / touch equivalent
- `Pointer Events API` use (✓) vs Mouse-only (⚠)

**Pass**: uses Pointer Events API OR both mouse + touch handlers cover the same interactions. **Fail**: mouse-only OR touch-only.

Common case: `pointerdown` / `pointerup` / `pointermove` covers both — this is the kit's recommendation.

#### 4. Keyboard input assumptions
Scan for:
- `keydown` listeners (✓ if not mobile-only; ⚠ for mobile-only target)
- Specific keys (Arrow keys, WASD) without alternate input
- `event.keyCode` (deprecated; use `event.key` or `event.code`)

**Pass**: keyboard is either optional OR there's a non-keyboard equivalent. **Fail**: keyboard-mandatory for the core mechanic on a mobile target.

#### 5. Audio / autoplay
Scan for:
- `<audio>` or `new Audio()` started without user-gesture trigger (mobile browsers block this)
- `AudioContext` without `resume()` call wired to user input

**Pass**: audio plays only after a user gesture, OR no audio. **Fail**: audio.play() at load time without gesture.

#### 6. Storage / privacy
Scan for:
- `localStorage` / `sessionStorage` use (forbidden per `gmk-prototype-rules` §6 — flag as a rules violation)
- `IndexedDB`
- `document.cookie` set/read

Per `gmk-prototype-rules` §6, prototypes don't persist. Any use here is a rules violation.

**Pass**: no storage APIs used. **Fail**: any use — surface which file:line.

### Step 3 — Write the checklist

Path: `_workspace/milestones/<milestone-id>/platform-check.md`. Overwrite.

Template:

```markdown
# Platform check — {milestone.id}

> Generated: {timestamp} by /gmk-platform-check. Target: {desktop | mobile | both}.

| Check                  | Result | Notes                                    |
|------------------------|--------|------------------------------------------|
| 1. Browser APIs        | ✓ PASS | -                                        |
| 2. Viewport / sizing   | ✗ FAIL | Canvas hardcoded width=600 (line 42)     |
| 3. Touch + mouse       | ⚠ WARN | Uses click + touchstart; consider Pointer Events |
| 4. Keyboard            | ✓ PASS | Keyboard is optional; touch is primary   |
| 5. Audio / autoplay    | ✓ PASS | No audio                                 |
| 6. Storage (rules §6)  | ✓ PASS | No localStorage / cookies                |

## Summary
{1-2 sentences: overall verdict, 1-2 highest-priority fixes}

## Next
- Fix items above (only the FAILs block; WARNs are advisory).
- /gmk-portability-check <id> if planning engine port — deeper 12-category risk pass.
- /gmk-port <id> when ready.
```

### Step 4 — Print the summary

```
Platform check: m1-merge-feel — 1 FAIL, 1 WARN, 4 PASS

  ✗ Viewport: canvas hardcoded width=600 (line 42).
       Fix: use `width=100vw` or aspect-ratio CSS.
  ⚠ Touch/mouse: separate handlers; Pointer Events would unify.

Quick fixes; both are 1-line edits.

Next:
  - Fix viewport and rerun. Touch warning is optional.
  - /gmk-portability-check m1-merge-feel for deep engine-port risk pass.
```

## Edge cases & policy

### Prototype is desktop-only by intent

Run with `--target desktop`. Check 2 (viewport / scaling) and check 3 (touch) become advisory rather than gating. Check 6 (storage) is still strict — `gmk-prototype-rules` §6 doesn't have target carve-outs.

### Prototype is shader-shape

WebGL2 prototypes (`shape: 'shader'`) often have a single static canvas. Check 2 may flag, but the user can pass `--target shader` to soften that specific check (a shader prototype that fills the viewport is fine; the kit doesn't require interactivity).

### False positives on minified or external library code

The skill scans the whole prototype. If the user inlined the `_bot_hook_lib.js` library, vendor-prefix flags from the library shouldn't count against the user. Exclude lines between the library's begin/end markers (look for the `// gamemaker-kit — bot hook shared library` header).

### Hostile patterns

If the scan finds `eval(`, `new Function(`, or other dynamic code execution, flag with a note (these aren't categorically wrong but indicate care needed at port time). Out of the 6 main checks; surface as an additional "Notes" line.

### Re-running

Always overwrite. The check is cheap; history isn't valuable.

### User wants more depth

Direct them to `/gmk-portability-check`. This skill explicitly trades depth for speed.

## What this skill does NOT do

- **Doesn't fix anything.** Surfaces the issues; the user (or `/gmk-prototype` regenerate) fixes.
- **Doesn't do deep engine-portability analysis.** That's `/gmk-portability-check`'s 12-category catalog.
- **Doesn't run the prototype.** Static-source scan only. No Playwright, no browser.
- **Doesn't enforce on FAIL.** Advisory output; `/gmk-port` decides whether to gate on this.
- **Doesn't account for engine-specific platform constraints.** Browser → engine portability is `/gmk-portability-check`'s job.

## Notes for the model running this skill

- **Run fast.** This skill is `model: haiku` for a reason. If you find yourself "interpreting" intent or doing deep semantic analysis, you're in the wrong skill — punt to `/gmk-portability-check`.
- **Pattern-match, don't reason.** The 6 checks are mechanical. False positives are acceptable (and the user catches them); deep semantic accuracy is not the goal at this layer.
- **Cite `gmk-prototype-rules` §6 for storage hits.** It's the explicit rule violation, not just a portability concern.
- **One paragraph summary max.** This skill's output is read in under 30 seconds. Don't pad.
- **`--target` flags soften but never disable check 6.** Storage prohibition is a rule, not a portability concern.
- **WARN ≠ FAIL.** Don't escalate WARNs into FAILs to look thorough. A WARN gives the user a heads-up; a FAIL says "fix before port."
