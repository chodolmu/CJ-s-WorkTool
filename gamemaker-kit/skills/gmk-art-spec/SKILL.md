---
name: gmk-art-spec
description: Draft a milestone's art specification — name the distinct visual assets needed (species/tiles/effects/UI states), lock the palette, declare style anchors, and surface consistency risks before any pixels are made. Writes _workspace/milestones/<id>/art-spec.md. Use when the user says "/gmk-art-spec <milestone>", "art list", "팔레트 잠궈줘", "asset spec", "art consistency check", or after /gmk-content-plan and before /gmk-art-gen. Read-only on pillars.json + milestones.json + content-plan; writes one markdown file.
model: sonnet
---

# gmk-art-spec — Name the assets, lock the palette, before pixels exist

Asset drift is the cheapest-to-cause and most-expensive-to-fix problem in 2D game art. Without an upfront spec, you commission 9 dragon sprites, discover at milestone 4 that two of them clash with the background palette, and now have to redo three.

This skill writes down — **before** any art runs — what assets exist, what they look like in plain language, what palette they share, and what style anchors keep them coherent. Then `/gmk-art-gen` (or a human artist) has a reference document instead of a vibe.

Output: a markdown spec with sections for **asset list**, **palette**, **style anchors**, **resolution/format**, **consistency risks**. No images generated — that's `/gmk-art-gen`'s job.

## Preconditions

1. **Milestone exists** in `.gamemaker-kit/milestones.json` with `pillars_targeted` non-empty.
2. **Pillars are bound** — the visual style should serve the pillars.
3. **Content plan exists OR milestone needs no curve.** Read `_workspace/milestones/<id>/content-plan.md` if present (it tells you how many of each asset). If absent and the milestone is volume-driven, suggest running `/gmk-content-plan` first.

_Standard preconditions (milestone-id resolution, empty/partial state, refuse-chain cycle guard) follow `gmk-prototype-rules` Rule 13-14._

## Flow

### Step 1 — Read the pillars + hypothesis

What visual signal does each pillar want?

- **Tactile-satisfaction** → chunky shapes, hit-stop-friendly silhouettes, juicy particle palettes
- **Discovery-joy** → variety within consistency, distinctive silhouettes per species/tier
- **Greed-vs-safety** → readable danger states (red = risk, green = safe), clear cause-effect visual chains
- **Calm/focus** → muted palette, soft transitions, no jitter
- ... whatever pillars the user defined

Surface the pillar → visual implication chain at the top of the report. The user reads this and may reject the implication (*"actually the tactile pillar wants thin lines, not chunky"*) — accept the correction once and proceed.

### Step 2 — Enumerate distinct visual assets

From the content plan (or directly from the hypothesis if no plan):

- **Characters / actors** (dragons, enemies, the player)
- **Tiles / environment elements** (grid cells, floors, walls, backgrounds)
- **Effects** (particle systems, hit-stop overlays, screen-shake confirms)
- **UI states** (score readout, win/lose state, paused state)
- **Empty/null states** (an empty grid cell, the "ready to start" screen)

For each, write **one line** of plain description (not art direction, just what it *is*). Example:

```
## Asset list

### Characters
- Dragon R (tier-1) — red, small, single horn, idle puff animation
- Dragon G (tier-1) — green, small, two horns, idle wing-flutter
- Dragon B (tier-1) — blue, small, finned, idle ripple
- Dragon RG (tier-2, R+G merge) — orange, medium, four horns
- ... (up to the content-plan count)

### Tiles
- Empty cell — slot for one dragon, slight inset shadow
- Hover cell — empty-cell variant when bot/cursor is over it

### Effects
- Merge burst — 8-particle radial burst at merge moment, palette pulled from the
  two source dragons (red + green = orange flecks)
- Hit-stop overlay — full-screen 0.3s flash, neutral cream tint

### UI states
- Score readout — single number, top-right, monospace
- Win banner — appears on isOver() == true with score above threshold
- Stuck banner — appears on isOver() == true with empty legalActions and no win
```

