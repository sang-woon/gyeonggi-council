# Play Store 배포 자율 산출물 종합 정리

본 문서는 작업지시자의 Play Console 제출 작업에 사용할 자율 생성 산출물을 정리합니다.

## 1. Task #1·#2 머지 완료

| 항목 | 결과 |
|------|------|
| `local/task1` → `local/devel` | 머지 완료 (충돌 없음) |
| `local/task2` → `local/devel` | 머지 완료 (충돌 없음) |
| `isMobileLike()` → `isNativePlatform()` | 통일 완료 (`@/core/platform`) |
| 빌드 검증 | tsc 무경고 + vite build 성공 + APK 재빌드 성공 |
| 테스트 | 단위 70 + E2E 18 = 88 pass / 0 fail |

## 2. 앱 아이콘 (전 사이즈 자동 생성)

소스: `design/icon-source.svg` (1024×1024) + `design/icon-foreground.svg` (108×108)
재생성: `node scripts/generate-icons.mjs`

| 산출물 | 위치 |
|--------|------|
| Adaptive icon foreground (5종) | `rhwp-studio/android/app/src/main/res/mipmap-{m,h,xh,xxh,xxxh}dpi/ic_launcher_foreground.png` |
| Legacy 사각 아이콘 (5종) | `…/mipmap-{...}dpi/ic_launcher.png` |
| Legacy 둥근 아이콘 (5종) | `…/mipmap-{...}dpi/ic_launcher_round.png` |
| Adaptive 배경색 정의 | `rhwp-studio/android/app/src/main/res/values/ic_launcher_background.xml` (#1e3a8a) |
| **Play Store 아이콘 (512×512)** | `mydocs/release/icons/play-store-icon.png` |
| 백업 1024×1024 | `mydocs/release/icons/play-store-icon-1024.png` |
| **기능 그래픽 (1024×500)** | `mydocs/release/icons/feature-graphic.png` |

디자인 컨셉:
- 네이비 그라디언트 배경 (#1e40af → #0c2461) — 정부 기관 톤
- 흰 문서 페이지 + 우상단 모서리 접기
- '한' 자형 + 텍스트 라인 + 하단 'HWP' 라벨

## 3. 개인정보 처리방침 호스팅

| 항목 | 값 |
|------|----|
| HTML 소스 | `rhwp-studio/public/privacy.html` (반응형 + 한국어) |
| 빌드 결과 | `rhwp-studio/dist/privacy.html` (`npm run build` 시 자동 복사) |
| 배포 워크플로우 | `.github/workflows/deploy-pages.yml` (main 푸시 시 자동) |
| **게시 URL** | **`https://sang-woon.github.io/gyeonggi-council/rhwp/privacy.html`** |
| 비고 | main 머지 + GitHub Pages 배포 후 접근. Play Console "개인정보처리방침 URL"에 등록 |

## 4. Play Store 스크린샷 (9장 자동 생성)

생성 스크립트: `scripts/capture-screenshots.mjs`
재실행: `node scripts/capture-screenshots.mjs`

| 디바이스 | viewport (DPR 적용 후 실제) | 시나리오 | 위치 |
|---------|---------------------------|---------|------|
| 폰 | 480×853 → 1080×1919 (DPR 2.25, 모바일 UI) | 시작 / 샘플HWP / 도구상자 | `mydocs/release/screenshots/phone/` |
| 7인치 태블릿 | 800×1280 → 1080×1728 (DPR 1.35) | 동일 3개 | `mydocs/release/screenshots/tablet-7/` |
| 10인치 태블릿 | 1280×800 → 1920×1200 (DPR 1.5, 가로) | 동일 3개 | `mydocs/release/screenshots/tablet-10/` |

폰 스크린샷은 `<768px` 모바일 UI(햄버거 메뉴) 트리거 영역으로 캡처되어 진정한 모바일 사용자 경험을 반영.

## 5. Play Console 제출 시 사용 자료 (체크리스트)

### 메타데이터
- [x] 앱 이름: `mydocs/release/play_store_listing_ko.md` (경기도의회 HWP 뷰어)
- [x] 짧은 설명 / 자세한 설명: `mydocs/release/play_store_listing_ko.md`
- [x] 카테고리: 생산성 (Productivity)
- [x] 콘텐츠 등급 설문: 모든 사용자 / 어린이도 가능 (개인정보 미수집)
- [x] 데이터 안전 양식: `mydocs/release/data_safety.md`

### 시각 자료
- [x] **앱 아이콘 512×512**: `mydocs/release/icons/play-store-icon.png`
- [x] **기능 그래픽 1024×500**: `mydocs/release/icons/feature-graphic.png`
- [x] **폰 스크린샷 3장 (필수)**: `mydocs/release/screenshots/phone/`
- [x] **7인치 태블릿 스크린샷 3장 (선택)**: `mydocs/release/screenshots/tablet-7/`
- [x] **10인치 태블릿 스크린샷 3장 (선택)**: `mydocs/release/screenshots/tablet-10/`

### 정책 URL
- [x] **개인정보처리방침**: `https://sang-woon.github.io/gyeonggi-council/rhwp/privacy.html` (main 배포 후)

### AAB 빌드
- [ ] 키스토어 생성 (`keystore/release.keystore` — **작업지시자 작업**)
- [ ] `keystore/keystore.properties` 작성 — **작업지시자 작업**
- [ ] `bash scripts/build-android-release.sh` 실행 → AAB 생성

## 6. 작업지시자 작업 (자율 불가)

### 단계 4b — Release AAB 빌드

```bash
# 1. 키스토어 생성 (정보보안팀 협의)
cd D:\01_coding\gyeonggi-council\keystore
keytool -genkey -v -keystore release.keystore \
  -alias gyeonggi-council -keyalg RSA -keysize 2048 -validity 10000 \
  -storetype PKCS12

# 2. keystore.properties 작성 (template: keystore.properties.example)
# 3. 키스토어 클라우드 백업 (분실 시 재발행 불가)

# 4. AAB 빌드
cd D:\01_coding\gyeonggi-council
bash scripts/build-android-release.sh
# → rhwp-studio/android/app/build/outputs/bundle/release/app-release.aab
```

### 단계 5 — Play Console 제출

1. **main 브랜치로 머지** (Task #1·#2 통합 + 본 자율 산출물)
2. GitHub Pages 자동 배포 → 개인정보처리방침 URL 활성화 확인
3. Play Console 앱 생성 (이미 wooni0103@gg.go.kr 계정으로 D-U-N-S 등록 완료)
4. 메타데이터 입력 (위 체크리스트의 모든 자료 사용)
5. AAB 업로드
6. 내부 테스트 트랙 → 비공개 테스트 → 공개 트랙 순차 진행
7. 실 안드로이드 폰 검증:
   - 앱 정상 실행 (단계 1)
   - 햄버거 메뉴 동작 (단계 2)
   - 외부 .hwp 파일 인텐트 → 본 앱 후보 노출 (단계 3)
   - **폰트 누락 자동 감지 → 읽기 전용 모드** (Task #2 — 모바일 임계치 60%)
   - 큰 파일(10MB+) 메모리 OOM 없음
8. 실 안드로이드 폰에서 .hwp 파일 열기 → 정상 렌더링

## 7. 재현·갱신 방법

본 자율 산출물은 모두 스크립트로 자동 생성되므로 디자인/내용 수정 시 재실행:

```bash
# 아이콘 + 기능 그래픽 재생성
node scripts/generate-icons.mjs

# 스크린샷 재캡처 (Vite + Chrome)
node scripts/capture-screenshots.mjs

# Android APK 재빌드 (변경된 아이콘 반영)
cd rhwp-studio/android && ./gradlew :app:assembleDebug
```

수정 위치:
- 아이콘 디자인: `design/icon-source.svg` / `design/icon-foreground.svg`
- 기능 그래픽 텍스트: `scripts/generate-icons.mjs`의 `generateFeatureGraphic` 함수
- 스크린샷 시나리오: `scripts/capture-screenshots.mjs`의 `SCENARIOS` 배열
- 개인정보처리방침: `rhwp-studio/public/privacy.html`

## 결론

Play Store 제출에 필요한 모든 시각 자료·정책 URL·메타데이터 자율 생성 완료. 작업지시자의 키스토어 생성 + Play Console 제출만 남음.
