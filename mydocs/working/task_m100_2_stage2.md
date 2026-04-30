# Task #2 단계 2 완료보고서 — 읽기 전용 모드 상태 머신

## 상태

🟢 **단계 2 완료**

## 산출물

| 파일 | 종류 | 비고 |
|------|------|------|
| `rhwp-studio/src/core/readonly-mode.ts` | 신규 | 상태 머신 + 결정 함수 |
| `rhwp-studio/test/readonly-mode.test.mjs` | 신규 | 단위 테스트 38건 |
| `rhwp-studio/package.json` | 수정 | `test:unit` 양쪽 모듈 실행 |

## 모드 정의

| Mode | 의미 | isEditable |
|------|------|-----------|
| `edit` | 정상 편집 | ✅ |
| `readonly-auto` | 임계치 초과로 자동 진입 | ❌ |
| `readonly-forced` | 사용자가 경고를 인지하고 강제 활성화 | ✅ |

**단일 진실 원천**: `isEditable()` — UI 컴포넌트는 이 값으로만 활성/비활성을 결정.

## 임계치

| 환경 | warn (≥) | block (≥) |
|------|---------|-----------|
| 데스크톱 | 0.10 | 0.30 |
| 모바일 | 0.10 | 0.60 |

`level === 'block'` → `mode = readonly-auto` 자동 진입.
`level === 'warn'` → `mode = edit` 유지하되 배너 표시.

## 핵심 API

```ts
// 결정 (순수 함수)
decideMode(report, { isMobile?: boolean }): ModeDecision

// 상태 변경
applyDecision(decision)        // 결정을 적용 → 모드 통지
forceEditMode()                // readonly-auto → readonly-forced
clearForcedEdit()              // readonly-forced → 자동 결정 복귀
resetMode()                    // 새 문서 로드 직전 호출

// 조회
getMode(): Mode
getCurrentDecision(): ModeDecision | null
isEditable(): boolean

// 구독
onModeChange(fn): () => void   // 반환 함수로 해제
```

## 단위 테스트 결과

```
$ npm run test:unit
...
[font-availability]   결과: 32 pass / 0 fail
[readonly-mode]       결과: 38 pass / 0 fail
누계: 70 pass / 0 fail
```

| 그룹 (readonly-mode) | 케이스 수 | 통과 |
|---------------------|----------|------|
| 데스크톱 임계치 경계 | 6 | ✅ |
| 데스크톱 모드 결정 | 3 | ✅ |
| 모바일 임계치 | 4 | ✅ |
| isMobile 플래그 전파 | 2 | ✅ |
| 상수 export | 3 | ✅ |
| applyDecision + getMode | 3 | ✅ |
| forceEditMode | 2 | ✅ |
| forceEditMode는 readonly-auto에서만 | 1 | ✅ |
| clearForcedEdit | 3 | ✅ |
| resetMode | 2 | ✅ |
| onModeChange 리스너 | 3 | ✅ |
| 동일 모드 재적용 시 noop | 2 | ✅ |
| isEditable 진실값 표 | 3 | ✅ |
| 리스너 예외 격리 | 1 | ✅ |
| **합계** | **38** | **0 fail** |

### 핵심 검증

- **임계치 경계 정확**: 0.29 → warn, 0.30 → block (`>=` 동등 처리)
- **모바일 관대 정책**: 0.59 모바일 → warn (데스크톱이면 block)
- **forceEditMode 안전**: edit 상태에서 호출해도 안전 (noop), readonly-auto에서만 전환
- **리스너 예외 격리**: 한 리스너의 throw가 다른 리스너 진행을 막지 않음

## 단계 1 ↔ 단계 2 연결

```
fontsUsed (string[])
  └─ evaluateFontAvailability() ─→ AvailabilityReport (단계 1)
                                      └─ decideMode() ─→ ModeDecision (단계 2)
                                                            └─ applyDecision() ─→ 모드 변경
                                                                                    └─ onModeChange 리스너 (단계 3 UI)
```

## 회귀 위험

- 기존 코드 변경 0건 — 신규 모듈 + package.json 스크립트 추가만
- `tsc --noEmit` 통과
- 단계 1과 동일한 패턴(순수 함수 + 상태 머신 분리)으로 테스트 가능성 확보

## 다음 단계

**단계 3** — UI 배너 + 도구 비활성 처리 + 다이얼로그 (DOM 결합 시작).

## 승인 요청

본 단계 2 완료 보고 승인 + 단계 3 착수 허가 요청.
