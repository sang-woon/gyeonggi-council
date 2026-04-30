# Task #1: Capacitor 기반 Google Play Store 배포 — 구현 계획서

수행계획서: `task_m100_1.md` 참조.

## 전체 구조

| 단계 | 제목 | 예상 작업 시간 | 주요 산출물 |
|------|------|----------------|--------------|
| 1 | Capacitor 셋업 + 웹 빌드 통합 | 0.5일 | `android/`, `capacitor.config.ts` |
| 2 | 모바일 UX 최적화 | 1~2일 | `mobile.css`, 반응형 메뉴 |
| 3 | 네이티브 파일 통합 | 1~2일 | 파일 피커, 저장 핸들러 |
| 4 | 앱 서명 + AAB 빌드 | 0.5일 | release `.aab`, 빌드 스크립트 |
| 5 | Play Console 자료 + 심사 제출 | 1~2일 | 스크린샷, 메타데이터, 심사 제출 |

총 예상: **4~7일**.

---

## 단계 1: Capacitor 셋업 + 웹 빌드 통합

### 목표

Capacitor 프로젝트를 `rhwp-studio` 안에 셋업하고, `npm run build` 결과(`dist/`)를 안드로이드 에뮬레이터에서 정상 로드하는 것.

### 작업 항목

1. **의존성 추가** (`rhwp-studio/`)
   ```bash
   cd rhwp-studio
   npm install --save @capacitor/core @capacitor/android
   npm install --save-dev @capacitor/cli @capacitor/assets
   ```

2. **Capacitor 초기화**
   ```bash
   npx cap init "경기도의회 HWP 뷰어" "kr.go.gg.council.hwp" --web-dir=dist
   ```
   - App ID: `kr.go.gg.council.hwp` (역도메인, gg.go.kr 기반)
   - 결과: `capacitor.config.ts` 생성

3. **`capacitor.config.ts` 설정**
   - `webDir: 'dist'`
   - `android.allowMixedContent: false`
   - `server.androidScheme: 'https'`
   - `plugins.SplashScreen` 기본 설정

4. **웹 빌드 + 안드로이드 플랫폼 추가**
   ```bash
   npm run build
   npx cap add android
   npx cap sync android
   ```

5. **Android Studio 열기 + 에뮬레이터 실행**
   ```bash
   npx cap open android
   ```
   - Pixel 6 / Android 13 에뮬레이터에서 앱 실행
   - rhwp-studio UI 정상 표시 확인 (HWP 파일은 아직 못 열어도 OK)

6. **`.gitignore` 갱신**
   - `android/.gradle`, `android/app/build`, `android/local.properties`, `keystore/` 추가

### 검증

- [ ] `npm run build` 성공 (`rhwp-studio/dist/` 생성)
- [ ] `npx cap sync android` 무경고
- [ ] 에뮬레이터에서 앱 아이콘 클릭 → rhwp-studio 메뉴바·도구상자 정상 표시
- [ ] 콘솔 에러 0건 (Chrome DevTools `chrome://inspect`)

### 산출물

- `rhwp-studio/capacitor.config.ts`
- `rhwp-studio/android/` (Capacitor가 자동 생성)
- `rhwp-studio/package.json` 업데이트 (의존성 추가)
- `mydocs/working/task_m100_1_stage1.md`

---

## 단계 2: 모바일 UX 최적화

### 목표

휴대전화(360px~430px 폭) 및 태블릿(768px+)에서 UI가 자연스럽게 동작하고, 터치 제스처가 모두 정상 작동.

### 작업 항목

1. **viewport 메타 + safe-area 처리**
   - `index.html`에 `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` 확인
   - CSS에 `padding-bottom: env(safe-area-inset-bottom)` 적용 (`#status-bar`)

2. **반응형 메뉴 재배치** (`< 600px`)
   - `#menu-bar` → 햄버거(≡) 버튼 + 드로어
   - `#icon-toolbar` → 가로 스크롤 가능
   - `#style-bar` → 압축 모드 (텍스트 숨김, 아이콘만)

3. **터치 제스처**
   - 핀치 줌(`touchstart`/`touchmove` 두 손가락) → 줌 +/- 버튼과 연동
   - 두 손가락 스크롤 = 페이지 패닝
   - 한 손가락 = 텍스트 선택 (커서 모드)

4. **소프트 키보드 대응**
   - `visualViewport` API로 키보드 표시 시 `#scroll-container` 높이 재계산
   - 입력창 포커스 시 자동 스크롤

5. **CSS 분리**
   - `rhwp-studio/src/styles/mobile.css` 신규 생성
   - 미디어 쿼리: `@media (max-width: 600px) and (pointer: coarse)`

