# Task #2 수행계획서 — 폰트 누락 시 자동 읽기모드 전환

## 메타

| 항목 | 값 |
|------|----|
| 이슈 | sang-woon/gyeonggi-council #2 |
| 마일스톤 | M100 / v1.0.0 |
| 브랜치 | `local/task2` (분기점: `local/devel`) |
| 의존성 | Task #1과 독립 (모바일 검증은 Task #1 단계 1 이후) |
| 우선순위 | P1 (사용자 보고 — PPTX/HWP 폰트 누락 시 글자 깨짐) |

## 목표

HWP 문서가 사용하는 폰트 중 **시스템·번들에서 확보 불가능한 폰트 비중이 임계치를 초과**하면, rhwp-studio를 자동으로 **읽기 전용 모드**로 전환하여 사용자가 본의 아니게 깨진 폰트로 편집·저장하는 사고를 방지한다. 모바일(Capacitor) 환경에서 특히 효용이 크다.

## 배경

- 사용자 현장 보고: PPTX/HWP에 사용된 폰트가 시스템에 없으면 글자가 이상하게 보임. 사용자는 "정상 표시"인 줄 알고 편집·저장할 위험이 있음.
- 현재 `font-loader.ts`는 **로드 시도**는 하지만, 누락 폰트의 **누적 비중**을 측정하여 UX적으로 후속 조치하는 흐름이 없음.
- Capacitor 모바일 환경(Android)은 데스크톱 대비 사용 가능 폰트가 훨씬 적음(맑은 고딕/함초롬 등 대부분 부재).
- 사용자가 깨진 폰트로 저장 → 원본 손상 위험을 사전 차단해야 함.

## 범위

### 포함

1. **폰트 가용성 평가 모듈** (`src/core/font-availability.ts` 신규)
   - 문서에서 추출한 폰트 목록을 입력으로 받아, 각 폰트별 가용성 등급(`available` / `substituted` / `missing`)을 산출
   - 판정 기준: (1) `document.fonts.check()` 통과 (2) `font-substitution.ts`의 치환 체인 끝이 OS/번들 폰트로 도달 (3) 그 외는 `missing`
   - 가중치: 문서 내 폰트 사용 빈도(글자 수 기준) 가중 평균
   - 결과 객체: `{ totalGlyphs, availableGlyphs, substitutedGlyphs, missingGlyphs, missingRatio, perFont: Map<string, FontStatus> }`

2. **읽기 전용 모드 전환 로직** (`src/core/readonly-mode.ts` 신규)
   - 임계치 정책: 누락 비중 ≥ **30%** (글자 수 기준) → 자동 읽기 전용 진입
   - 임계치 ≥ 10% < 30% → 경고 배너만 표시 (편집은 허용)
   - 사용자 강제 해제 옵션: 한 번의 명시적 동의(체크박스)로 편집 모드 복귀
   - 모드 상태: `Mode = 'edit' | 'readonly-auto' | 'readonly-forced'` (확장성 고려)

3. **UI 인디케이터 + 배너** (`src/ui/readonly-banner.ts` 신규 + 기존 도구 상자/메뉴 비활성화)
   - 상단 배너: "이 문서의 폰트 N종이 시스템에 없어 **읽기 전용**으로 표시됩니다. [자세히] [편집 강제 활성화]"
   - 도구 상자(`#icon-toolbar`) / 서식 도구 모음(`#style-bar`) / 편집 메뉴(`md-edit`) 비활성 처리 (CSS `data-mode="readonly"` + `pointer-events: none` + 시각 표시)
   - 상태 표시줄(`#status-bar`)에 "읽기 전용" 배지

4. **자세히 보기 다이얼로그** (`src/ui/font-status-dialog.ts` 신규)
   - 누락/치환 폰트 목록 + 각 폰트의 사용 글자 수 + 권장 대안

5. **테스트**
   - 단위 테스트: 임계치 경계, 가중치 계산, 모드 전환 로직
   - E2E (Puppeteer): 폰트 누락 샘플 → 읽기 전용 진입 → 강제 해제 → 편집 가능 검증

