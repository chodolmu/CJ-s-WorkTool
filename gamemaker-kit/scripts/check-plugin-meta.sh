#!/usr/bin/env bash
# scripts/check-plugin-meta.sh
# Sanity check for plugin meta files before tagging a release.
#
# Claude Code plugins auto-discover skills/ at runtime, so plugin.json and
# marketplace.json don't have to enumerate individual SKILL files. This script
# checks the basics that *can* drift:
#  - version field matches between plugin.json and marketplace.json
#  - skills/ count looks reasonable (sanity floor: ≥20 — kit has 29 in v0.4)
#  - description's "N skills" mention matches actual skills/ count
#
# v0.6 additions (defect-class guards — catch half-applied declared standards):
#  A. Rule 14 token presence in SKILLs with refuse-with-recommendation patterns
#  B. "endpoint" terminology drift in user-facing docs (with allowlist)
#  C. Rule 13-14 citation footer presence in SKILLs with Preconditions sections
#
# v0.7 additions:
#  D. kit_version consistency between plugin.json and the schema examples
#  E. Templates 300-line soft cap / 600-line hard cap (per gmk-prototype-rules Rule 2)
#  F. Templates carrying __gmk_botHook__ must declare _gmkApiVersion: 1 (Rule 4)
#
# Severity (v0.7):
#  Check A (Rule 14 token) — FAIL (promoted from WARN; baseline stable since v0.6).
#  Check C (Rule 13-14 footer) — FAIL (promoted; mechanical grep, near-zero false positive).
#  Check B (endpoint terminology) — WARN (still permissive; regex needs whole-word
#    tightening + line-level allowlist before v0.8 FAIL promotion).
#  Checks D / E / F — WARN (v0.7 baseline). v0.8 may promote once stable.
#
# Usage:
#   bash scripts/check-plugin-meta.sh
#
# Exit codes:
#   0 — checks pass (warnings allowed)
#   1 — drift detected on hard checks (version / skills floor / count mismatch /
#       Check A / Check C)
#   2 — missing meta file

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

PLUGIN_JSON=".claude-plugin/plugin.json"
MARKETPLACE_JSON=".claude-plugin/marketplace.json"

if [ ! -f "$PLUGIN_JSON" ]; then
  echo "ERROR: $PLUGIN_JSON not found"
  exit 2
fi

if [ ! -f "$MARKETPLACE_JSON" ]; then
  echo "ERROR: $MARKETPLACE_JSON not found"
  exit 2
fi

drift=0
warn=0

