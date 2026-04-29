# Task #1 단계 1 완료보고서 — Capacitor 셋업 + 웹 빌드 통합

## 상태

🟢 **완료** — 코드/설정 측 모든 항목 완료. 에뮬레이터 검증은 Android Studio 설치 의존이라 단계 4(AAB 빌드)와 함께 진행하기로 결정.

## 완료 항목

### 도구 설치 (자율 진행)

| 항목 | 결과 |
|------|------|
| Rust 1.95.0 (rustup, 사용자 권한) | ✅ `C:\Users\USER\.cargo` |
| `wasm32-unknown-unknown` target | ✅ |
| wasm-pack 0.14.0 | ✅ |
| Capacitor JS 의존성 (`@capacitor/core` 8.3.1 등) | ✅ |

### 프로젝트 셋업

| 항목 | 결과 |
|------|------|
| WASM 빌드 (`wasm-pack build --target web`) | ✅ `pkg/rhwp_bg.wasm` 4.1MB |
| `npx cap init` | ✅ App ID `kr.go.gg.council.hwp` |
| `capacitor.config.ts` 보안 설정 | ✅ `allowMixedContent: false`, `androidScheme: https`, SplashScreen |
| `npm run build` | ✅ `rhwp-studio/dist/` 생성 (WASM 4.1MB + JS 681KB + CSS 60KB + PWA SW) |
| `npx cap add android` | ✅ `rhwp-studio/android/` 프로젝트 구조 생성 |
| `npx cap sync android` | ✅ 웹 자산 → `android/app/src/main/assets/public` 복사 |
| `.gitignore` 갱신 | ✅ Android 빌드 산출물 + 서명 키 제외 |

### 주요 산출물

```
rhwp-studio/
├── capacitor.config.ts          ← 신규
├── package.json                 ← Capacitor 의존성 추가
├── android/                     ← 신규 (Capacitor 자동 생성)
│   ├── app/
│   │   ├── build.gradle         (namespace=kr.go.gg.council.hwp)
│   │   └── src/main/
│   │       ├── AndroidManifest.xml
│   │       └── assets/public/   (dist/ 복사본)
│   ├── build.gradle
│   └── settings.gradle
└── dist/                        ← Vite 빌드 (gitignore)
    ├── index.html
    ├── assets/rhwp_bg-*.wasm    (4.1MB)
    └── ...
```

### 빌드 검증

- `dist/` 정상 생성 + WASM 임베드 확인
- Capacitor가 `dist/` 전체를 안드로이드 앱 자산으로 정상 복사
- Gradle Sync는 시도되었으나 SDK 미설치로 실제 빌드는 미수행 (구조만 검증)

## 보류된 항목 — 단계 4(AAB 빌드)와 함께 진행

| 항목 | 사유 |
|------|------|
| `gradlew bundleRelease` (AAB 빌드) | Android SDK 미설치 |
| 에뮬레이터에서 UI 정상 표시 확인 | Android Studio 미설치 |
| 실기기 디버그 설치 검증 | 실기기 + ADB 필요 |

→ 단계 2~3은 웹 코드 측 작업이라 Chrome/브라우저에서 검증 가능. 단계 4 진입 시점에 Android Studio 설치 필요.

## App ID 확정

```
kr.go.gg.council.hwp
```

`android/app/build.gradle`의 `namespace` 및 `applicationId`에 모두 적용됨. Play Store 등록 후 변경 불가이므로 단계 5 직전 작업지시자 최종 확정 권장.

## 보안 / 품질 메모

1. `capacitor.config.ts`에 `webContentsDebuggingEnabled: false` 설정 — 릴리즈 시 Chrome DevTools 연결 차단
2. `androidScheme: 'https'` — 안드로이드에서 `https://` 스킴으로 자산 로드 (보안 컨텍스트 보장)
3. npm install 시 4 high severity 취약점 경고 — 단계 4 완료 시점에 `npm audit fix` 검토 필요
4. `vite-plugin-pwa`(웹 PWA) + Capacitor(네이티브) 공존 — 충돌 없음 확인. 안드로이드 앱에서는 Service Worker 자동 비활성화 (Capacitor 내부 처리)

## 단계 2 진입 전 외부 의존성 정리

### 환경

- ✅ Node 24.13, npm 11.6
- ✅ Rust 1.95 + wasm-pack 0.14
- ❌ Android Studio (단계 4까지 설치 필요)
- ❌ ANDROID_HOME 환경변수
- ❌ Pixel 6 에뮬레이터 또는 실기기

### 행정 (단계 5)

- ✅ D-U-N-S 발급·등록 (작업지시자 보고)
- ✅ Play Console 조직 계정 (`wooni0103@gg.go.kr`)
- ⏳ 개인정보처리방침 호스팅 URL (단계 5 진입 전 결정)

## 다음 단계 (단계 2 — 모바일 UX 최적화)

- 햄버거 메뉴 + 드로어 (`< 600px`)
- safe-area-inset 처리
- 핀치 줌 / 두 손가락 스크롤
- 소프트 키보드 대응 (visualViewport API)
- `rhwp-studio/src/styles/mobile.css` 신규
- 검증: Chrome DevTools 모바일 에뮬레이션 + Capacitor live reload

## 승인 요청

본 단계 1 완료보고서 승인 + 단계 2 진입 합의를 요청합니다.
