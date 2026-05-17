---
name: gmk-art-gen
description: Generate the assets listed in a milestone's art-spec.md via the external /art skill (ComfyUI pipeline at C:/GameMaking/_workspace/run.py). Reads art-spec.md, builds the prompt list with locked palette + style anchors injected into each prompt, invokes /art per asset, writes the resulting files into the project's prototypes/assets/ or godot/unity assets directory, and updates milestones.json tasks[] for the art discipline. Use when the user says "/gmk-art-gen <milestone>", "make the dragon sprites", "art generate", "ComfyUI 돌려", or after /gmk-art-spec has locked the palette. Requires ComfyUI running on port 8000.
model: sonnet
---

# gmk-art-gen — Generate art from the locked spec

This skill is a wrapper. It reads the milestone's locked art spec (`art-spec.md`), translates each asset entry into a ComfyUI prompt with palette + style anchors injected, calls `/art` once per asset, and lands the output files where the prototype (and later the engine project) can pick them up.

The skill **does not** invent assets, deviate from the locked palette, or run without an art spec. If `/gmk-art-spec` hasn't been run for the milestone, this skill refuses.

The external `/art` skill (defined in `C:/GameMaking/CLAUDE.md`) does the actual ComfyUI invocation. This skill prepares the prompts and tracks the results.

## Preconditions

1. **`/gmk-art-spec` has been run.** `_workspace/milestones/<id>/art-spec.md` exists.
2. **`/art` skill is available** in the user's harness. Check by looking for the skill registration; if absent, stop with: *"The `/art` skill isn't registered in this harness. /gmk-art-gen is a wrapper around it — without `/art`, this skill has no ComfyUI invocation path. Set up /art (see C:/GameMaking/CLAUDE.md) or generate art manually."*
3. **ComfyUI is reachable.** Best-effort: ping `http://127.0.0.1:8000`. If unreachable, warn: *"ComfyUI doesn't respond at port 8000. Start it before continuing, or generate art manually. The skill can still build the prompt list — set `--dry-run` to skip the actual invocation."*
4. **Asset list in art-spec.md is non-empty.** Pure procedural milestones have no asset list — tell the user *"This milestone's art spec is procedural (no static asset list). /gmk-art-gen has nothing to generate; the procedural rendering happens inside the prototype HTML directly."*

_Standard preconditions (milestone-id resolution, empty/partial state, refuse-chain cycle guard, kit_version read contract) follow `gmk-prototype-rules` Rule 13-14, 16._

## Flow

### Step 1 — Parse art-spec.md

Read the markdown. Extract:

- The **palette** table (color names + hex codes)
- The **style anchors** (3-5 statements)
- The **resolution & format** (per-category dimensions and file naming convention)
- The **asset list**, grouped by category (Characters, Tiles, Effects, UI)
- The **consistency risks** (carry forward into prompts as extra constraints)

If the markdown structure is malformed (missing palette table, no asset list section), stop: *"`art-spec.md` is malformed — palette table not found. Re-run /gmk-art-spec to regenerate, or fix the file."*

### Step 2 — Build the prompt per asset

For each asset entry, build a `/art` prompt by concatenating four parts:

1. **The asset's plain description** from the spec (verbatim).
2. **The palette constraint** — "use only these colors: ember #E04F3B, moss #4FA844, sky #4F8EE0, cream #F5EFD8, coal #2A2A2E. No other hues, no gradients beyond shade variations of the listed colors."
3. **The style anchors** (verbatim).
4. **Per-asset variant clauses** — animation frames, resolution, pose. Pulled from the spec's resolution & format section.

Plus any **consistency-risk callouts** that apply to the asset (e.g., tier-2 merge-color rule for tier-2 dragons).

Example for `dragon-rg-idle` (a tier-2 merge of R+G):