Cap practical: ~20 distinct assets per milestone. More than that is overscoped — push back: *"This milestone names 28 distinct assets. Either the content plan is over-specified or this is really two milestones. Want to /gmk-mechanic-merge or split?"*

### Step 3 — Lock the palette

A palette is a small list of named colors (3-8 entries) with hex codes. Every asset in the spec must be expressible in this palette.

```
## Palette (locked)

| Name        | Hex       | Where it appears                              |
|-------------|-----------|-----------------------------------------------|
| ember       | #E04F3B   | Dragon R body, merge burst (warm half)        |
| moss        | #4FA844   | Dragon G body, merge burst (cool half)        |
| sky         | #4F8EE0   | Dragon B body, hover-cell tint                |
| cream       | #F5EFD8   | UI text, hit-stop overlay tint                |
| coal        | #2A2A2E   | Outlines, score numerals                      |
```

**Locking** means: assets generated downstream must use these colors only. Variations within an asset (highlights, shadows) come from lightening/darkening the listed hex, not introducing new hues. Anti-example: a "purple" highlight on Dragon R smuggles a sixth color into the palette and breaks consistency.

If the user has Pillar `anti_examples` involving palette ("avoid muddy/grayed-out colors"), surface them here as palette-level constraints.

### Step 4 — Style anchors

Three to five short statements that define the visual feel. Anchors are **action-oriented** ("favor X") not descriptive ("looks nice"). Examples:

```
## Style anchors

- **Chunky silhouettes.** Read at 16×16; recognizable at 32×32. Avoid thin lines or
  high detail that smears at small sizes.
- **Two-tone shading.** Each asset uses base color + 1 darker shade for shadow.
  No gradients, no anti-aliased ramps.
- **Visible outlines.** All foreground assets carry a 1-pixel coal outline. UI text
  outline thickness matches.
- **Animation: 2-frame idle, 4-frame action.** No tweening. No mid-tier (3-frame).
- **No text inside sprites.** UI is the only place text lives.
```

Anchors are the most-cited part of the spec when downstream art gets reviewed. Keep them short and memorable.

### Step 5 — Resolution & format

Practical specs for `/gmk-art-gen` and human artists:

```
## Resolution & format

- Dragons:            64×64 PNG, transparent background, 2x for retina (128×128 source)
- Tiles:              32×32 PNG, opaque
- Effects:            spritesheet, 256×256 (8 frames @ 32×32 each)
- UI elements:        SVG or 1× PNG, sized by use (banner: 256×64)
- Color depth:        24-bit + alpha; indexed-color OK if palette ≤ 16 entries
- Naming convention:  <category>-<id>-<variant>.png  (e.g. dragon-r-idle.png, dragon-rg-merge.png)
```

If the engine target imposes constraints (Godot prefers PowerOf2 textures for some pipelines, Unity has 2-power preferences for compression), note them. Don't fabricate constraints the user hasn't named.

### Step 6 — Consistency risks (1-3, optional)

The places asset drift is most likely:

```
## Consistency risks

- **Tier-2 dragons inherit color from both parents.** RG = ember + moss. A naive
  generation pass may produce "olive" or "khaki" (a third hue). Constrain the
  generator to literally interpolate or stripe the two listed hexes.
- **Merge burst particles.** Easy to drift into random rainbow palettes. Lock to
  the two source dragon colors only.
```

These are also the items `/gmk-art-gen` should pay extra attention to and `/gmk-port` should re-verify visually after engine port.

### Step 7 — Write the spec

Path: `_workspace/milestones/<milestone-id>/art-spec.md`. Overwrite.

Template:

```markdown
# Art spec — {milestone.id} {milestone.name}

> Generated: {timestamp} by /gmk-art-spec. Locked palette below.

## Pillars → visual implications
- {pillar.id}: {1-line implication}

## Asset list
{sections by category}

## Palette (locked)
{table with hex codes}

## Style anchors
{3-5 action-oriented statements}

## Resolution & format
{bullet list}

## Consistency risks
{1-3 items, optional}

## Next
- /gmk-art-gen <milestone> — generate the locked asset list via the ComfyUI pipeline
- /gmk-task-split <milestone> — slot the art tasks into the kanban
```

