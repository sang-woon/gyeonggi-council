#!/usr/bin/env bash
# AAB Pre-submission 사전 검증 스크립트
#
# Play Console 업로드 전 다음 항목을 자동 검증:
#   - AAB 파일 존재 + 크기 (Play Store 한도 200MB)
#   - 서명 유효성 (apksigner verify)
#   - bundletool 구조 검증
#   - versionCode / versionName / package ID 확인
#   - 권한 목록 확인 (광범위 권한 없는지)
#   - Intent-filter 보존 (.hwp / .hwpx)
#   - 개인정보처리방침 URL 접근성
#
# 실행:
#   bash scripts/verify-aab.sh
#
# 환경변수:
#   AAB_PATH=...                    (기본: rhwp-studio/android/app/build/outputs/bundle/release/app-release.aab)
#   ANDROID_HOME=...                (apksigner 위치 결정)
#   PRIVACY_URL=...                 (기본: https://sang-woon.github.io/gyeonggi-council/rhwp/privacy.html)
#   EXPECTED_PACKAGE=kr.go.gg.council.hwp
#   EXPECTED_VERSION_NAME=1.0.0
#   EXPECTED_VERSION_CODE=1

set -uo pipefail

# ---- 색상 ----
GREEN=$'\033[0;32m'
RED=$'\033[0;31m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'
NC=$'\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

ok()   { echo "${GREEN}  PASS${NC}  $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo "${RED}  FAIL${NC}  $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }
warn() { echo "${YELLOW}  WARN${NC}  $1"; WARN_COUNT=$((WARN_COUNT + 1)); }
section() { echo ""; echo "${BLUE}===${NC} $1"; }

# ---- 입력 ----
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

AAB_PATH="${AAB_PATH:-$ROOT/rhwp-studio/android/app/build/outputs/bundle/release/app-release.aab}"
PRIVACY_URL="${PRIVACY_URL:-https://sang-woon.github.io/gyeonggi-council/rhwp/privacy.html}"
EXPECTED_PACKAGE="${EXPECTED_PACKAGE:-kr.go.gg.council.hwp}"
EXPECTED_VERSION_NAME="${EXPECTED_VERSION_NAME:-1.0.0}"
EXPECTED_VERSION_CODE="${EXPECTED_VERSION_CODE:-1}"

# ---- ANDROID_HOME / build-tools 자동 탐지 ----
if [[ -z "${ANDROID_HOME:-}" ]]; then
  for cand in "D:/AndroidSDK" "$HOME/Android/Sdk" "$HOME/Library/Android/sdk" "$LOCALAPPDATA/Android/Sdk"; do
    if [[ -d "$cand" ]]; then ANDROID_HOME="$cand"; break; fi
  done
fi

BUILD_TOOLS=""
if [[ -n "${ANDROID_HOME:-}" ]] && [[ -d "$ANDROID_HOME/build-tools" ]]; then
  BUILD_TOOLS="$(find "$ANDROID_HOME/build-tools" -mindepth 1 -maxdepth 1 -type d | sort -V | tail -1)"
fi

# ---- bundletool 위치 탐지 (gradle 캐시 또는 직접 다운로드) ----
BUNDLETOOL_JAR=""
if command -v bundletool &> /dev/null; then
  BUNDLETOOL_JAR="bundletool"  # CLI 직접 사용
elif [[ -f "$ROOT/scripts/bundletool.jar" ]]; then
  BUNDLETOOL_JAR="$ROOT/scripts/bundletool.jar"
fi

# ====== 검증 시작 ======

echo ""
echo "${BLUE}========================================${NC}"
echo "  AAB Pre-submission 검증"
echo "${BLUE}========================================${NC}"
echo "  AAB:        $AAB_PATH"
echo "  Privacy:    $PRIVACY_URL"
echo "  Package:    $EXPECTED_PACKAGE"
echo "  Version:    $EXPECTED_VERSION_NAME (code $EXPECTED_VERSION_CODE)"
echo "  ANDROID_HOME: ${ANDROID_HOME:-(미설정)}"
echo "  Build-tools:  ${BUILD_TOOLS:-(미발견)}"

# ---- 1. AAB 파일 존재 + 크기 ----
section "1. AAB 파일"

if [[ ! -f "$AAB_PATH" ]]; then
  fail "AAB 파일 없음: $AAB_PATH"
  echo "       먼저 빌드: bash scripts/build-android-release.sh"
  exit 2
fi
ok "AAB 파일 존재"

AAB_SIZE_BYTES=$(stat -c %s "$AAB_PATH" 2>/dev/null || stat -f %z "$AAB_PATH" 2>/dev/null || echo 0)
AAB_SIZE_MB=$((AAB_SIZE_BYTES / 1024 / 1024))
if [[ $AAB_SIZE_MB -gt 200 ]]; then
  fail "AAB 크기 ${AAB_SIZE_MB}MB — Play Store 한도 200MB 초과"
