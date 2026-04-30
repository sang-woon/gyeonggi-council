# Task #2 단계 3 완료보고서 — UI 배너 + 자세히 다이얼로그 + 도구 비활성

## 상태

🟢 **단계 3 완료**

## 산출물

| 파일 | 종류 | 비고 |
|------|------|------|
| `rhwp-studio/src/ui/readonly-banner.ts` | 신규 | 모드 반응형 상단 배너 (warn/block 분기) |
| `rhwp-studio/src/ui/font-status-dialog.ts` | 신규 | 폰트별 가용성 표 다이얼로그 |
| `rhwp-studio/src/styles/readonly-banner.css` | 신규 | 배너 스타일 + 도구 비활성 CSS |
| `rhwp-studio/src/main.ts` | 수정 | initializeDocument 통합 + InputHandler 동기화 |

## 동작 흐름

```
문서 로드 (initializeDocument)
  → resetMode()                                 // 이전 문서 모드 초기화
  → loadWebFonts()
  → evaluateFontAvailability(fontsUsed)         // 단계 1
  → decideMode(report, { isMobile })            // 단계 2
  → applyDecision(decision)                     // 단계 2
  → mountReadonlyBanner()                       // 1회만 마운트, 이후 onModeChange로 자동 갱신
  ↓
onModeChange 통지
  ├─ readonly-banner: body.dataset.mode 갱신 + 배너 렌더
  └─ main.ts: InputHandler activate/deactivate
```

## 모바일 감지 정책

Task #1의 `platform.ts`가 `local/devel`에 미머지 상태이므로 인라인 감지:

```ts
function isMobileLike(): boolean {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (cap?.isNativePlatform?.()) return true;
  return window.innerWidth < 768;
}
```

Task #1과 머지 시 `platform.ts`의 `isNativePlatform()`으로 통일 예정.

## UI 시안

### warn 레벨 (10% ≤ 누락 < 30%)

```
┌─────────────────────────────────────────────────────────────────┐
│ ⓘ  이 문서의 폰트 2/10종(20%)이 시스템에 없습니다.    [자세히] [×] │
└─────────────────────────────────────────────────────────────────┘
```

노란 톤. 편집 가능. 사용자가 닫기 클릭하면 사라짐.

### block 레벨 (≥ 30% 또는 모바일 ≥ 60%)

```
┌──────────────────────────────────────────────────────────────────────────┐
│ ⚠  읽기 전용 — 폰트 5/10종(50%) 누락... [자세히] [편집 강제 활성화] │
└──────────────────────────────────────────────────────────────────────────┘
```

빨간 톤. 도구 상자/서식 도구 회색 처리. 캐럿 숨김.

### readonly-forced (사용자가 강제 활성화)

```
┌───────────────────────────────────────────────────────────────────────┐
│ ⚠  강제 편집 중 — 폰트 5/10종(50%) 누락. 저장 시 손상 가능. [자세히] [읽기 전용으로] │
└───────────────────────────────────────────────────────────────────────┘
```

빨간 톤 유지(시각 경고). 도구 활성화. 캐럿 표시.

### 자세히 다이얼로그

| 폰트명 | 상태 | 치환 결과 |
|--------|------|----------|
| 함초롬바탕 | 🟢 번들 OK | |
| 맑은 고딕 | 🔵 시스템 OK | |
| 한컴바탕 | 🟡 치환됨 | 함초롬바탕 |
| HY신명조 | 🔴 누락 | |

누락→치환→OS→번들 순으로 정렬.

## 도구 비활성 처리 (CSS만으로)

```css
body[data-mode="readonly-auto"] #icon-toolbar,
body[data-mode="readonly-auto"] #style-bar {
  pointer-events: none;
  opacity: 0.45;
  filter: grayscale(0.5);
}
body[data-mode="readonly-auto"] #scroll-container { caret-color: transparent; }
```

- `pointer-events: none` → 마우스 클릭 차단
- `opacity 0.45 + grayscale` → 시각적으로 비활성 표시
- 캐럿은 InputHandler.deactivate()로도 숨겨지지만, 시각 일관성을 위해 CSS도 적용

## InputHandler 동기화

```ts
onModeChange(() => {
  if (!inputHandler) return;
  if (isEditable()) {
    if (!inputHandler.active) inputHandler.activateWithCaretPosition();
  } else {
    inputHandler.deactivate();
  }
});
```

- `readonly-auto` 진입 → deactivate (캐럿 숨김 + 키보드 입력 차단)
- `readonly-forced` 전환 → activateWithCaretPosition (편집 복귀)

## 상태 표시줄 배지

```css
body[data-mode="readonly-auto"] #sb-mode::before  { content: '읽기 전용'; ... }
body[data-mode="readonly-forced"] #sb-mode::before { content: '강제 편집'; ... }
```

`#sb-mode`("삽입") 좌측에 inline 배지 추가. 모드 전환 시 즉시 반영.

## 빌드 검증

```bash
$ npm run test:unit
[font-availability]   결과: 32 pass / 0 fail
[readonly-mode]       결과: 38 pass / 0 fail
누계: 70 pass / 0 fail

$ npx tsc --noEmit
(no errors)

$ npm run build
✓ built in 5.14s
PWA precache 17 entries (1674.20 KiB)
```

## 회귀 위험 점검

| 위험 | 결과 |
|------|------|
| 기존 편집 기능 회귀 | InputHandler `active` 플래그가 기존 deactivate/activate 로직 그대로 사용. `isEditable()`이 true일 때만 활성화하므로 기존 흐름과 동일 |
| 새 문서 생성 시 모드 영향 | `resetMode()`로 매번 초기화. 새 문서 `fontsUsed=[]` → `missingRatio=0` → mode=edit, level=ok → 배너 미표시 |
| 모달/대화상자 z-index 충돌 | 배너는 `#editor-area` 형제로 삽입되어 모달 오버레이(z-index ≥ 10000)보다 항상 아래 |
| 폰트 평가 실패 시 앱 중단 | try/catch로 감싸 "치명적이지 않음" 로그만 출력하고 진행 |

## 다음 단계

**단계 4** — E2E 테스트 + 통합 검증.
- Puppeteer E2E로 4 시나리오 (정상/warn/block/forced)
- 모바일 검증은 Task #1 단계 4b 머지 후 실기기에서 통합 테스트

## 승인 요청

본 단계 3 완료 보고 승인 + 단계 4 착수 허가 요청.
