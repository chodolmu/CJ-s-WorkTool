---
name: gmk-refactor-check
description: Audit an HTML prototype for tech debt, complexity hot spots, and dead code before /gmk-port translates it to the engine. Reports per-function complexity (LOC, branches, depth), unreferenced code paths, comments-vs-code drift, and untouched-since-creation regions. Writes _workspace/milestones/<id>/refactor-check.md. Use when the user says "/gmk-refactor-check <milestone>", "code review the prototype", "refactor check", "dead code", or before /gmk-port on a prototype that's been edited many times. Read-only on the prototype file.
model: sonnet
---

# gmk-refactor-check — Catch the rot before porting

A prototype that earned a PASS verdict over three rounds of `/gmk-prototype` edits + `/gmk-validate` runs usually accumulates dead branches, copy-paste twins, and "TODO: clean up" comments. Porting that into Godot/Unity drags the rot into the engine project where it's expensive to fix later.

This skill is the **last-mile audit** before `/gmk-port`. It doesn't refactor; it surfaces what to consider refactoring. Whether the user acts on the report is their call.

Output: a markdown file with three sections — **Complexity hot spots**, **Likely dead code**, **Comment drift / leftover TODOs** — plus a concise verdict on porting risk.

## Preconditions

1. **Milestone exists** in `.gamemaker-kit/milestones.json`.
2. **Prototype file exists** at the milestone's `prototype` path.
3. **The prototype isn't trivially tiny.** If LOC < 80, the skill stops: *"Prototype is under 80 lines — refactor check has no signal at this size. Skip; go to /gmk-port."*

The skill works fine on prototypes that haven't passed `/gmk-validate` yet — but it's most useful after a few rounds of iteration.

_Standard preconditions (milestone-id resolution, empty/partial state, refuse-chain cycle guard, kit_version read contract) follow `gmk-prototype-rules` Rule 13-14, 16._

## Flow

### Step 1 — Read the prototype

Read the entire HTML file. Strip the hypothesis header comment block (per `gmk-prototype-rules` §8) from the analysis — comments inside the header are documentation, not code drift.

Count:
- Total lines (matching `gmk-prototype-rules` §2 — non-blank, non-comment lines of code)
- Lines inside `<script>` tags
- Lines inside `<style>` tags
- Lines of inline HTML

### Step 2 — Per-function complexity scan

Find every top-level function and every method-style nested function in the `<script>` block. For each, compute:

- **LOC** (function body, ignoring blank lines)
- **Branch count** — number of `if`/`else if`/`switch case`/`?:` operators (rough cyclomatic proxy)
- **Max nesting depth** — counting blocks (`{...}`) nested inside the function body
- **Calls out** — number of other top-level functions this one calls

Thresholds (calibrated for HTML prototypes, not production code):

| Metric | Healthy | Warning | Hot spot |
|---|---|---|---|
| LOC | ≤ 25 | 26-50 | > 50 |
| Branches | ≤ 5 | 6-10 | > 10 |
| Nesting | ≤ 3 | 4 | ≥ 5 |
| Calls out | ≤ 4 | 5-8 | > 8 |

A function flagged as "hot spot" on **any** dimension goes in the report. A function flagged on **two or more** is double-starred and surfaced first.

Output table:

```
## Complexity hot spots

| Function       | LOC | Branches | Nesting | Calls out | Why flagged |
|----------------|-----|----------|---------|-----------|-------------|
| resolveMerge   | 67  | 12       | 5       | 3         | ★★ LOC + branches + nesting all hot |
| renderTile     | 41  | 4        | 2       | 1         | ★ LOC warn |
| onClick        | 12  | 11       | 3       | 5         | ★ Branches hot |
```

If zero functions are flagged, skip this section entirely — write a single line: *"No complexity hot spots (largest function: `resolveMerge` at 18 LOC, 3 branches)."*

### Step 3 — Likely dead code scan

Find code that almost certainly never executes. Categories:

- **Unreferenced top-level functions** — declared but never called.
- **Unreferenced consts/lets at module scope** — declared but never read.
- **Branches whose conditions are statically false** — `if (false)`, `if (0)`, `if (CONFIG.DEBUG && false)`.
- **Unreachable code after `return` / `throw`** — within a function, code after an unconditional terminator.
- **Event handlers attached to elements that no longer exist** in the HTML (id mismatch).
- **CSS rules whose selectors don't match anything in the HTML.** (Best-effort — class names dynamically added via JS won't show up; flag with a "may be dynamic" note.)

Don't run AST analysis perfectly — this is a heuristic skill. If a "dead" function is referenced via a string (e.g. `window['handleClick']()` or `setTimeout('foo', 100)`), you may miss it. Note this caveat in the report.

Output:

```
## Likely dead code

- Function `handleLevelUp` — declared at line 87, never called from anywhere. (Possibly referenced via string; the heuristic may be wrong.)
- Const `MAX_RETRIES = 3` (line 12) — never read.
- Branch `if (false) { ... }` at line 142 — 6 lines unreachable.
- CSS rule `.game-paused` (line 18 of style) — class never added by JS scan.
```

Cap the list at 15 items. If more, write "(plus N more — read the file for the full picture)" and surface the most line-expensive 15.

### Step 4 — Comment drift / leftover TODO scan

Find:

- **`TODO`, `FIXME`, `HACK`, `XXX` comments** — anywhere in the file.
- **Comments that contradict adjacent code** — heuristic: a comment claiming a function "always returns true" when the function has an `if/return false` branch within 5 lines.
- **Comments referencing functions or variables that no longer exist** — `// foo() handles this` when `foo` isn't defined.
- **"Temporary" / "remove me" markers** — comments containing words like "temporary," "remove later," "until …," "draft."

Output:

```
## Comment drift / leftover TODOs

- Line 23: `// TODO: clean up after demo` — three months old.
- Line 89: `// resolveMerge always increments score` — but resolveMerge has an early-return at line 92 that skips the increment. Comment is stale.
- Line 145: `// see oldMergeLogic()` — `oldMergeLogic` doesn't exist.
```

### Step 5 — Untouched-since-creation regions

If the prototype has git history (`git blame` available), find functions whose every line was added in the original commit and never touched since. These are sometimes the "stable foundation" but more often "the code I copy-pasted from the template and forgot about."

Don't fail if git isn't available; just skip this section.

```
## Untouched regions

- Function `initCanvas` (lines 30-54) — untouched since first commit (2026-04-12).
  This is fine if it's the standard canvas setup; suspicious if the prototype
  has substantially changed since then.
```

### Step 6 — Porting risk verdict

Roll up the four sections into a single verdict for the user's port decision:

- **CLEAN** — zero hot spots, ≤ 2 dead-code items, ≤ 2 leftover TODOs. Port should translate cleanly.
- **WARN** — 1-3 hot spots, OR 3-10 dead-code items, OR 3-10 leftover TODOs. Port is doable but expect translation drift on the hot spots; consider a 30-min cleanup first.
- **HIGH RISK** — 4+ hot spots, OR 10+ dead-code items, OR a hot spot inside the mechanic's core function (the one matching the IF subject). Don't port yet. Refactor first.

The verdict is **advisory**. `/gmk-port` still works on a HIGH RISK prototype; it just warns.

### Step 7 — Write the report

Path: `_workspace/milestones/<milestone-id>/refactor-check.md`. Overwrite.

Template:

```markdown
# Refactor check — {milestone.id} {milestone.name}

> Generated: {timestamp} by /gmk-refactor-check. Verdict: {CLEAN | WARN | HIGH RISK}.

## Summary
- Total LOC: {N}
- Script LOC: {N}
- Style LOC: {N}
- Functions: {count}
- Hot spots: {count}
- Dead-code items: {count}
- Leftover TODOs: {count}

## Complexity hot spots
{table or single-line "none"}

