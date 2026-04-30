#!/usr/bin/env bash
# rhwp-studio Android Release AAB 빌드 스크립트
# 사용 전 keystore/keystore.properties 작성 (또는 환경변수 설정)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STUDIO_DIR="$ROOT_DIR/rhwp-studio"
ANDROID_DIR="$STUDIO_DIR/android"
PKG_DIR="$ROOT_DIR/pkg"

cd "$ROOT_DIR"

echo "===== 1/4: WASM 빌드 ====="
if ! command -v wasm-pack >/dev/null 2>&1; then
  echo "ERROR: wasm-pack 미설치. 'cargo install wasm-pack' 실행하세요." >&2
  exit 1
fi
wasm-pack build --target web

if [[ ! -f "$PKG_DIR/rhwp_bg.wasm" ]]; then
  echo "ERROR: WASM 빌드 산출물이 없습니다 ($PKG_DIR/rhwp_bg.wasm)" >&2
  exit 1
fi
echo "  WASM 크기: $(du -h "$PKG_DIR/rhwp_bg.wasm" | cut -f1)"

echo "===== 2/4: 웹 빌드 (Vite) ====="
cd "$STUDIO_DIR"
npm run build

echo "===== 3/4: Capacitor 동기화 ====="
npx cap sync android

echo "===== 4/4: Android Release AAB 빌드 ====="
if [[ -z "${ANDROID_HOME:-}" ]] && [[ ! -f "$HOME/.android/sdk/cmdline-tools/latest/bin/sdkmanager" ]]; then
  echo "ERROR: ANDROID_HOME 환경변수 미설정. Android Studio 또는 cmdline-tools 설치 후 설정하세요." >&2
  exit 1
fi

cd "$ANDROID_DIR"
./gradlew bundleRelease

AAB_PATH="$ANDROID_DIR/app/build/outputs/bundle/release/app-release.aab"
if [[ ! -f "$AAB_PATH" ]]; then
  echo "ERROR: AAB 빌드 실패 ($AAB_PATH 없음)" >&2
  exit 1
fi

echo ""
echo "===== 완료 ====="
echo "  AAB: $AAB_PATH"
echo "  크기: $(du -h "$AAB_PATH" | cut -f1)"
echo ""
echo "다음 단계:"
echo "  - 서명 검증: \$ANDROID_HOME/build-tools/34.0.0/apksigner verify --verbose \"$AAB_PATH\""
echo "  - Play Console 내부 테스트 트랙 업로드: https://play.google.com/console"
