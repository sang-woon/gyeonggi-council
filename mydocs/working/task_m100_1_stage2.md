# Task #1 단계 2 완료보고서 — 모바일 UX 최적화

## 상태

🟢 **완료**

## 배경

기존 `rhwp-studio/src/styles/responsive.css`에 이미 풍부한 모바일 미디어쿼리가 존재. `.mobile-menu-toggle` 버튼·`.mobile-open` 토글 클래스 자리는 마련되어 있었으나 이를 주입·토글하는 **JS 컨트롤러가 부재**했음. 단계 2의 핵심은 이 JS 컨트롤러를 구현하고 viewport·safe-area·visualViewport 설정을 보강하는 것.

## 변경 내역

| 파일 | 변경 |
|------|------|
| `rhwp-studio/index.html` | viewport meta에 `viewport-fit=cover` 추가 (safe-area-inset 활성화) |
| `rhwp-studio/src/ui/mobile-menu.ts` (신규) | `MobileMenu` 클래스 — 햄버거 버튼 동적 주입, `.mobile-open` 토글, 외부 클릭 닫기, viewport 변화 시 자동 부착/제거, `visualViewport` 기반 `body.keyboard-open` 토글 |
| `rhwp-studio/src/main.ts` | `MobileMenu` 인스턴스 생성 + `MenuBar`와 동시 주입 |
| `rhwp-studio/src/styles/responsive.css` | safe-area-inset 패딩(`#status-bar`/`#menu-bar`/`#scroll-container`), `body.keyboard-open` 기반 키보드 대응 (기존 미디어쿼리 fallback 유지) |
| `rhwp-studio/e2e/mobile-menu-static.mjs` (신규) | 모바일 메뉴 통합 테스트 (정적 서버 + Puppeteer) |

## 핵심 동작

### 1. 햄버거 메뉴 (`< 768px`)
- `MobileMenu` 생성자에서 `(max-width: 767px)` 매치 시 `<button class="mobile-menu-toggle">☰</button>`을 `#menu-bar` 첫 자식으로 주입
- 클릭 → `#menu-bar.mobile-open` 토글 → CSS가 `.menu-item` 모두 표시
- 메뉴 외부 클릭/터치 → 자동 닫힘
- viewport 변경 (회전·창 크기 조절) → 자동 부착/제거

### 2. Safe-area-inset
- `#status-bar`: `padding-bottom: env(safe-area-inset-bottom)`로 홈 인디케이터 영역 회피
- `#menu-bar`: 좌우 노치 회피
- `#scroll-container`: 좌우 노치 회피
- `viewport-fit=cover`로 활성화

### 3. 가상 키보드 (`visualViewport` API)
- 키보드 표시 → `body.keyboard-open` 추가 → 메뉴/도구바/상태바 숨김
- `--visual-viewport-height` CSS 변수로 정확한 가용 높이 산출
- 미지원 브라우저: 기존 `@media (max-height: 500px)` fallback 동작

### 4. 기존 responsive.css와 통합
- 기존 `.mobile-menu-toggle`, `.mobile-open` 정의된 CSS 규칙이 즉시 활성화됨
- 기존 모바일 대화상자(시트 스타일), 도구바 가로 스크롤, 터치 타겟 확대 등 그대로 활용

## 검증

### TypeScript + Vite 빌드
```
✓ built in 854ms
dist/assets/index-DkDomexP.js  683.84 kB │ gzip: 145.38 kB
```
번들 +2KB (mobile-menu.ts 추가분).

### Puppeteer E2E (mobile-menu-static.mjs)

| 검증 | 결과 |
|------|------|
| 375×667 viewport에서 `.mobile-menu-toggle` 존재 | ✅ |
| 버튼 클릭 → `#menu-bar.mobile-open` 추가 | ✅ |
| 외부 클릭 → `mobile-open` 제거 | ✅ |
| 1280×800으로 viewport 전환 → 토글 자동 제거 | ✅ |

콘솔 에러 없음 (네트워크 404 2건은 PWA 자산 관련, 모바일 메뉴와 무관 — 정보성 로그로 분리).

### Capacitor 동기화
- `npx cap sync android` 성공: 새 dist가 `android/app/src/main/assets/public/`에 반영됨

## 보류 / 단계 3·4 의존

| 항목 | 사유 |
|------|------|
| 핀치 줌·두 손가락 스크롤 검증 | 실기기 또는 에뮬레이터 필요 (단계 3·4 시점 통합 검증) |
| 키보드 표시 시 실제 동작 | 실기기 검증 필요 (코드는 시뮬레이션 검증 통과) |
| 햄버거 버튼 시각 디자인 | 현재 `☰` 텍스트. 단계 5(스토어 자료)에서 디자인 통일 검토 |

## 다음 단계 (단계 3 — 네이티브 파일 통합)

- `@capacitor/filesystem` + 파일 피커 플러그인 설치
- `Capacitor.isNativePlatform()` 분기로 .hwp 파일 열기 / SVG 저장
- `AndroidManifest.xml`에 `intent-filter` (외부 앱에서 .hwp 탭 시 본 앱 노출)
- 권한 처리 (Android 13+ READ_MEDIA_*, SAF 우선)

## 승인 요청

본 단계 2 완료보고서 승인 + 단계 3 진입 합의를 요청합니다.
