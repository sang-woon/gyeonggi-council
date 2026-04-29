# Task #1 단계 1 완료보고서 — Capacitor 셋업 + 웹 빌드 통합 (부분 완료)

## 상태

🟡 **부분 완료** — Node 측 셋업은 완료, 빌드 검증 및 Android 플랫폼 추가는 도구 미설치로 보류.

## 완료 항목

| 항목 | 상태 | 비고 |
|------|------|------|
| Capacitor 의존성 설치 | ✅ | `@capacitor/core`, `@capacitor/android` 8.3.1 / `@capacitor/cli`, `@capacitor/assets` |
| `npx cap init` 실행 | ✅ | App ID: `kr.go.gg.council.hwp`, App Name: `경기도의회 HWP 뷰어` |
| `capacitor.config.ts` 보안 설정 추가 | ✅ | `allowMixedContent: false`, `androidScheme: https`, SplashScreen |
| `.gitignore` 갱신 | ✅ | `android/build`, `keystore/`, `.keystore`, `.passwords.local` 등 |
| `npm run build` 검증 | ❌ | **차단** — WASM 미빌드 (`@wasm/rhwp.js` 모듈 없음) |
| `npx cap add android` | ❌ | **차단** — Android SDK 미설치 |
| 에뮬레이터에서 UI 표시 검증 | ❌ | **차단** — Android Studio 미설치 |

## 차단 사유 (작업지시자 환경 의존)

본 머신에 다음 도구가 미설치 상태입니다:

| 도구 | 용도 | 설치 방법 |
|------|------|-----------|
| **Docker Desktop** | WASM 빌드 (`pkg/` 생성) | https://docs.docker.com/desktop/install/windows-install/ |
| **Android Studio** | Android SDK + 에뮬레이터 + 빌드 | https://developer.android.com/studio |
| (선택) Rust toolchain | Docker 없이 로컬 WASM 빌드 | `rustup` + `wasm-pack` |

CLAUDE.md 규칙: WASM 빌드는 Docker 전용. 네이티브/테스트는 로컬 cargo. 따라서 정식 경로는 **Docker Desktop + Android Studio** 조합.

## 변경된 파일

- `rhwp-studio/package.json` (Capacitor 의존성 추가)
- `rhwp-studio/package-lock.json` (자동 갱신)
- `rhwp-studio/capacitor.config.ts` (신규)
- `rhwp-studio/.gitignore` (Android/keystore 항목 추가)

## App ID 확정

```
kr.go.gg.council.hwp
```

- `kr.go.gg`: 경기도(gg) 정부 도메인 역순
- `council`: 의회
- `hwp`: 앱 식별자

> ⚠️ Play Store에 일단 등록하면 변경 불가. 단계 5 진입 전까지 작업지시자 최종 확정 필요.

## 다음 작업

### 작업지시자 측

1. **Docker Desktop 설치**
2. **Android Studio 설치** + 다음 SDK 다운로드:
   - Android SDK Platform 34 (Android 14)
   - Android SDK Build-Tools 34.0.0
   - Android Emulator
   - Pixel 6 가상 디바이스 이미지
3. 환경변수 설정 (Android Studio 설치 시 자동, 확인 필요):
   - `ANDROID_HOME` = SDK 경로
   - `PATH`에 `$ANDROID_HOME/platform-tools` 추가
4. WASM 빌드:
   ```bash
   cd /d/01_coding/gyeonggi-council
   cp .env.docker.example .env.docker
   docker compose --env-file .env.docker run --rm wasm
   ```

### 클로드 측 (도구 설치 후 재개)

1. `npm run build` 검증 → `dist/` 생성 확인
2. `npx cap add android` → `rhwp-studio/android/` 생성
3. `npx cap sync android`
4. `npx cap open android` → Android Studio 실행
5. 에뮬레이터에서 앱 실행 → UI 정상 표시 확인
6. 단계 1 완료보고서 갱신 + 단계 2 진입 승인 요청

## 위험 / 메모

- npm install 시 4 high severity 취약점 경고 발생. 단계 4 완료 후 `npm audit` 점검 필요.
- `@capacitor/cli` 8.3.1: 최신 stable. Android API 34 지원.
- `vite-plugin-pwa`로 이미 PWA 지원 중. Capacitor와 PWA 동시 운영은 충돌 가능성 낮음 (PWA는 웹 전용, Capacitor는 네이티브 전용).

## 승인 요청

본 부분완료 보고서 승인 + 작업지시자 측 도구 설치 진행 후, 단계 1 잔여 항목 재개 합의를 요청합니다.