6. **로컬 디바이스 검증**
   - `npx cap run android` (실제 안드로이드 폰 USB 연결)

### 검증

- [ ] 360px 폭 화면에서 메뉴 모두 접근 가능
- [ ] 핀치 줌 정상 동작 (10%~400% 범위)
- [ ] 키보드 표시/숨김 시 레이아웃 깨지지 않음
- [ ] 가로 모드(landscape) 전환 정상
- [ ] 콘솔 에러 0건

### 산출물

- `rhwp-studio/src/styles/mobile.css`
- `rhwp-studio/src/mobile-menu.ts` (햄버거 드로어 로직)
- `rhwp-studio/index.html` 일부 수정 (viewport, 햄버거 버튼)
- `mydocs/working/task_m100_1_stage2.md`

---

## 단계 3: 네이티브 파일 통합

### 목표

안드로이드 디바이스에서 `.hwp` 파일을 선택해 열고, SVG/PDF로 내보내 저장 가능.

### 작업 항목

1. **플러그인 설치**
   ```bash
   npm install @capacitor/filesystem
   npm install @capawesome/capacitor-file-picker  # 또는 capacitor-blob-writer
   ```

2. **파일 열기 추상화**
   - `rhwp-studio/src/file-handler.ts` 신규
   - `Capacitor.isNativePlatform()`로 분기:
     - 네이티브: `FilePicker.pickFiles({ types: ['application/x-hwp', 'application/octet-stream'] })`
     - 웹: 기존 `<input type="file">` 그대로
   - 결과를 `Uint8Array`로 통일하여 WASM 파서에 전달

3. **권한 처리**
   - Android 13+: `READ_MEDIA_*` 권한
   - SAF(Storage Access Framework) 우선 활용 — 권한 요구 최소화
   - `android/app/src/main/AndroidManifest.xml` 권한 명시

4. **저장 (SVG 내보내기)**
   - `Filesystem.writeFile({ directory: Directory.Documents, path: 'rhwp/output.svg', data: base64 })`
   - 또는 SAF `ACTION_CREATE_DOCUMENT`로 사용자가 위치 선택

5. **MIME 타입 인텐트**
   - `AndroidManifest.xml`에 `intent-filter` 등록
   - 외부 앱(파일 매니저)에서 `.hwp` 탭 시 본 앱이 후보로 표시

### 검증

- [ ] 안드로이드 파일 매니저에서 `.hwp` 선택 → 본 앱이 후보로 노출
- [ ] 본 앱에서 파일 피커로 `.hwp` 열기 → 정상 렌더링
- [ ] SVG 내보내기 → Downloads 폴더에 저장됨
- [ ] 권한 요청 1회만 표시 (반복 X)
- [ ] 큰 파일(10MB 이상) 메모리 OOM 없음

### 산출물

- `rhwp-studio/src/file-handler.ts`
- `rhwp-studio/android/app/src/main/AndroidManifest.xml` 수정
- `mydocs/working/task_m100_1_stage3.md`

---

## 단계 4: 앱 서명 + AAB 빌드

### 목표

서명된 release AAB를 산출하고, Play Console 내부 테스트 트랙에 업로드 가능한 상태.

### 작업 항목

1. **키스토어 생성**
   ```bash
   keytool -genkey -v -keystore keystore/release.keystore \
     -alias gyeonggi-council -keyalg RSA -keysize 2048 -validity 10000
   ```
   - `keystore/` 폴더는 `.gitignore` 등록
   - 비밀번호는 `keystore/.passwords.local` 에 별도 저장 (gitignore)
   - **백업**: 사용자에게 클라우드(공공기관 보안 저장소) 백업 안내

2. **`android/app/build.gradle` 서명 설정**
   ```gradle
   signingConfigs {
     release {
       storeFile file("../../keystore/release.keystore")
       storePassword System.getenv("ANDROID_STORE_PASSWORD")
       keyAlias "gyeonggi-council"
       keyPassword System.getenv("ANDROID_KEY_PASSWORD")
     }
   }
   buildTypes {
     release {
       signingConfig signingConfigs.release
       minifyEnabled true
       shrinkResources true
     }
   }
   ```

3. **버전 관리**
   - `versionCode 1`, `versionName "1.0.0"` (rhwp-studio v0.7.8 → 기관 배포판은 v1.0.0부터 시작)

4. **빌드 스크립트** (`scripts/build-android-release.sh`)
   ```bash
   #!/bin/bash
   cd rhwp-studio
   npm run build
   npx cap sync android
   cd android
   ./gradlew bundleRelease
   ```

5. **AAB 산출 및 디바이스 검증**
   - `app/build/outputs/bundle/release/app-release.aab`
   - `bundletool`로 APK 추출 후 디바이스 설치 검증

