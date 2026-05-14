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
# Usage:
#   bash scripts/check-plugin-meta.sh
#
# Exit codes:
#   0 — checks pass
#   1 — drift detected
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
disk_count=$(ls -1 skills/ | wc -l | tr -d ' ')
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

echo ""
if [ $drift -eq 0 ]; then
  echo "OK — plugin meta sanity checks pass."
  exit 0
else
  echo "Drift detected. Reconcile before release."
  exit 1
fi
