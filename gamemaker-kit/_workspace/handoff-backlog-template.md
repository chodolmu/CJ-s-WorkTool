# HANDOFF backlog candidate template (v0.8+ convention)

This document describes the **mandatory shape** of each candidate in a HANDOFF.md "next release backlog" section. Adopted in v0.8 to mitigate F21 (HANDOFF authors anchor to their own grep work and understate the backlog).

The Protocol 1 work-start evaluator runs against this shape — if a candidate is missing one of the required fields, the evaluator's job becomes harder, the correction count goes up, and F21 closure regresses.

---

## Required fields per candidate

Each candidate in the "next release backlog" section MUST include:

### 1. **Affected file:line sites** with the **grep query used** to find them

> Bad: *"Refactor the shader template."*
> Good: *"Refactor `templates/prototype-shader.html` (401 lines). Found by: `find templates skills -name '*.html' -o -name 'SKILL.md' | xargs wc -l | sort -rn | head -10`."*

The grep query lets a future Protocol 1 evaluator **re-run the same query** and check whether the author missed sites. Without it, the evaluator has to guess what the author looked at.

### 2. **Explicit non-targets** — what would NOT be touched, with reasons

> Bad: *"Rule 17 read-migration for `pillars.kind`."*
> Good: *"Rule 17 read-migration. Targets: gmk-prototype:78-82, gmk-self-test:305. **Non-targets**: gmk-status, gmk-validate (don't route on pillar shape — don't need Rule 17). gmk-init (writer, not reader)."*

Non-targets are the part the author thought about but decided not to touch. Surfacing them lets the Protocol 1 evaluator either ratify ("yes, gmk-status really doesn't route on shape") or push back ("actually gmk-roadmap also reads pillar.kind — you missed it").

### 3. **Classification** — one of these tags

- **sweep** — same change applied across many SKILLs (e.g., Rule 14 token sweep, footer amendment)
- **single-fix** — one focused change in one or two files (e.g., shader template refactor, one stale allowlist entry)
- **structural-guard** — adds a check to `scripts/check-plugin-meta.sh` (e.g., Check G)
- **process** — changes how the kit works as a development process, not what the kit emits (e.g., HANDOFF template itself, Protocol-1 corrections retrospective)

Classification flags which defect classes apply:
- *sweep* candidates are vulnerable to half-application (v0.4/v0.5/v0.6/v0.7 pattern)
- *single-fix* candidates rarely have hidden sites
- *structural-guard* candidates need to verify they don't regress existing PASS state
- *process* candidates need a measurable success criterion

### 4. **Defect-class link** (optional but recommended)

If the candidate addresses a known defect class (Rule 14 half-application, declared-but-half-applied field, F21 anchoring, allowlist staleness), name it. Linking to the class lets future readers see whether the kit is closing classes faster than it opens them.

---

## Example candidate (good shape)

```markdown
### T1-B. Candidate #3 reframed: Rule 17 (`pillars.kind` enum read contract) + Check G + read-site migration

**Classification**: sweep + structural-guard (composite)
**Defect class**: declared-but-half-applied field (same as kit_version v0.7)

**Targets** (found by `grep -rn '\.kind' skills/`):
- skills/gmk-prototype/SKILL.md:78-82 — shape→metric routing table
- skills/gmk-self-test/SKILL.md:305 — feel-engineer routing row
- skills/gmk-init/SKILL.md:163-175 — schema example
- scripts/check-plugin-meta.sh — add Check G

**Non-targets** (would NOT touch, because they don't route on pillar shape):
- gmk-status, gmk-validate, gmk-roadmap, gmk-shape-advisor — read `pillars[].id` and `pillars[].name` but not shape
- gmk-portability-check — reads `supported_genres_check`, not `kind`
- 25 other SKILL footers — stay at "Rule 13-14, 16"; only the 2 shape-routers go to "Rule 13-14, 16, 17"

**Work**:
1. Add Rule 17 to gmk-prototype-rules (4-case table, mirrors Rule 16 form)
2. Add Check G to check-plugin-meta.sh (WARN-level)
3. Migrate the 2 read-sites to consume the field
4. Add `kind` to gmk-init schema example + writer guidance
```

This is the shape evaluators will assume. Anything sloppier increases F21 risk.

---

## Protocol-1 corrections retrospective field

Every release's CHANGELOG entry (and HANDOFF post-release section) MUST include:

```markdown
**Protocol 1 corrections**: <N> items (<X> ADD + <Y> REMOVE + <Z> VERIFY + <W> RECLASSIFY) + <M> missing candidates
```

This is the **F21 closure metric**. Definitions:
- **ADD**: Protocol 1 found sites/work the HANDOFF backlog missed
- **REMOVE**: Protocol 1 found the HANDOFF backlog claimed sites that don't apply (false positives)
- **VERIFY**: Protocol 1 wants the author to double-check before work
- **RECLASSIFY**: Protocol 1 thinks the candidate is in the wrong classification or framing
- **Missing candidates**: entirely new candidates Protocol 1 surfaced that weren't in the HANDOFF

### F21 closure criterion

F21 ("HANDOFF authors anchor to their own grep") is **closed** when the Protocol 1 correction count is **< 1 per candidate** (i.e., averaging less than one correction per candidate proposed) for **3 consecutive releases**.

Track over time:

| Release | Candidates proposed | Protocol 1 corrections | Missing candidates | Ratio (corrections/candidate) |
|---|---|---|---|---|
| v0.6 | (process new) | (process new) | (process new) | n/a |
| v0.7 | 4 | 7 | 0 | 1.75 |
| v0.8 | 5 | 14 | 3 | 2.80 + 3 |
| v0.9 | TBD | TBD | TBD | TBD |

A *rising* ratio means HANDOFF authors are getting worse at scope estimation. A *falling* ratio means the template (this document) and discipline are working. F21 is closed when ratio < 1.0 for 3 releases.

---

## Why this template exists

Three releases (v0.5, v0.6, v0.7, v0.8) in a row, the HANDOFF author understated the backlog. Each time, the post-release evaluator made the HANDOFF author the next release's evaluator. Each time, that evaluator anchored on their own grep work and missed sites — until the next post-release evaluator caught it.

The shape of the fix is: stop letting "I checked, looks complete" stand as a backlog. Make the HANDOFF backlog *falsifiable* — include the queries, include the non-targets, and let the next evaluator try to break it.

This document is the falsifiability contract.
