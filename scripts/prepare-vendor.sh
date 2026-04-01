#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VENDOR_DIR="$PROJECT_DIR/vendor"
GSD_REPO="$(dirname "$PROJECT_DIR")/get-shit-done"
HARNESS_REPO="$(dirname "$PROJECT_DIR")/harness-100"

echo "=== WorkTool vendor/ 준비 ==="
echo "Project: $PROJECT_DIR"
echo "GSD: $GSD_REPO"
echo "Harness: $HARNESS_REPO"

# 0. 이전 vendor 정리
if [ -d "$VENDOR_DIR" ]; then
  echo "Cleaning previous vendor/..."
  rm -rf "$VENDOR_DIR"
fi

# 1. GSD SDK 빌드 + 필요 파일만 복사
echo ""
echo "--- Building GSD SDK ---"
if [ ! -d "$GSD_REPO/sdk" ]; then
  echo "ERROR: GSD repo not found at $GSD_REPO"
  exit 1
fi

cd "$GSD_REPO/sdk"
if [ ! -d "node_modules" ]; then
  npm install
fi
if [ ! -d "dist" ]; then
  npx tsc
fi
cd "$PROJECT_DIR"

echo "Copying GSD SDK..."
mkdir -p "$VENDOR_DIR/gsd/sdk"
cp -r "$GSD_REPO/sdk/dist" "$VENDOR_DIR/gsd/sdk/dist"
cp "$GSD_REPO/sdk/package.json" "$VENDOR_DIR/gsd/sdk/"

# prompts 디렉토리 (SDK가 참조)
if [ -d "$GSD_REPO/sdk/prompts" ]; then
  cp -r "$GSD_REPO/sdk/prompts" "$VENDOR_DIR/gsd/sdk/prompts"
fi

# gsd-tools.cjs
echo "Copying gsd-tools..."
mkdir -p "$VENDOR_DIR/gsd/bin"
# gsd-tools.cjs는 get-shit-done/get-shit-done/bin/ 에 위치
if [ -f "$GSD_REPO/get-shit-done/bin/gsd-tools.cjs" ]; then
  cp "$GSD_REPO/get-shit-done/bin/gsd-tools.cjs" "$VENDOR_DIR/gsd/bin/"
elif [ -f "$GSD_REPO/bin/gsd-tools.cjs" ]; then
  cp "$GSD_REPO/bin/gsd-tools.cjs" "$VENDOR_DIR/gsd/bin/"
else
  echo "WARNING: gsd-tools.cjs not found, skipping"
fi

# agents
echo "Copying GSD agents..."
mkdir -p "$VENDOR_DIR/gsd/agents"
cp "$GSD_REPO/agents/"*.md "$VENDOR_DIR/gsd/agents/" 2>/dev/null || echo "WARNING: no agent .md files"

# SDK node_modules (runtime dependencies)
echo "Copying SDK runtime dependencies..."
mkdir -p "$VENDOR_DIR/gsd/sdk/node_modules"
if [ -d "$GSD_REPO/sdk/node_modules/ws" ]; then
  cp -r "$GSD_REPO/sdk/node_modules/ws" "$VENDOR_DIR/gsd/sdk/node_modules/ws"
fi

# 2. Harness-100 복사
echo ""
echo "--- Copying Harness-100 ---"
if [ ! -d "$HARNESS_REPO" ]; then
  echo "ERROR: Harness-100 repo not found at $HARNESS_REPO"
  exit 1
fi

mkdir -p "$VENDOR_DIR/harness-100"
echo "Copying ko/..."
cp -r "$HARNESS_REPO/ko" "$VENDOR_DIR/harness-100/"
echo "Copying en/..."
cp -r "$HARNESS_REPO/en" "$VENDOR_DIR/harness-100/"

# 3. 용량 확인
echo ""
echo "--- Vendor size ---"
du -sh "$VENDOR_DIR/gsd" 2>/dev/null || echo "GSD: unknown"
du -sh "$VENDOR_DIR/harness-100" 2>/dev/null || echo "Harness: unknown"
du -sh "$VENDOR_DIR" 2>/dev/null || echo "Total: unknown"

echo ""
echo "=== vendor/ ready ==="
