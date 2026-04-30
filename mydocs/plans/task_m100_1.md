# Task #1: Capacitor 기반 Google Play Store 배포 (경기도의회 명의) — 수행 계획서

## 수행 목표

rhwp(Rust→WASM HWP 뷰어)를 Capacitor로 패키징하여 경기도의회 명의로 Google Play Store에 등록 가능한 AAB(Android App Bundle)를 산출한다. 최종 목표는 Play Console 심사 제출 및 정식 출시.

## 배경

- 업스트림 `edwardkim/rhwp`의 다운스트림 기관 배포판 (`sang-woon/gyeonggi-council`)
- Play Console 계정: `wooni0103@gg.go.kr` (경기도의회/공공기관, 조직 인증 진행 중)
- 패키징 방식: **Capacitor** 선택 (TWA·Tauri Mobile 대비 비교 후)
  - HWP 뷰어는 로컬 파일 접근이 필수 → TWA의 HTTPS 호스팅 의존 회피
  - Tauri Mobile은 알파/베타 → 프로덕션 부적합
  - 네이티브 쉘이 있어 Play 정책 "단순 웹 래핑" 거부 위험 회피

## 범위

### 포함

- Capacitor Android 프로젝트 셋업 (`android/`)
- `rhwp-studio/dist` 웹 빌드 산출물 통합
- 모바일 UX 최적화 (터치/하단바/파일 피커)
- 네이티브 파일 시스템 통합 (`@capacitor/filesystem` + 파일 피커 플러그인)
- 앱 서명 키 생성 및 관리 (debug + release)
- 서명된 AAB 빌드 산출
- Play Console 메타데이터 작성 (앱 설명, 스크린샷, 카테고리)
- 개인정보처리방침 / 데이터 안전 섹션 작성 (공공기관 기준)
- 배포 매뉴얼 (`mydocs/manual/play_store_release_guide.md`)

### 제외

- iOS App Store 배포 (별도 마일스톤 — 업스트림 M5 참조)
- Play Store 등록비 결제 / 조직 인증 / D-U-N-S 발급 절차 (Console 측 준비 작업)
- 폰트 폴백 모드 (별도 이슈로 분리 예정 — "폰트 누락 시 자동 읽기모드 전환")

## 산출물

| 산출물 | 경로 |
|--------|------|
| Capacitor Android 프로젝트 | `android/` |
| Capacitor 설정 | `capacitor.config.ts` |
| 빌드 스크립트 | `scripts/build-android.sh` |
| 서명 키 (private, .gitignore) | `keystore/` |
| 서명된 AAB | `android/app/build/outputs/bundle/release/app-release.aab` |
| 배포 매뉴얼 | `mydocs/manual/play_store_release_guide.md` |
| 개인정보처리방침 | `mydocs/release/privacy_policy.md` |
| 단계별 보고서 | `mydocs/working/task_m100_1_stage{N}.md` |
| 최종 보고서 | `mydocs/report/task_m100_1_report.md` |

## 구현 계획서

`mydocs/plans/task_m100_1_impl.md` (다음 단계에서 작성, 별도 승인 요청)

## 브랜치

`local/task1`

## 예상 단계: 5단계

1. **Capacitor 셋업 + 웹 빌드 통합** — 의존성 추가, `capacitor.config.ts`, `dist` 생성 검증
2. **모바일 UX 최적화** — 뷰포트, 터치 이벤트, 하단 안전영역, 작은 화면 메뉴 재배치
3. **네이티브 파일 통합** — `.hwp` 파일 열기/저장, 안드로이드 파일 피커, 권한 처리
4. **앱 서명 + AAB 빌드** — 키스토어 생성, signing 설정, release AAB 생성, 로컬 디바이스 검증
5. **Play Console 자료 + 심사 제출** — 스크린샷, 앱 설명, 개인정보처리방침, 데이터 안전 섹션, 심사 제출

## 의존성 / 사전 조건

- Play Console 조직 계정 인증 완료 (`wooni0103@gg.go.kr`, D-U-N-S 발급 완료)
- Android Studio + JDK 17+ 설치 (빌드/서명용)
- Node.js 20+ (Capacitor CLI)
- 기존 `rhwp-studio` 빌드가 정상 동작 (`npm run build`)

## 위험 요소

| 위험 | 대응 |
|------|------|
| Play 정책 "단순 웹 래핑" 거부 | 단계 2에서 모바일 UX 최적화 + 네이티브 통합으로 차별화 |
| HWP 파일이 큰 경우 WebView 메모리 부족 | 단계 3에서 페이지네이션·증분 로딩 검증 |
| 한글 IME 문제 | 업스트림 이슈 #23(Chrome 한글 IME) 참고, 기존 대응 코드 활용 |
| 폰트 누락으로 글자 깨짐 | 본 태스크 범위 외 — 별도 이슈로 분리하여 후속 처리 |
| 서명 키 분실/유출 | 단계 4에서 키스토어 백업 절차 + .gitignore 등록 |

## 참고 문서

- `mydocs/manual/browser_extension_dev_guide.md` — 모바일/확장 보안·UX 가이드
- `mydocs/tech/font_fallback_strategy.md` — 폰트 폴백 전략
- 업스트림 이슈 #23 (안드로이드 Chrome 한글 IME)
- 업스트림 이슈 #383 (PWA 설치 지원) — 일부 설정 재사용 가능

## 승인 요청

본 수행계획서가 승인되면 구현계획서(`task_m100_1_impl.md`) 작성으로 진행합니다.
