# Task #2 최종 결과보고서 — 폰트 누락 시 자동 읽기모드 전환

## 메타

| 항목 | 값 |
|------|----|
| 이슈 | sang-woon/gyeonggi-council #2 |
| 마일스톤 | M100 / v1.0.0 |
| 브랜치 | `local/task2` |
| 분기점 | `local/devel` |
| 진행 기간 | 2026-04-30 (단일 세션) |
| 단계 수 | 4단계 (전 단계 자율 완료) |

## 결과 요약

🟢 **자율 가능 범위 100% 완료** (모바일 실기기 검증은 Task #1 단계 4b 머지 후 통합 진행)

| 항목 | 결과 |
|------|------|
| 단위 테스트 (font-availability) | 32 pass / 0 fail |
| 단위 테스트 (readonly-mode) | 38 pass / 0 fail |
| E2E 테스트 (readonly-mode) | 18 pass / 0 fail |
| 누계 | **88 pass / 0 fail** |
| TypeScript (`tsc --noEmit`) | 무경고 |
| 프로덕션 빌드 (`npm run build`) | 성공 (PWA precache 17 entries / 1674.18 KiB) |

## 산출물

### 신규 파일 (10건)

| 파일 | 역할 |
|------|------|
| `rhwp-studio/src/core/font-availability-core.ts` | 순수 함수 + DI (테스트 가능) |
| `rhwp-studio/src/core/font-availability.ts` | 런타임 진입점 (실제 deps 주입) |
| `rhwp-studio/src/core/readonly-mode.ts` | 모드 상태 머신 + 임계치 판정 |
| `rhwp-studio/src/ui/readonly-banner.ts` | 모드 반응형 상단 배너 |
| `rhwp-studio/src/ui/font-status-dialog.ts` | 폰트별 상태 표 다이얼로그 |
| `rhwp-studio/src/styles/readonly-banner.css` | 배너 스타일 + 도구 비활성 CSS |
| `rhwp-studio/test/font-availability.test.mjs` | 단위 테스트 32건 |
| `rhwp-studio/test/readonly-mode.test.mjs` | 단위 테스트 38건 |
| `rhwp-studio/e2e/readonly-mode.test.mjs` | E2E 6 시나리오 / 18 assertions |
| `mydocs/manual/readonly_mode_guide.md` | 사용자 가이드 |

### 수정 파일 (2건)

| 파일 | 변경 |
|------|------|
| `rhwp-studio/src/main.ts` | initializeDocument에 평가/모드 결정 통합, InputHandler 동기화, DEV 모드 모듈 노출 |
| `rhwp-studio/package.json` | `test:unit`, `e2e:readonly-mode` 스크립트 |

### 계획·보고 문서 (6건)

| 파일 | 내용 |
|------|------|
| `mydocs/plans/task_m100_2.md` | 수행계획서 |
| `mydocs/plans/task_m100_2_impl.md` | 구현계획서 |
| `mydocs/working/task_m100_2_stage1.md` | 단계 1 보고 |
| `mydocs/working/task_m100_2_stage2.md` | 단계 2 보고 |
| `mydocs/working/task_m100_2_stage3.md` | 단계 3 보고 |
| `mydocs/working/task_m100_2_stage4.md` | 단계 4 보고 |

## 핵심 설계 결정

### 1. 가용성 판정 4등급

```
registered → @font-face 등록된 번들 폰트 (17개)
os         → 시스템 OS에 설치된 폰트 (document.fonts.check)
substituted→ font-substitution.ts의 치환 체인 끝이 registered/os
missing    → 위 3개 모두 실패
```

### 2. 임계치 — 데스크톱/모바일 분리

| 환경 | warn | block |
|------|-----|-------|
| 데스크톱 | 누락률 ≥ 0.10 | 누락률 ≥ 0.30 |
| 모바일 | 누락률 ≥ 0.10 | 누락률 ≥ 0.60 |

모바일은 시스템 폰트가 적기 때문에 임계치를 관대하게.

### 3. 모드 3종 + 단일 진실 원천 `isEditable()`

```
edit             → 일반 편집  (배너 없음 또는 노란 경고만)
readonly-auto    → 자동 읽기 전용  (빨간 배너, 도구 비활성, 캐럿 숨김)
readonly-forced  → 사용자 강제 편집  (빨간 경고 잔존, 도구 활성, 캐럿 표시)
```

UI 컴포넌트는 `isEditable()` 단일 함수로 활성/비활성 판단.

### 4. 순수 코어 + 런타임 진입점 분리

`font-availability-core.ts`(DI, DOM 의존 없음) + `font-availability.ts`(실제 deps 주입). 이 패턴으로 Node `--experimental-strip-types`로 단위 테스트 가능, 외부 테스트 프레임워크 불필요.

### 5. 강제 편집 안전 장치

`readonly-auto` → "편집 강제 활성화" → 모달 경고 ("폰트가 없는 글자는 다르게 보일 수 있고, 저장 시 원본 손상 위험") → 사용자 확인 → `forceEditMode()`. 빨간 경고 배너는 잔존하여 위험 상태 인지 유지.

## 동작 흐름

```
HWP 문서 로드 (initializeDocument)
  ├─ resetMode()                                     # 이전 모드 초기화
  ├─ loadWebFonts(fontsUsed)                         # CSS @font-face 등록 + OS 감지
  ├─ evaluateFontAvailability(fontsUsed)  ──→ AvailabilityReport
  ├─ decideMode(report, { isMobile })     ──→ ModeDecision
  ├─ applyDecision(decision)                         # 모드 적용 + 통지
  └─ mountReadonlyBanner()                           # 1회 마운트, 이후 자동 갱신

onModeChange 통지
  ├─ readonly-banner: body.dataset.mode 갱신 + 배너 렌더 (warn/block/forced)
  └─ main.ts: InputHandler.activate() / deactivate() 동기화
```

## 발견·수정된 버그

### applyDecision 미통지 (단계 4)

`setMode()`가 동일 모드일 때 noop인 점 때문에, level만 변하는 케이스(`ok` → `warn`)가 통지되지 않아 배너 미갱신. `applyDecision`은 항상 `notify()` 하도록 수정. 단위 테스트에 영향 없음 (38/38 유지).

### E2E 모듈 인스턴스 분리 (단계 4)

`import('/src/...')` (테스트)와 `@/core/...` (main.ts) 가 별도 인스턴스로 평가되어 상태 분리. main.ts 가 DEV 모드에서 `window.__readonly` / `window.__banner` 로 노출 + 사전 mount.

## Task #1과의 머지 경로

| 항목 | 처리 |
|------|------|
| `isMobileLike()` 인라인 헬퍼 | Task #1 머지 후 `isNativePlatform()` 기반으로 통일 |
| `local/task2` → `local/devel` | 작업지시자 승인 후 머지 |
| Task #1 단계 4b/5 | 작업지시자 keystore 생성 + 실기기 검증 + Play Console 제출 |

## Play Store 배포 관점 영향

본 기능은 **모바일 환경에서 폰트 부재로 인한 사용자 데이터 손상 사고를 방지**하는 핵심 안전 장치이므로, Play Store 1.0 출시에 매우 적합한 기능.

| 항목 | 영향 |
|------|------|
| AAB 빌드 | 영향 없음 (코드 추가만, 권한 변경 없음) |
| 데이터 안전 양식 | 영향 없음 (외부 전송 없음) |
| Play Store 등록 정보 | "주요 기능"에 "폰트 누락 자동 감지 + 안전 모드" 추가 권장 |
| 사용자 가이드 | 앱 내 도움말 또는 Play Store 설명에 링크 가능 |

## 후속 과제 (Task #2 범위 외)

- 폰트 자동 다운로드/설치 안내 (Play Store 정책 호환 가능 범위에서)
- 누락 폰트별 OS별 설치 가이드
- HWP 파서 측 폰트별 글자 수 메타데이터 노출 (글자 수 가중 평균으로 임계치 정밀도 향상)
- 환경설정에서 영구 비활성 옵션 (개인정보 처리방침 검토 필요)

## 승인 요청

본 최종 결과보고서 승인 + `local/task2` → `local/devel` 머지 절차 합의 요청.

머지 후 다음 작업:
1. Task #1 단계 4b·5 (작업지시자 작업)
2. v1.0.0 릴리즈 준비 (Task #1 + Task #2 함께)