```
Generate a 2D game sprite: tier-2 dragon RG, the result of merging Dragon R
(red, single horn) and Dragon G (green, two horns). Medium size, four horns.
Idle pose, 2-frame animation (frames separated, 128×128 each, total 256×128).

PALETTE (locked, no other hues): ember #E04F3B, moss #4FA844, sky #4F8EE0,
cream #F5EFD8, coal #2A2A2E. RG dragon uses ember + moss only (literal mix or
striped pattern — NOT olive, NOT khaki). All shading is darker/lighter shades
of the listed hexes.

STYLE ANCHORS:
- Chunky silhouette; readable at 16×16.
- Two-tone shading per shape: base color + 1 darker shade. No gradients.
- 1-pixel coal outline around the silhouette.
- No anti-aliased ramps.

FORMAT: 128×128 source per frame, PNG, transparent background.
NAMING: dragon-rg-idle.png (or dragon-rg-idle-frame1.png + dragon-rg-idle-frame2.png).
```

The prompt is long but precise. ComfyUI/SDXL benefits from explicit palette constraints (the kit cannot enforce them; the spec sets expectation, and `/gmk-art-spec`'s consistency-risk section flags what to manually verify).

### Step 3 — Show the prompt list, ask for confirmation

Before invoking `/art` 13 times, print a summary:

```
Art generation plan — m2-dragon-evo

  Assets to generate: 13
    Characters: 9  (3 tier-1, 6 tier-2)
    Tiles:      2  (empty cell, hover cell)
    Effects:    1  (merge burst spritesheet)
    UI:         1  (score readout style guide)

  Output directory: prototypes/assets/m2-dragon-evo/

  Estimated wall time: ~10-15 min (1 min per asset at 832×1216 / 1024×1024 default)

Proceed with generation, or --dry-run to print prompts only?
```

If `--dry-run`, write the prompts to `_workspace/milestones/<id>/art-prompts.md` and stop. The user can paste prompts into ComfyUI manually if they want fine control.

If the user proceeds, continue to Step 4.

### Step 4 — Invoke /art per asset

For each asset:

1. Call the `/art` skill with the prompt + target output path. Per `C:/GameMaking/CLAUDE.md`, `/art` defaults to writing under `C:/GameMaking/_workspace/pipeline/output/` — pass an explicit `--out prototypes/assets/<milestone-id>/<asset-filename>` to land it in the project.
2. Wait for completion. `/art` returns a path or an error.
3. Log the result. On error, retry once. If still failing, log and move on (don't abort the whole batch — the user wants the other 12 assets to still complete).
4. Print a one-liner every 3 assets: `[art-gen] 6/13 generated, 1 failure (dragon-rg-idle).`

The skill does NOT do post-processing (no automatic cropping, palette quantization, or upscaling). If the output doesn't match the spec exactly, that's the cost of generative art — the user reviews and regenerates the affected entries manually.

### Step 5 — Write results to disk + update milestones.json

Files land in `prototypes/assets/<milestone-id>/` by default. If the user passes `--target engine-assets`, files instead land in the engine project's assets directory (Godot: `<engine-root>/assets/<milestone-id>/`; Unity: `<engine-root>/Assets/<milestone-id>/`). The skill does NOT auto-detect the engine path — the user passes it or accepts the prototype default.

Update `milestones.json` `tasks[]` for the art discipline:

For each generated asset, find or create a task with:
- `discipline: 'art'`
- `title: 'Generate <asset-filename>'`
- `status: 'done'` (since the asset is now generated)

For each failed asset:
- Same task but `status: 'review'` (the user needs to look at it)
- A note in the milestone's `notes.md`: *"art-gen failed: <asset>. See _workspace/milestones/<id>/art-gen-log.md for the error."*

Also write `_workspace/milestones/<id>/art-gen-log.md` — an immutable per-run log of which prompts were sent, which succeeded, which failed, and where files landed.

### Step 6 — Print the summary

```
Art generation complete: m2-dragon-evo
  Generated: 12/13
  Failed:    1  (dragon-rg-idle — palette drift in output, regenerate manually)
  Output:    prototypes/assets/m2-dragon-evo/

  Tasks updated in milestones.json:
    12 marked 'done', 1 marked 'review' (needs your eye)

  Log:       _workspace/milestones/m2-dragon-evo/art-gen-log.md

Next:
  - Open prototypes/assets/m2-dragon-evo/ to review the 12 generated assets.
  - For the failed one: re-run `/gmk-art-gen m2-dragon-evo --assets dragon-rg-idle`
    with adjusted seed, or generate manually via /art.
  - /gmk-prototype m2-dragon-evo (or update existing) to wire the assets into the
    prototype. Note: gmk-prototype-rules §6 says no external asset files in
    prototypes except via data-URI or the hypothesis-is-about-art exception.
    For most milestones, assets live in the engine project, not the HTML.
```

## Edge cases & policy

### Asset already exists at the target path

If `prototypes/assets/<id>/<asset-filename>.png` already exists, skip by default and report: *"`dragon-r-idle.png` already exists, skipped. Pass `--overwrite` to regenerate."* Don't silently regenerate (user may have hand-touched the file).

### Palette drift in generated output

The skill cannot detect palette violations programmatically. It writes the assets and trusts the user's manual review. Note in the summary: *"Visual palette compliance is on you to verify — open each PNG in an image viewer and check against the spec's palette table."*

The user can run their own image-pixel check if they want; that's outside this skill.

### Animation frames as separate files vs spritesheet

The spec specifies one or the other. Pass through to `/art`'s prompt. If `/art` returns a single image when the spec wanted frames separated, log it as a partial success and surface to the user for manual frame extraction.

### Asset list larger than 20 items

Push back before generation: *"Generating 28 assets at ~1 min each = ~30 min. Are all of these load-bearing? /gmk-art-spec might be over-specified."* Continue if the user confirms.

### Asset list contains a procedural-only entry mixed with static

Some milestones have e.g. 8 static dragon sprites + 1 procedural shader effect. Skip the procedural entries with a note: *"`hit-stop-overlay` is procedural per the spec — handled in code, not generated. Skipping."*

### ComfyUI returns a corrupt or 0-byte file

Treat as a failure (status: 'review'); log the response. The user manually inspects.

### `/art` skill isn't registered

If the user doesn't have `/art` set up (CLAUDE.md mentions it as a global GameMaking convention, but a fresh checkout may not), stop with the fallback message from Preconditions and write the prompts to disk so the user can paste them into ComfyUI directly.

### Re-running on an existing log

Each invocation creates a new `art-gen-log-{YYYY-MM-DD-HHMM}.md`. The plain `art-gen-log.md` symlinks/points to the latest. Don't overwrite history.

## What this skill does NOT do

- **Doesn't generate art directly.** Wraps `/art` (ComfyUI pipeline).
- **Doesn't post-process.** No cropping, no palette quantization, no upscaling. What `/art` returns is what lands.
- **Doesn't enforce palette compliance.** The spec sets the expectation; verification is the user's review.
- **Doesn't pick output paths automatically across engine types.** Default is prototype-assets; engine targeting requires `--target engine-assets`.
- **Doesn't deviate from the spec.** No "I'll add a few extras" — the spec is the spec.
- **Doesn't iterate on prompts based on failures.** One retry per failed asset; then the user takes over.

## Notes for the model running this skill

- **The spec is the source of truth.** If the spec says "13 assets," generate 13 — not 12, not 14.
- **Prompt construction is the real value.** ComfyUI invocations are commodity; the precision of the palette + style anchor injection is what differentiates this skill from "just ask ComfyUI for a dragon." Spend time on prompt assembly.
- **Don't promise palette compliance.** Generative art will drift. The skill's job is to send the best prompt; the user's job is to review.
- **Failures aren't show-stoppers.** A 13-asset batch with 1 failure is a normal outcome. Log, continue, surface.
- **Match `/art` invocation style.** Check `C:/GameMaking/CLAUDE.md` for the canonical `/art` flags — pass through `--out`, `--type` (card_illustration vs ui_icon vs character_sprite) as appropriate per asset category.
- **The user owns regeneration.** Don't auto-retry beyond once; don't propose alternative prompts unless asked. The user can iterate manually.
- **Per `gmk-prototype-rules` §6**, prototypes don't reference external asset files (the exception is hypothesis-is-about-art). So most assets generated here are *for the engine port*, not for the HTML prototype. Make this explicit in the summary so the user doesn't try to wire them into the HTML.