### Step 8 — Don't touch milestones.json

Working doc only. The spec doesn't add fields to the milestone — `/gmk-task-split` reads the spec to create art tasks, which write into `milestones.json` `tasks[]`.

## Output: tell the user what happens next

```
Art spec written: _workspace/milestones/m2-dragon-evo/art-spec.md
Assets: 13 named (3 tier-1, 6 tier-2, 4 tiles/UI)
Palette: 5 colors locked (ember, moss, sky, cream, coal)
Style anchors: 5
Consistency risks: 2 flagged (tier-2 merge colors, particle palette drift)

Next:
  - /gmk-art-gen m2-dragon-evo  — generate via ComfyUI pipeline (will read this spec)
  - /gmk-task-split m2-dragon-evo — add art tasks to the kanban
```

## Edge cases & policy

### The user wants procedural / generative art (no static asset list)

For a prototype whose visuals are fully procedural (shader or canvas-drawn), the asset list collapses to "the procedural style description." Write the **palette** + **style anchors** sections; skip asset list and resolution. Note: *"Procedural milestone — no static asset list. Palette and anchors carry the spec."*

### The hypothesis is about art/sound feel specifically

If the IF directly mentions a visual ("a satisfying particle burst on merge"), the art spec is load-bearing for the hypothesis itself. Surface this loudly: *"This milestone's hypothesis depends on the visual itself. Asset quality drift will fail /gmk-self-test even if the bot passes. Spend extra time on the merge-burst spec."*

### Re-running after assets exist

If `/gmk-art-gen` has already produced some assets, **don't re-spec from scratch in a way that orphans them**. Read the existing files; tag each as "already-generated" in the asset list. The user decides whether to regenerate (because the palette changed) or keep.

### Palette has more than 8 entries

Push back: *"8+ palette entries usually means the milestone is using color to substitute for shape. Can two of these collapse into shade variations of one base, or are these all load-bearing distinctions?"*

### The user names "pillar-violating" colors

If a pillar's anti_example is "muddy/grayed-out colors" and the user proposes a hex like `#666666`, flag it: *"`#666666` matches the tactile-satisfaction anti-example ('muddy/grayed-out'). Replace or override?"*

### Asset count exceeds the content plan's target

If content plan says "9 species by end of session" and the spec lists 13 dragon sprites, surface the gap: *"Spec has 13 dragon assets but the content plan targets 9 species. Either tighten the spec to 9 + variants, or update the content plan."*

## What this skill does NOT do

- **Doesn't generate art.** That's `/gmk-art-gen`'s wrapper around `/art` (ComfyUI pipeline). This skill is the spec/reference.
- **Doesn't pick the palette automatically.** Surfaces pillar implications; the user chooses hex codes (with the skill's nudges).
- **Doesn't run a visual diff.** That's `/gmk-port`'s re-validation gate, after engine port.
- **Doesn't enforce file paths.** The spec names a convention; downstream tools follow it but this skill doesn't move files.
- **Doesn't generate animation specs in detail.** Frame counts only. Detailed timing curves are out of scope.

## Notes for the model running this skill

- **The palette is the load-bearing section.** Style anchors and resolution drift gracefully; palette drift breaks consistency permanently. Spend the most attention here.
- **Locking is a promise.** "Locked" means downstream tools should treat the listed hex codes as immutable. Don't soften with "starting palette" or "draft hexes."
- **Tier color logic is a frequent trap.** When the user says "tier-2 inherits from parents," ask whether that means literal interpolation, stripe pattern, or symbol overlay. Don't guess — the answer determines whether `/gmk-art-gen` can do it cleanly.
- **Don't art-direct.** "Use blues for the dragon" is fine; "use cobalt with phthalocyanine highlights" is over-direction the user didn't ask for. Match the user's vocabulary.
- **Pillars first, aesthetics second.** If the user has a beautiful palette idea that violates a pillar (anti-example), pillars win. Cite the anti_example verbatim.
- **One spec per milestone.** Don't try to write a project-wide art bible — each milestone gets its own spec, and shared visuals get re-stated (with the same hexes) for each milestone that uses them. Cheap repetition beats expensive coupling.