### 제외

- 폰트 자동 다운로드/설치 기능
- 누락 폰트 OS별 자동 추천 설치 가이드 (별도 타스크)
- HWP 파서 측 폰트 메타데이터 추가 (Rust 측 변경 없음 — 기존 IR의 `char_shapes[].font_name` 활용)
- PPTX는 본 타스크 비대상 (이슈 본문은 HWP 한정)

## 산출물

| 파일 | 종류 |
|------|------|
| `rhwp-studio/src/core/font-availability.ts` | 신규 |
| `rhwp-studio/src/core/readonly-mode.ts` | 신규 |
| `rhwp-studio/src/ui/readonly-banner.ts` | 신규 |
| `rhwp-studio/src/ui/font-status-dialog.ts` | 신규 |
| `rhwp-studio/src/styles/readonly-banner.css` | 신규 |
| `rhwp-studio/src/main.ts` | 수정 (모드 진입점 통합) |
| `rhwp-studio/src/command/commands/file.ts` | 수정 (open 후 평가 트리거) |
| `rhwp-studio/src/ui/menu-bar.ts` | 수정 (편집 항목 비활성 처리) |
| `rhwp-studio/src/ui/icon-toolbar.ts` | 수정 (도구상자 비활성 처리) |
| `rhwp-studio/src/ui/style-bar.ts` | 수정 (서식 도구 비활성 처리) |
| `rhwp-studio/test/font-availability.test.ts` | 신규 (단위) |
| `rhwp-studio/e2e/readonly-mode.test.mjs` | 신규 (E2E) |
| `mydocs/manual/readonly_mode_guide.md` | 신규 (사용자 가이드) |

## 임계치 정책 (초안)

| 누락 비중 (글자 수) | 동작 |
|-------------------|------|
| < 10% | 정상 (경고 없음) |
| 10% ~ 30% | 노란 배너 + 편집 허용 |
| ≥ 30% | 빨간 배너 + 자동 읽기 전용 진입 |

수치는 단계 1 구현 중 1~2개 샘플 문서로 검증 후 조정 가능.

## 위험 및 대응

| 위험 | 대응 |
|------|------|
| `document.fonts.check()`가 거짓 양성 (fallback 글꼴로 매칭) | OS_FONT_CANDIDATES 화이트리스트 + 번들 등록 폰트 Set 이중 검증 |
| 모바일에서 누락 비중 항상 높아 모든 문서가 읽기 전용 | 임계치 모바일 별도 (Android 기본 60%) 또는 사용자 1회 동의로 학습 |
| 사용자가 강제 편집 후 깨진 채 저장 | 강제 활성화 시 1회 모달 경고 + 저장 시 한 번 더 확인 |
| 기존 편집 기능 회귀 (비활성 처리 누락) | E2E에서 편집 모드/읽기 전용 양쪽 검증 |

## 일정 (예상)

- 단계 1 (1~2일): 폰트 가용성 평가 모듈 + 단위 테스트
- 단계 2 (1일): 읽기 전용 모드 전환 로직
- 단계 3 (1~2일): UI 배너/다이얼로그 + 도구 비활성 처리
- 단계 4 (1일): 통합 + E2E + 모바일 검증 (Capacitor)

## 단계 분해 (구현계획서에서 상세화 예정)

| 단계 | 제목 | 자율 가능 |
|------|------|----------|
| 1 | 폰트 가용성 평가 모듈 + 단위 테스트 | ✅ |
| 2 | 읽기 전용 모드 상태 머신 + 강제 해제 | ✅ |
| 3 | UI 배너 + 도구 비활성 처리 + 다이얼로그 | ✅ |
| 4 | 통합/E2E + 모바일(Capacitor) 검증 | ⚠️ 모바일 디바이스 필요 시 작업지시자 협조 |

## 승인 요청

본 수행계획서 승인 후 구현계획서(`task_m100_2_impl.md`) 작성 진행.