## Likely dead code
{list or "none"}

## Comment drift / leftover TODOs
{list or "none"}

## Untouched regions
{list or "skipped (no git history)" or "none"}

## Porting risk
{1-3 sentences with the verdict and what to focus on if cleanup is warranted}

## Next
- {/gmk-port <id> — if CLEAN or WARN, proceed (with caveats noted above)}
- {Clean up <name1>, <name2> first — if HIGH RISK or the user prefers}
```

## Output: tell the user what happens next

```
Refactor check: m1-merge-feel — VERDICT: WARN

  Total LOC: 287   Functions: 8   Hot spots: 1   Dead code: 4   TODOs: 2

  Hot spot:
    resolveMerge — 67 LOC, 12 branches, depth 5. This is the mechanic core;
    consider extracting the species-pair lookup into a const map before /gmk-port.

  Dead code (4): unreferenced handleLevelUp, MAX_RETRIES const, two CSS rules.
  TODOs (2): both pre-validation; safe to leave or sweep.

Next:
  - /gmk-port m1-merge-feel — works on WARN, but expect resolveMerge to need manual cleanup in the engine port.
  - Spend 20 min cleaning resolveMerge first — see refactor-check.md.
```

## Edge cases & policy

### The prototype is highly compressed (a one-liner monster function)

Heuristics that count "LOC per function" will miss one-liner monsters that pack 30 statements into one logical line. If the script LOC is high but no function is flagged, scan for one-liners with ≥ 5 semicolons OR ≥ 3 logical operators. Flag those specifically: *"Function `update` is one expression but contains 8 statements via chaining. Hard to port cleanly."*

### Prototype uses a state machine via object lookup

`const stateActions = { idle: ..., playing: ..., over: ... }` is fine even if it looks "fat." Don't flag based on raw LOC if the function is a dispatch table with simple cases. Check for branching density — high LOC + low branches usually means a lookup table, not a hot spot.

### Prototype has heavy `<style>` with utility classes

If the CSS LOC dominates total LOC, note it: *"Style block is {N} lines vs script {M}. Most of this won't port directly — the engine has its own rendering. Plan for total restyle on port."*

### Re-running after a refactor

The skill always re-scans from scratch. Don't try to diff against the previous report; the user has git history.

### Prototype passes the line cap (gmk-prototype-rules §2) but barely

If LOC is 285+ (close to the 300 soft cap), surface it: *"Within the 300-line soft cap but trending up. If you'd planned to add anything, that pushes past the warning. Consider /gmk-mechanic-merge to split into two milestones."*

## What this skill does NOT do

- **Doesn't refactor.** Surfaces issues; the user fixes (or ignores).
- **Doesn't run on engine code.** HTML prototypes only. Engine-side audit is `/gmk-port`'s 5-stage gate.
- **Doesn't check correctness.** No type-checking, no runtime errors. That's `/gmk-validate`'s preflight.
- **Doesn't suggest specific refactorings.** "Extract this 67-line function" is the suggestion limit; what the new functions should look like is the user's call.
- **Doesn't fail-block `/gmk-port`.** HIGH RISK is advisory; `/gmk-port` still runs.

## Notes for the model running this skill

- **One report, no follow-ups.** Don't offer to "fix the worst hot spot now." The user owns the cleanup decision.
- **Heuristics will miss things.** Note caveats inline ("may be dynamic," "git unavailable"). Don't overclaim.
- **The mechanic core matters more than other functions.** A 67-line `init` is less worrying than a 40-line `resolveMerge` (the function that implements the IF). When ranking hot spots, surface mechanic-core functions first.
- **TODOs are not all equal.** A pre-validation TODO ("clean up after demo") is fine to leave on a passing prototype. A post-validation TODO ("the merge sometimes drops a frame") is unresolved technical debt that will translate to the engine.
- **Don't add new TODOs.** Tempting to inject `// TODO: refactor (see refactor-check.md)` comments — don't. The markdown report is the artifact.
