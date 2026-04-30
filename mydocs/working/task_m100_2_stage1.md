# Task #2 단계 1 완료보고서 — 폰트 가용성 평가 모듈

## 상태

🟢 **단계 1 완료**

## 산출물

| 파일 | 종류 | 비고 |
|------|------|------|
| `rhwp-studio/src/core/font-availability-core.ts` | 신규 | 순수 함수 + DI (의존성 없음) |
| `rhwp-studio/src/core/font-availability.ts` | 신규 | 런타임 진입점 (font-loader/substitution 주입) |
| `rhwp-studio/test/font-availability.test.mjs` | 신규 | 단위 테스트 32건 |
| `rhwp-studio/package.json` | 수정 | `test:unit` 스크립트 추가 |

## 설계 결정

### 1. 코어/런타임 2-파일 분리

당초 계획에서는 단일 `font-availability.ts`였으나, **Node 단위 테스트 가능성**을 위해 분리.

- `font-availability-core.ts`: 순수 함수 `evaluateFontAvailabilityWith(fontsUsed, deps)` — DI, 외부 import 없음
- `font-availability.ts`: 런타임 진입점 `evaluateFontAvailability(fontsUsed)` — 실제 deps 주입 (REGISTERED_FONTS, getDetectedOSFonts, resolveFont)

이렇게 분리하면 (1) DOM 의존 없는 코어를 Node로 직접 테스트 가능, (2) 테스트가 mock setup 없이 deps 주입만으로 충분.

### 2. Node 24 `--experimental-strip-types` 활용

기존 프로젝트는 vitest 등 단위 테스트 프레임워크 미도입. Node 24의 네이티브 타입 스트립 기능으로 별도 의존성 없이 `.ts` 파일 직접 import.

### 3. 빈 입력 / undefined / 공백 정리

`fontsUsed` 항목 중 빈 문자열·undefined·공백은 자동 제외 (`totalCount`에 미포함). HWP 파서가 비정상 폰트 항목을 보내도 안전.

## 가용성 등급 정의 (코어)

| 등급 | 판정 |
|------|------|
| `registered` | 번들 woff2(@font-face 등록)에 존재 |
| `os` | OS 폰트 감지 결과(`getDetectedOSFonts()`)에 존재 |
| `substituted` | 치환 결과(`resolveFont`)가 입력과 다르고, 그 결과가 registered 또는 os에 존재 |
| `missing` | 위 3개 모두 실패 |

`missingRatio = missingCount / totalCount` (분모 0이면 0).

## 단위 테스트 결과

```
$ npm run test:unit
...
결과: 32 pass / 0 fail
```

| 그룹 | 케이스 수 | 통과 |
|------|----------|------|
| 빈 입력 | 3 | ✅ |
| 전부 registered | 4 | ✅ |
| 전부 OS 폰트 | 3 | ✅ |
| 치환 가능 | 5 | ✅ |
| 전부 missing | 3 | ✅ |
| 50% missing | 3 | ✅ |
| 33% missing (10건 중 3건) | 5 | ✅ |
| 빈 문자열·undefined·공백 정리 | 2 | ✅ |
| 치환 결과가 미설치면 missing | 2 | ✅ |
| 대소문자 구분 (입력 그대로) | 2 | ✅ |
| **합계** | **32** | **0 fail** |

### 핵심 케이스 — 33% missing

```ts
fonts = [
  '함초롬바탕', '함초롬돋움', 'Pretendard',          // registered (3)
  '맑은 고딕', 'Apple SD Gothic Neo',                  // os (2)
  '한컴바탕', 'Malgun Gothic',                          // substituted (2)
  'UnknownA', 'UnknownB', 'UnknownC',                   // missing (3)
];
// totalCount=10, availableCount=5, substitutedCount=2, missingCount=3
// missingRatio=0.30 → 단계 2 임계치(블록 0.30)에 정확히 도달
```

## 회귀 위험

- 기존 코드 변경 0건 — 신규 모듈만 추가
- `tsc --noEmit` 통과 (전체 프로젝트 타입 체크)
- 기존 import 체인(font-loader/substitution) 미변경

## 다음 단계

**단계 2** — 읽기 전용 모드 상태 머신 (`readonly-mode.ts`) + 단위 테스트.

## 승인 요청

본 단계 1 완료 보고 승인 + 단계 2 착수 허가 요청.
