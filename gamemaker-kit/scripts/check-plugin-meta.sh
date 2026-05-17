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
# The v0.6 additions emit WARN only; they do not set drift. v0.7+ may promote
# them to FAIL once the baseline is stable.
#
# Usage:
#   bash scripts/check-plugin-meta.sh
#
# Exit codes:
#   0 — checks pass (warnings allowed)
#   1 — drift detected on hard checks (version / skills floor / count mismatch)
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
echo "Check A: Rule 14 token presence (WARN-level in v0.6)"
RULE14_ALLOWLIST="scripts/.rule14-allowlist.txt"
rule14_missing=0
for f in skills/*/SKILL.md; do
  if grep -qE 'Run /gmk-|run `/gmk-' "$f"; then
    if ! grep -qE '\[Rule 14' "$f"; then
      # Check allowlist: SKILL match is advisory/post-action/usage-trigger, not a real refuse.
      skill_key="${f#skills/}"
      if [ -f "$RULE14_ALLOWLIST" ] && grep -Fxq "$skill_key" "$RULE14_ALLOWLIST"; then
        continue
      fi
      echo "  WARN: $f has refuse-with-recommendation pattern but no [Rule 14 token"
      rule14_missing=$((rule14_missing + 1))
    fi
  fi
done
if [ "$rule14_missing" -eq 0 ]; then
  echo "  OK — every SKILL with refuse-with-rec carries a [Rule 14 token"
else
  echo "  $rule14_missing SKILL(s) missing the token. See gmk-prototype-rules Rule 14."
  warn=$((warn + rule14_missing))
fi

# Check B (v0.6, WARN): "endpoint" terminology drift in user-facing docs
# Per v0.5 honesty note + v0.6 amendment: dev-complete is a release-readiness
# checkpoint, not an endpoint. Scan live docs (skills/, CONCEPT.md, README.md,
# _workspace/structure.md, .claude-plugin/marketplace.json). The allowlist
# excludes intentional uses (meta-discussion of the rename, semantic distinct,
# intentional contrast). Frozen history (CHANGELOG, HANDOFF, _workspace/v0.X-*)
# is excluded by path filter.
echo ""
echo "Check B: 'endpoint' terminology drift (WARN-level in v0.6)"
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
echo "Check C: Rule 13-14 citation footer (WARN-level in v0.6)"
footer_missing=0
for f in skills/*/SKILL.md; do
  if grep -qE '^## Preconditions' "$f"; then
    if ! grep -qE 'Standard preconditions.*Rule 13-14' "$f"; then
      echo "  WARN: $f has ## Preconditions but no 'Rule 13-14' citation footer"
      footer_missing=$((footer_missing + 1))
    fi
  fi
done
if [ "$footer_missing" -eq 0 ]; then
  echo "  OK — every SKILL with ## Preconditions carries the Rule 13-14 footer"
else
  echo "  $footer_missing SKILL(s) missing the footer."
  warn=$((warn + footer_missing))
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