# Check 1: version field consistency
plugin_version=$(grep -oE '"version"[[:space:]]*:[[:space:]]*"[^"]+"' "$PLUGIN_JSON" \
  | head -1 | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')
mp_version=$(grep -oE '"version"[[:space:]]*:[[:space:]]*"[^"]+"' "$MARKETPLACE_JSON" \
  | head -1 | sed -E 's/.*"version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')

echo "plugin.json version:       $plugin_version"
echo "marketplace.json version:  $mp_version"

if [ "$plugin_version" != "$mp_version" ]; then
  echo "DRIFT: version mismatch between plugin.json and marketplace.json"
  drift=1
fi

# Check 2: skills/ directory sanity floor
# Count only directories with a SKILL.md (the canonical SKILL marker),
# not arbitrary subdirs that may sit under skills/ (e.g., a scripts/ helper dir).
disk_count=$(find skills -maxdepth 2 -name SKILL.md -type f | wc -l | tr -d ' ')
echo "skills/ count:             $disk_count"

if [ "$disk_count" -lt 20 ]; then
  echo "WARN: skills/ has $disk_count entries — looks low. v0.4 ships 29. Confirm this isn't an accidental deletion."
  drift=1
fi

# Check 3: description's "N skills" mention
declared_count=$(grep -oE '[0-9]+ skills' "$PLUGIN_JSON" | head -1 | grep -oE '[0-9]+')
if [ -n "$declared_count" ]; then
  echo "plugin.json description mentions: $declared_count skills"
  if [ "$declared_count" != "$disk_count" ]; then
    echo "DRIFT: plugin.json description says \"$declared_count skills\" but skills/ has $disk_count"
    drift=1
  fi
fi

# Check A (v0.6, WARN): Rule 14 token presence in refuse-with-rec SKILLs
# Any SKILL whose body contains the user-facing string "Run /gmk-" or "run `/gmk-"
# should carry at least one "[Rule 14" token (single-target or — CYCLE form).
# Rationale: gmk-prototype-rules:398 declared the token mandatory in v0.5,
# but v0.5 only applied it to 2 SKILLs. This check catches future half-applied
# sweeps of the same defect class.
echo ""
echo "Check A: Rule 14 token presence (FAIL-level in v0.7)"
RULE14_ALLOWLIST="scripts/.rule14-allowlist.txt"
rule14_missing=0
for f in skills/*/SKILL.md; do
  if grep -qE 'Run /gmk-|run `/gmk-' "$f"; then
    if ! grep -qE '\[Rule 14' "$f"; then
      # Allowlist: <skill>/SKILL.md:<line> entries exempt that specific line
      # (line-level granularity per v0.7 Q1; was file-level in v0.6).
      skill_key="${f#skills/}"
      hit_lines=$(grep -nE 'Run /gmk-|run `/gmk-' "$f" | cut -d: -f1)
      uncovered=0
      for ln in $hit_lines; do
        key="${skill_key}:${ln}"
        if [ -f "$RULE14_ALLOWLIST" ] && grep -Fxq "$key" "$RULE14_ALLOWLIST"; then
          continue
        fi
        uncovered=$((uncovered + 1))
      done
      if [ "$uncovered" -eq 0 ]; then
        continue
      fi
      echo "  FAIL: $f has $uncovered un-allowlisted refuse-with-recommendation site(s) but no [Rule 14 token"
      rule14_missing=$((rule14_missing + uncovered))
    fi
  fi
done
if [ "$rule14_missing" -eq 0 ]; then
  echo "  OK — every SKILL with refuse-with-rec carries a [Rule 14 token (or is line-allowlisted)"
else
  echo "  $rule14_missing site(s) missing the token. See gmk-prototype-rules Rule 14."
  drift=$((drift + rule14_missing))
fi

# Check B (v0.6, WARN): "endpoint" terminology drift in user-facing docs
# Per v0.5 honesty note + v0.6 amendment: dev-complete is a release-readiness
# checkpoint, not an endpoint. Scan live docs (skills/, CONCEPT.md, README.md,
# _workspace/structure.md, .claude-plugin/marketplace.json). The allowlist
# excludes intentional uses (meta-discussion of the rename, semantic distinct,
# intentional contrast). Frozen history (CHANGELOG, HANDOFF, _workspace/v0.X-*)
# is excluded by path filter.
echo ""
echo "Check B: 'endpoint' terminology drift (WARN-level — pending whole-word regex tightening for v0.8)"
ALLOWLIST="scripts/.endpoint-allowlist.txt"
endpoint_hits=0
scan_paths=(
  skills
  CONCEPT.md
  README.md
  _workspace/structure.md
  .claude-plugin/marketplace.json
)
while IFS= read -r match; do
  [ -z "$match" ] && continue
  if [ -f "$ALLOWLIST" ] && grep -Fxq "$match" "$ALLOWLIST"; then
    continue
  fi
  echo "  WARN: $match"
  endpoint_hits=$((endpoint_hits + 1))
done < <(grep -rnIE -i 'endpoint' "${scan_paths[@]}" 2>/dev/null \
          | grep -vE '^_workspace/v0\.[0-9]+-' \
          | awk -F: '{print $1":"$2}')
if [ "$endpoint_hits" -eq 0 ]; then
  echo "  OK — no unexpected 'endpoint' occurrences in live docs"
else
  echo "  $endpoint_hits occurrence(s). Convert to 'checkpoint' or add to $ALLOWLIST with justification."
  warn=$((warn + endpoint_hits))
fi

# Check C (v0.6, WARN): Rule 13-14 citation footer in SKILLs with Preconditions
# v0.4 CHANGELOG L133 declared "27 skills got a 1-line Rule 13-14 citation".
# Same defect-class shape as Rule 14: declared sweep that could drift over time.
# Every SKILL with a "## Preconditions" section must carry the footer.
echo ""
echo "Check C: Rule 13-14 citation footer (FAIL-level in v0.7)"
footer_missing=0
for f in skills/*/SKILL.md; do
  if grep -qE '^## Preconditions' "$f"; then
    if ! grep -qE 'Standard preconditions.*Rule 13-14' "$f"; then
      echo "  FAIL: $f has ## Preconditions but no 'Rule 13-14' citation footer"
      footer_missing=$((footer_missing + 1))
    fi
  fi
done
if [ "$footer_missing" -eq 0 ]; then
  echo "  OK — every SKILL with ## Preconditions carries the Rule 13-14 footer"
else
  echo "  $footer_missing SKILL(s) missing the footer."
  drift=$((drift + footer_missing))
fi

# Check D (v0.7, WARN): kit_version consistency
# kit_version is the schema-version stamp v0.4 introduced. Writer: gmk-init.
# v0.7 starts reading it (warn-only on future versions per shape (d)).
# This check verifies the schema example files declare kit_version and that
# the value's MAJOR.MINOR matches the plugin.json version's MAJOR.MINOR.
# Drift here means examples were not bumped during a release.
echo ""
echo "Check D: kit_version consistency in examples (WARN-level in v0.7)"
kv_missing=0
plugin_mm=$(echo "$plugin_version" | awk -F. '{print $1"."$2}')
for f in _workspace/examples/pillars-example.json _workspace/examples/milestones-example.json; do
  if [ ! -f "$f" ]; then
    echo "  WARN: $f missing (cannot verify kit_version)"
    kv_missing=$((kv_missing + 1))
    continue
  fi
  example_kv=$(grep -oE '"kit_version"[[:space:]]*:[[:space:]]*"[^"]+"' "$f" \
    | head -1 | sed -E 's/.*"kit_version"[[:space:]]*:[[:space:]]*"([^"]+)".*/\1/')
  if [ -z "$example_kv" ]; then
    echo "  WARN: $f does not declare kit_version"
    kv_missing=$((kv_missing + 1))
    continue
  fi
  example_mm=$(echo "$example_kv" | awk -F. '{print $1"."$2}')
  if [ "$example_mm" != "$plugin_mm" ]; then
    echo "  WARN: $f declares kit_version=\"$example_kv\" but plugin.json is \"$plugin_version\" (MAJOR.MINOR drift)"
    kv_missing=$((kv_missing + 1))
  fi
done
if [ "$kv_missing" -eq 0 ]; then
  echo "  OK — examples declare kit_version matching plugin.json MAJOR.MINOR"
else
  echo "  $kv_missing example(s) need a kit_version update."
  warn=$((warn + kv_missing))
fi

# Check E (v0.7, WARN): Template line-cap (Rule 2 — gmk-prototype-rules)
# Soft cap 300 lines, hard cap 600 lines. Applies to kit-shipped templates
# only (templates/prototype-*.html); user prototypes live in user repos and
# are out of scope.
echo ""
echo "Check E: Template line-cap (WARN-level in v0.7, hard cap 600)"
cap_hits=0
for f in templates/prototype-*.html; do
  [ -f "$f" ] || continue
  lc=$(wc -l < "$f" | tr -d ' ')
  if [ "$lc" -gt 600 ]; then
    echo "  FAIL: $f has $lc lines (exceeds hard cap 600)"
    cap_hits=$((cap_hits + 1))
    drift=$((drift + 1))
  elif [ "$lc" -gt 300 ]; then
    echo "  WARN: $f has $lc lines (exceeds soft cap 300, under hard 600)"
    cap_hits=$((cap_hits + 1))
    warn=$((warn + 1))
  fi
done
if [ "$cap_hits" -eq 0 ]; then
  echo "  OK — all templates under soft cap (300 lines)"
fi

# Check F (v0.7, WARN): Template hook API version declaration
# Any file using __gmk_botHook__ must either declare _gmkApiVersion: 1 inline
# OR reference _bot_hook_lib.js (which declares it canonically). This guards
# against silent API drift in template-shipped prototypes.
echo ""
echo "Check F: Template __gmk_botHook__ API version (WARN-level in v0.7)"
api_missing=0
for f in templates/*.html templates/*.js; do
  [ -f "$f" ] || continue
  if grep -q '__gmk_botHook__' "$f"; then
    if grep -q '_gmkApiVersion' "$f"; then
      continue
    fi
    if grep -q '_bot_hook_lib.js' "$f"; then
      continue
    fi
    echo "  WARN: $f uses __gmk_botHook__ but neither declares _gmkApiVersion nor references _bot_hook_lib.js"
    api_missing=$((api_missing + 1))
  fi
done
if [ "$api_missing" -eq 0 ]; then
  echo "  OK — all templates with __gmk_botHook__ have an API version anchor"
else
  warn=$((warn + api_missing))
fi

echo ""
if [ $drift -eq 0 ] && [ $warn -eq 0 ]; then
  echo "OK — plugin meta sanity checks pass."
  exit 0
elif [ $drift -eq 0 ]; then
  echo "OK with $warn warning(s) — hard checks pass. Review WARN above before release."
  exit 0
else
  echo "Drift detected. Reconcile before release."
  exit 1
fi