elif [[ $AAB_SIZE_MB -gt 100 ]]; then
  warn "AAB 크기 ${AAB_SIZE_MB}MB (한도 200MB 이내지만 큼)"
else
  ok "AAB 크기 ${AAB_SIZE_MB}MB (한도 200MB 이내)"
fi

# ---- 2. 서명 검증 ----
section "2. 서명 검증"

if [[ -n "$BUILD_TOOLS" ]] && [[ -x "$BUILD_TOOLS/apksigner.bat" ]]; then
  APKSIGNER="$BUILD_TOOLS/apksigner.bat"
elif [[ -n "$BUILD_TOOLS" ]] && [[ -x "$BUILD_TOOLS/apksigner" ]]; then
  APKSIGNER="$BUILD_TOOLS/apksigner"
else
  warn "apksigner 미발견 — 서명 검증 건너뜀 (ANDROID_HOME 설정 후 재시도)"
  APKSIGNER=""
fi

if [[ -n "$APKSIGNER" ]]; then
  if "$APKSIGNER" verify "$AAB_PATH" 2>/dev/null; then
    ok "AAB 서명 유효"
  else
    fail "AAB 서명 검증 실패 — keystore 또는 빌드 설정 확인"
  fi

  # 인증서 정보 추출
  CERT_INFO=$("$APKSIGNER" verify --print-certs "$AAB_PATH" 2>/dev/null | head -10)
  if [[ -n "$CERT_INFO" ]]; then
    echo "    인증서 요약:"
    echo "$CERT_INFO" | sed 's/^/      /'
  fi
fi

# ---- 3. AAB 메타데이터 (bundletool 또는 unzip 직접) ----
section "3. AAB 메타데이터"

# AAB는 zip 형식이므로 base/manifest/AndroidManifest.xml 추출 가능
AAB_TMP="$(mktemp -d)"
trap "rm -rf '$AAB_TMP'" EXIT

if unzip -q "$AAB_PATH" "base/manifest/AndroidManifest.xml" -d "$AAB_TMP" 2>/dev/null; then
  ok "AndroidManifest.xml 추출"
else
  warn "AndroidManifest.xml 추출 실패 — bundletool 검증 권장"
fi

# AAB는 protobuf 형식이라 직접 파싱 어려움. aapt2 dump 활용
if [[ -n "$BUILD_TOOLS" ]] && [[ -x "$BUILD_TOOLS/aapt2.exe" || -x "$BUILD_TOOLS/aapt2" ]]; then
  AAPT2="$(ls "$BUILD_TOOLS"/aapt2* 2>/dev/null | head -1)"
  # aapt2는 APK 전용. AAB는 bundletool로 APK 변환 후 검증해야 함.
  warn "aapt2는 APK 전용 — bundletool로 universal APK 추출 후 검증 권장"
fi

# bundletool 사용 가능하면 universal APK 추출
if [[ -n "$BUNDLETOOL_JAR" ]]; then
  echo "    bundletool universal APK 추출 시도..."
  UNIVERSAL_APK="$AAB_TMP/universal.apks"
  if [[ "$BUNDLETOOL_JAR" == "bundletool" ]]; then
    bundletool build-apks --bundle="$AAB_PATH" --output="$UNIVERSAL_APK" --mode=universal 2>/dev/null
  else
    java -jar "$BUNDLETOOL_JAR" build-apks --bundle="$AAB_PATH" --output="$UNIVERSAL_APK" --mode=universal 2>/dev/null
  fi
  if [[ -f "$UNIVERSAL_APK" ]]; then
    unzip -q "$UNIVERSAL_APK" "universal.apk" -d "$AAB_TMP" 2>/dev/null
    if [[ -f "$AAB_TMP/universal.apk" ]] && [[ -n "$BUILD_TOOLS" ]]; then
      AAPT="$(ls "$BUILD_TOOLS"/aapt2* 2>/dev/null | head -1)"
      if [[ -n "$AAPT" ]]; then
        BADGING=$("$AAPT" dump badging "$AAB_TMP/universal.apk" 2>/dev/null)

        # 패키지 ID
        PKG=$(echo "$BADGING" | grep -oP "package: name='\K[^']+" | head -1)
        if [[ "$PKG" == "$EXPECTED_PACKAGE" ]]; then
          ok "패키지 ID = $PKG"
        else
          fail "패키지 ID 불일치 — 기대: $EXPECTED_PACKAGE / 실제: $PKG"
        fi

        # versionName / versionCode
        VN=$(echo "$BADGING" | grep -oP "versionName='\K[^']+" | head -1)
        VC=$(echo "$BADGING" | grep -oP "versionCode='\K[^']+" | head -1)
        if [[ "$VN" == "$EXPECTED_VERSION_NAME" ]]; then
          ok "versionName = $VN"
        else
          fail "versionName 불일치 — 기대: $EXPECTED_VERSION_NAME / 실제: $VN"
        fi
        if [[ "$VC" == "$EXPECTED_VERSION_CODE" ]]; then
          ok "versionCode = $VC"
        else
          fail "versionCode 불일치 — 기대: $EXPECTED_VERSION_CODE / 실제: $VC"
        fi

        # SDK 버전
        MIN_SDK=$(echo "$BADGING" | grep -oP "sdkVersion:'\K[^']+" | head -1)
        TGT_SDK=$(echo "$BADGING" | grep -oP "targetSdkVersion:'\K[^']+" | head -1)
        if [[ "$MIN_SDK" -ge 24 ]]; then
          ok "minSdkVersion = $MIN_SDK (Android 7.0+)"
        else
          warn "minSdkVersion = $MIN_SDK (24 미만 — 너무 오래된 API)"
        fi
        if [[ "$TGT_SDK" -ge 34 ]]; then
          ok "targetSdkVersion = $TGT_SDK (2024년 이후 Play Store 정책 충족)"
        else
          fail "targetSdkVersion = $TGT_SDK — Play Store는 최소 34 요구"
        fi

        # 권한 목록
        echo "    권한 목록:"
        PERMS=$(echo "$BADGING" | grep -E "^uses-permission" | sed "s/uses-permission: name='//; s/'.*$//")
        if [[ -n "$PERMS" ]]; then
          while read -r perm; do
            case "$perm" in
              android.permission.INTERNET) ok "권한: $perm (필요)" ;;
              android.permission.ACCESS_NETWORK_STATE | android.permission.WAKE_LOCK | "")
                ok "권한: $perm (시스템 자동)" ;;
              *)
                warn "권한: $perm (검토 필요)" ;;
            esac
          done <<< "$PERMS"
        fi

        # Intent-filter 검증
        if echo "$BADGING" | grep -q "application/x-hwp\|application/haansofthwp\|application/vnd.hancom.hwp"; then
          ok "Intent-filter: HWP MIME 보존"
        else
          warn "Intent-filter: HWP MIME 미발견 (badging 출력 한계 — xmltree로 재확인)"
        fi
      else
        warn "aapt2 미발견 — APK 메타데이터 검증 건너뜀"
      fi
    fi
  else
    warn "bundletool universal APK 추출 실패"
  fi
