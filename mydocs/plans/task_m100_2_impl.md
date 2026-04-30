# Task #2 구현계획서 — 폰트 누락 시 자동 읽기모드 전환

## 메타

- 수행계획서: `mydocs/plans/task_m100_2.md`
- 브랜치: `local/task2`
- 단계 수: **4단계**
- 자율 진행 범위: 단계 1~3 전부, 단계 4 데스크톱 부분 (모바일 디바이스 검증은 Task #1 단계 4b 이후 통합)

## 사전 조사 결과

### WASM `getDocumentInfo()`의 한계

`src/document_core/mod.rs:142` `get_document_info()`는 `doc_info.font_faces` (선언 목록)만 반환하며 **폰트별 글자 수 가중치 없음**.

→ 본 구현은 **선언 폰트 수 기준 비율**(`missing_count / total_count`)로 시작. 글자 수 가중은 별도 Rust 변경이 필요하므로 본 타스크에서 분리 (필요 시 후속 타스크).

### 가용성 판정 3단계

1. **registered (번들)**: `REGISTERED_FONTS.has(name)` (font-loader.ts에 @font-face 등록된 17개 woff2)
2. **os (시스템)**: `getDetectedOSFonts().has(name)` (font-loader.ts의 OS_FONT_CANDIDATES 화이트리스트)
3. **substituted (치환)**: `font-substitution.ts`의 치환 체인 끝이 1 또는 2에 도달
4. 그 외 → **missing**

### 모드 진입점

`src/main.ts:411` `initializeDocument()` 안에서 `loadWebFonts(docInfo.fontsUsed, ...)` 직후가 평가 시점. 이후 `inputHandler.activateWithCaretPosition()` 전후로 모드 적용.

## 단계 1 — 폰트 가용성 평가 모듈 + 단위 테스트

### 목표

문서의 `fontsUsed: string[]`를 입력으로 받아 가용성 보고서를 산출하는 순수 모듈을 만든다. UI/모드 변경 코드 없음.

### 신규 파일

#### `rhwp-studio/src/core/font-availability.ts`

```ts
import { REGISTERED_FONTS, getDetectedOSFonts } from './font-loader';
import { getSubstitutedFontName } from './font-substitution';

export type FontAvailability = 'registered' | 'os' | 'substituted' | 'missing';

export interface FontStatus {
  name: string;
  availability: FontAvailability;
  resolvedTo?: string;
}

export interface AvailabilityReport {
  totalCount: number;
  availableCount: number;
  substitutedCount: number;
  missingCount: number;
  missingRatio: number;
  perFont: FontStatus[];
}

export function evaluateFontAvailability(fontsUsed: string[]): AvailabilityReport {
  const perFont: FontStatus[] = [];
  let avail = 0, sub = 0, miss = 0;
  const osFonts = getDetectedOSFonts();
  for (const name of fontsUsed) {
    if (REGISTERED_FONTS.has(name)) {
      perFont.push({ name, availability: 'registered' });
      avail++; continue;
    }
    if (osFonts.has(name)) {
      perFont.push({ name, availability: 'os' });
      avail++; continue;
    }
    const resolved = getSubstitutedFontName(name);
    if (resolved && (REGISTERED_FONTS.has(resolved) || osFonts.has(resolved))) {
      perFont.push({ name, availability: 'substituted', resolvedTo: resolved });
      sub++; continue;
    }
    perFont.push({ name, availability: 'missing' });
    miss++;
  }
  const total = fontsUsed.length;
  return {
    totalCount: total,
    availableCount: avail,
    substitutedCount: sub,
    missingCount: miss,
    missingRatio: total === 0 ? 0 : miss / total,
    perFont,
  };
}
```

#### `rhwp-studio/test/font-availability.test.ts` (단위)

vitest 기반. `font-loader.ts` 의존을 모킹하여 다음 케이스 커버:

- 빈 배열 → `missingRatio: 0`
- 모든 폰트 registered → `missingRatio: 0`
- 50% missing → 정확한 비율
- 치환 가능한 폰트 → `substituted`로 분류
- 100% missing → `missingRatio: 1`

### 기존 파일 수정

- `rhwp-studio/src/core/font-substitution.ts`: 치환 체인 끝 폰트명을 반환하는 헬퍼 `getSubstitutedFontName(name: string): string | undefined` 추가 (기존 치환 테이블 재사용, 사이드이펙트 없음).

### 검증

```bash
cd rhwp-studio
npm run test -- font-availability  # vitest 단위
```

### 산출물

- `font-availability.ts` (신규)
- `font-availability.test.ts` (신규, 5+ 테스트)
- `font-substitution.ts` (수정, 헬퍼 추가)
- `mydocs/working/task_m100_2_stage1.md` (단계 보고서)

### 승인 시점

단위 테스트 통과 + 모듈 단독 검증 완료 후.

## 단계 2 — 읽기 전용 모드 상태 머신 + 강제 해제

### 목표

가용성 보고서를 입력받아 모드를 결정하고 외부에 통지하는 상태 머신을 만든다. UI 결합 없음 (단계 3에서 결합).

### 신규 파일

#### `rhwp-studio/src/core/readonly-mode.ts`

```ts
import type { AvailabilityReport } from './font-availability';

export type Mode = 'edit' | 'readonly-auto' | 'readonly-forced';

export interface ModeDecision {
  mode: Mode;
  level: 'ok' | 'warn' | 'block';
  report: AvailabilityReport;
}

export const THRESHOLDS = {
  warn: 0.10,
  block: 0.30,
} as const;

export function decideMode(report: AvailabilityReport, opts?: { isMobile?: boolean }): ModeDecision {
  const block = opts?.isMobile ? 0.60 : THRESHOLDS.block;
  const warn = THRESHOLDS.warn;
  const r = report.missingRatio;
  if (r >= block) return { mode: 'readonly-auto', level: 'block', report };
  if (r >= warn) return { mode: 'edit', level: 'warn', report };
  return { mode: 'edit', level: 'ok', report };
}

type Listener = (mode: Mode, decision: ModeDecision) => void;
const listeners = new Set<Listener>();
let currentMode: Mode = 'edit';
let currentDecision: ModeDecision | null = null;

export function applyDecision(d: ModeDecision): void {
  currentDecision = d;
  setMode(d.mode);
}
export function setMode(m: Mode): void {
  if (m === currentMode) return;
  currentMode = m;
  listeners.forEach(fn => currentDecision && fn(m, currentDecision));
}
export function getMode(): Mode { return currentMode; }
export function getCurrentDecision(): ModeDecision | null { return currentDecision; }
export function onModeChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function forceEditMode(): void { setMode('readonly-forced'); /* 명칭은 보존, 실제 편집 가능 플래그는 isEditable() 사용 */ }
export function isEditable(): boolean {
  return currentMode === 'edit' || currentMode === 'readonly-forced';
}
```

> 명명 보강: `readonly-forced`는 "사용자가 강제 편집을 켠 상태"를 의미. `isEditable()`이 단일 진실 원천.

#### `rhwp-studio/test/readonly-mode.test.ts`

- 임계치 경계: 0.09 → ok, 0.10 → warn, 0.29 → warn, 0.30 → block
- 모바일 임계치: 0.59 → warn, 0.60 → block
- 리스너 중복 등록 방지 / 해제 동작
- `forceEditMode()` 후 `isEditable()` true

### 검증

```bash
npm run test -- readonly-mode
```

### 승인 시점

테스트 통과 + 모드 전환 콘솔 로그 확인 후.

## 단계 3 — UI 배너 + 도구 비활성 처리 + 다이얼로그

### 목표

상태 머신을 UI에 연결한다. 배너, 다이얼로그, 도구 비활성 처리, 상태 표시줄 배지.

### 신규 파일

#### `rhwp-studio/src/ui/readonly-banner.ts`

- `<div id="readonly-banner">` 동적 삽입 (`#scroll-container` 직전)
- `level === 'warn'` → 노란 톤, 텍스트: "이 문서의 폰트 N종이 시스템에 없습니다. [자세히]"
- `level === 'block'` → 빨간 톤, 텍스트: "이 문서의 폰트 N종이 시스템에 없어 **읽기 전용**으로 표시됩니다. [자세히] [편집 강제 활성화]"
- 강제 활성화 클릭 → 모달 경고("폰트가 없는 글자는 깨져 보일 수 있습니다. 저장 시 원본이 손상될 수 있습니다.") → 확인 시 `forceEditMode()`
- `onModeChange` 리스너로 자동 갱신
- 닫기 버튼(warn 레벨에서만)

#### `rhwp-studio/src/ui/font-status-dialog.ts`

- 표 형태:
  | 폰트명 | 상태 | 치환 결과 |
  - registered → 초록 "번들 OK"
  - os → 파랑 "시스템 OK"
  - substituted → 노랑 "치환됨"
  - missing → 빨강 "누락"
- 권장 대안 컬럼 (substituted/missing에 대해 권장 폰트 표기)
- `dialog-` 접두어 CSS 사용 (CLAUDE.md UI 규약)

#### `rhwp-studio/src/styles/readonly-banner.css`

- `.readonly-banner` (warn/block 클래스로 색상 분기)
- `body[data-mode="readonly-auto"] #icon-toolbar` `pointer-events: none; opacity: 0.5;`
- `body[data-mode="readonly-auto"] #style-bar` 동일
- `body[data-mode="readonly-auto"] [data-edit-only]` 비활성

### 기존 파일 수정

#### `rhwp-studio/src/main.ts`

`initializeDocument()` 안 `loadWebFonts(...)` 직후:

```ts
const report = evaluateFontAvailability(docInfo.fontsUsed ?? []);
const decision = decideMode(report, { isMobile: isNativePlatform() });
applyDecision(decision);
mountReadonlyBanner();  // 최초 1회 (이미 마운트되었으면 noop)
```

#### `rhwp-studio/src/ui/menu-bar.ts`, `icon-toolbar.ts`, `style-bar.ts`

- 편집 항목에 `data-edit-only` 속성 부여 (오리기/복사/붙이기 제외 또는 포함은 코드 검토 후 결정 — 클립보드는 읽기 전용에서도 복사는 허용)
- `onModeChange` 구독하여 `body.dataset.mode = currentMode` 설정 (CSS가 가시성 제어)
- `inputHandler.activate()`/`deactivate()`를 모드에 따라 호출

#### `rhwp-studio/src/ui/status-bar.ts`

- "읽기 전용" 배지 토글 (`#status-bar` 우측 영역)

### 회귀 방지

- 기존 편집 기능: `body.dataset.mode === 'edit'` 또는 `isEditable() === true`일 때만 활성
- 도구상자/메뉴 항목 중 "보기" 관련(줌, 페이지 이동, 검색)은 항상 활성

### 검증

```bash
cd rhwp-studio
npm run build         # 타입 체크 + 빌드
npx vite --port 7700 &
# 수동 시각 확인:
#   1) 정상 문서 → 배너 없음
#   2) 누락 30%+ 샘플 → 빨간 배너 + 도구 회색
#   3) "편집 강제 활성화" 클릭 → 모달 → 확인 → 도구 정상색
```

### 승인 시점

데스크톱 시각 확인 (3가지 시나리오) 통과 + `npm run build` 무경고.

## 단계 4 — 통합/E2E + 모바일(Capacitor) 검증

### 목표

Puppeteer E2E로 자동 회귀 방지 + Task #1로 빌드된 Capacitor APK에서 모바일 검증.

### 신규 파일

#### `rhwp-studio/e2e/readonly-mode.test.mjs`

- 정적 http 서버 + headless Chrome
- 테스트 케이스:
  1. 정상 폰트 문서 로드 → 배너 미존재
  2. 누락 폰트 시뮬레이션 (script로 `REGISTERED_FONTS` 비우기 또는 픽스처 문서 사용) → 빨간 배너 출현 + `body[data-mode="readonly-auto"]`
  3. "편집 강제 활성화" 버튼 클릭 → 모달 → 확인 → `body[data-mode="readonly-forced"]` + 도구상자 클릭 가능
  4. 자세히 다이얼로그 → 누락 폰트 목록 표시
- 종료 시 `process.exit(0)` (기존 e2e 패턴)

### 모바일 검증 (Task #1 단계 4b 이후)

```bash
cd rhwp-studio
npm run build && npx cap sync android
cd android && ./gradlew :app:assembleDebug
# adb install + 실기기 .hwp 파일 열기 → 빨간 배너 확인
```

> 모바일 키스토어/실기기 검증은 Task #1 단계 4b·5 진행 후 통합. 본 단계에서는 코드/E2E만 자율 완료.

### 산출물

- `e2e/readonly-mode.test.mjs` (신규)
- `mydocs/manual/readonly_mode_guide.md` (신규, 사용자 가이드)
- `mydocs/working/task_m100_2_stage4.md` (단계 보고서)

### 승인 시점

E2E 4 케이스 통과 + 사용자 가이드 검토 완료.

## 단계별 의존성 그래프

```
단계1 (가용성 평가) ──┐
                      ├──► 단계3 (UI)
단계2 (모드 머신) ────┘            │
                                   └──► 단계4 (통합/E2E)
```

단계 1·2 병렬 가능하지만, 가독성을 위해 순차 진행.

## 위험 재확인

| 위험 | 단계 | 대응 |
|------|------|------|
| `getSubstitutedFontName`이 기존 치환 체계와 중복 정의 | 1 | 기존 `font-substitution.ts` 함수 재사용 (신규 export만 추가) |
| 모바일 임계치 60%가 너무 관대 | 2 | 단계 4 모바일 검증 후 조정 (수치는 코드 상수 1줄 변경) |
| 도구상자 비활성 시 클립보드 복사도 막힘 | 3 | `data-edit-only`는 변경 동작에만 부착, 복사·검색 제외 |
| E2E에서 폰트 누락 시뮬레이션 어려움 | 4 | 픽스처 문서 + `globalThis.__FORCE_MISSING_FONTS__` hook (test only) |

## 다음 단계

본 구현계획서 승인 → 단계 1 (font-availability 모듈 + 단위 테스트) 착수.

## 승인 요청

본 구현계획서 승인 + 단계 1 착수 허가 요청.