6. **ProGuard 규칙 추가** (필요 시)
   - WASM 관련 클래스 keep
   - rhwp-studio JS는 이미 minified이므로 추가 작업 적음

### 검증

- [ ] AAB 빌드 성공
- [ ] `apksigner verify --verbose app-release.apk` 통과
- [ ] 실제 디바이스에서 release APK 설치 + 정상 실행
- [ ] 앱 크기 50MB 미만 (Play Store 권장)

### 산출물

- `keystore/.gitkeep` (실제 키는 gitignore)
- `keystore/.passwords.local` (gitignore, 사용자 보관)
- `android/app/build.gradle` 수정
- `scripts/build-android-release.sh`
- `mydocs/working/task_m100_1_stage4.md`

---

## 단계 5: Play Console 자료 + 심사 제출

### 목표

Play Console에 앱 등록을 완료하고, 내부 테스트 → 비공개 → 공개 트랙 순으로 심사 제출.

### 작업 항목

1. **앱 자료 제작**
   - 앱 아이콘: 512×512 PNG (32-bit) — `assets/play-store/icon.png`
   - 기능 그래픽: 1024×500 PNG/JPG
   - 휴대전화 스크린샷: 최소 2장 (1080×1920 권장)
   - 7인치 / 10인치 태블릿 스크린샷 (선택, 권장)

2. **메타데이터** (`mydocs/release/store_listing.md`)
   - 앱 이름: "경기도의회 HWP 뷰어" (30자 이내)
   - 간단한 설명: 80자 이내
   - 자세한 설명: 4000자 이내 (한글 + 영문)
   - 카테고리: 도구 또는 생산성
   - 태그: HWP, 한글, 문서뷰어

3. **개인정보처리방침** (`mydocs/release/privacy_policy.md`)
   - 수집 데이터: 없음 (로컬 처리)
   - 권한 사용 근거: 파일 시스템 접근 (사용자가 선택한 .hwp 읽기)
   - 호스팅 URL 필요: GitHub Pages 또는 경기도의회 도메인에 정적 페이지 게시
   - 영문 버전 동시 작성

4. **데이터 안전 섹션**
   - "수집된 데이터 없음" 명시
   - 데이터 암호화: HTTPS (해당 없음, 로컬 앱)
   - 데이터 삭제 요청: 해당 없음

5. **콘텐츠 등급 설문**
   - 폭력/성/도박/약물 등 모두 "없음"
   - 결과: 전체 이용가 (3+)

6. **출시 트랙**
   - **내부 테스트 트랙**: 1차 업로드 → 자체 검수 (1~2일)
   - **비공개(Closed) 테스트**: 경기도의회 직원 대상 베타 (선택, 권장)
   - **공개(Production) 트랙**: 정식 출시

7. **심사 제출**
   - 검토 시간: 보통 7일 이내, 첫 심사는 더 길 수 있음
   - 거부 시: 사유 분석 → 수정 → 재제출

### 검증

- [ ] Play Console에 앱 생성됨 (App ID: `kr.go.gg.council.hwp`)
- [ ] 모든 필수 메타데이터 작성됨
- [ ] 개인정보처리방침 URL 접근 가능 (HTTPS)
- [ ] 내부 테스트 트랙에 AAB 업로드 + 자체 검수 통과
- [ ] 심사 제출 → "심사 중" 상태 확인

### 산출물

- `assets/play-store/icon.png`, `feature-graphic.png`, `screenshots/*`
- `mydocs/release/store_listing.md` (앱 설명 한/영)
- `mydocs/release/privacy_policy.md` (한/영)
- `mydocs/release/data_safety.md`
- `mydocs/manual/play_store_release_guide.md` (배포 매뉴얼, 후속 업데이트용)
- `mydocs/working/task_m100_1_stage5.md`

---

## 최종 보고서

`mydocs/report/task_m100_1_report.md`
- 5단계 결과 요약
- Play Console 심사 제출 일자 + URL
- 후속 작업 (폰트 폴백 분리 이슈, 업데이트 절차)

## 의존성 / 외부 작업

| 항목 | 담당 | 비고 |
|------|------|------|
| Play Console 조직 인증 (D-U-N-S) | 작업지시자 | 단계 5 전까지 완료 필요 |
| 개인정보처리방침 호스팅 도메인 | 작업지시자 | 단계 5에서 URL 제공 필요 |
| 결제 프로필 (등록비 $25) | 작업지시자 | 단계 5 전까지 완료 |
| 안드로이드 실기기 (검증용) | 작업지시자 | 단계 2~3에서 활용 |

## 승인 요청

본 구현계획서가 승인되면 **단계 1**부터 진행합니다.