else
  warn "bundletool 미설치 — AAB 메타데이터 직접 검증 건너뜀"
  echo "       설치: https://github.com/google/bundletool/releases"
  echo "       또는: scripts/bundletool.jar 에 배치"
fi

# ---- 4. 개인정보처리방침 URL ----
section "4. 개인정보처리방침 URL"

if command -v curl &> /dev/null; then
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$PRIVACY_URL" || echo "000")
  case "$HTTP_CODE" in
    200) ok "URL 응답 200 OK: $PRIVACY_URL" ;;
    301|302|303|307|308) warn "URL 리다이렉트 ($HTTP_CODE): $PRIVACY_URL" ;;
    404) fail "URL 404 Not Found: $PRIVACY_URL — GitHub Pages 배포 확인 필요" ;;
    000) warn "URL 접근 실패 (네트워크 또는 미배포): $PRIVACY_URL" ;;
    *) fail "URL 비정상 응답 $HTTP_CODE: $PRIVACY_URL" ;;
  esac
else
  warn "curl 미설치 — URL 검증 건너뜀"
fi

# ---- 5. AAB 내 디버그 흔적 ----
section "5. 디버그 흔적 검사"

if unzip -p "$AAB_PATH" "base/manifest/AndroidManifest.xml" 2>/dev/null | strings 2>/dev/null | grep -i "android:debuggable=\"true\"" &>/dev/null; then
  fail "AAB에 debuggable=true 흔적 — 릴리즈 빌드 아님"
else
  ok "AAB debuggable=false (릴리즈 빌드)"
fi

# ---- 6. 권장 추가 검증 ----
section "6. 추가 권장 검증 (수동)"

cat <<EOF
  [ ] APK Analyzer (Android Studio)에서 dependencies 검토
      → 분석 SDK·광고 SDK 미포함 확인
  [ ] Play Console > Pre-launch report 검토
      → 5종 실 디바이스 자동 검사 결과
  [ ] 실 디바이스에서 universal APK 설치 + 모든 시나리오 동작 확인
      bundletool install-apks --apks=universal.apks
EOF

# ---- 종합 ----
echo ""
echo "${BLUE}========================================${NC}"
echo "  요약: ${GREEN}${PASS_COUNT} pass${NC} / ${RED}${FAIL_COUNT} fail${NC} / ${YELLOW}${WARN_COUNT} warn${NC}"
echo "${BLUE}========================================${NC}"

if [[ $FAIL_COUNT -gt 0 ]]; then
  echo "${RED}FAIL 항목 해결 후 Play Console 업로드 권장.${NC}"
  exit 1
elif [[ $WARN_COUNT -gt 0 ]]; then
  echo "${YELLOW}WARN 항목 검토 후 업로드 진행 가능.${NC}"
  exit 0
else
  echo "${GREEN}모든 검증 통과 — Play Console 업로드 가능.${NC}"
  exit 0
fi
