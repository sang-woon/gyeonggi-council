# Task #2 단계 4 완료보고서 — E2E 테스트 + 통합 검증

## 상태

🟢 **단계 4 완료 (자율 부분 전부)**
🟡 **모바일 실기기 통합 검증**은 Task #1 단계 4b 머지 후 통합 테스트로 진행

## 산출물

| 파일 | 종류 |
|------|------|
| `rhwp-studio/e2e/readonly-mode.test.mjs` | 신규 (Puppeteer E2E) |
| `rhwp-studio/src/main.ts` | 수정 (DEV 모드 모듈 노출 + 사전 마운트) |
| `rhwp-studio/src/core/readonly-mode.ts` | 수정 (applyDecision 항상 notify) |
| `rhwp-studio/package.json` | 수정 (e2e:readonly-mode 스크립트) |
| `mydocs/manual/readonly_mode_guide.md` | 신규 (사용자 가이드) |

## 발견·수정한 버그

### applyDecision의 미통지 케이스

`applyDecision`이 모드는 그대로지만 level만 변할 때(예: `ok` → `warn`), `setMode()` 의 noop 분기로 인해 리스너에 통지되지 않아 배너가 갱신되지 않았다.

**수정**: `applyDecision`은 결정이 갱신되면 항상 통지하도록 변경. `setMode`의 동일-모드 noop 의미는 보존.

```ts
export function applyDecision(d: ModeDecision): void {
  currentDecision = d;
  if (d.mode !== currentMode) currentMode = d.mode;
  notify();  // 항상 통지
}
```

단위 테스트는 `setMode` 기반이라 영향 없음 (38/38 통과 유지).

### 모듈 인스턴스 분리 이슈

E2E에서 `import('/src/core/readonly-mode.ts')`(테스트)와 `@/core/readonly-mode`(main.ts) 가 별도 인스턴스로 평가되어 상태가 분리됨. 

**수정**: main.ts에서 `import.meta.env.DEV` 분기로 `@/` 경로 임포트 결과를 `window.__readonly` / `window.__banner`로 노출 + 사전 mountReadonlyBanner 호출. E2E는 같은 인스턴스 사용.

## E2E 테스트 결과

```
$ npm run e2e:readonly-mode

[시나리오 1] ok 레벨 (누락 0%)
  PASS  ok → 배너 미존재
  PASS  body[data-mode=edit]

[시나리오 2] warn 레벨 (누락 20%)
  PASS  warn → 배너 존재
  PASS  warn 클래스 적용
  PASS  warn에서도 body[data-mode=edit]

[시나리오 3] block 레벨 (누락 50%)
  PASS  block 클래스 적용
  PASS  body[data-mode=readonly-auto]
  PASS  icon-toolbar pointer-events: none
  PASS  style-bar pointer-events: none
  PASS  자세히 버튼 존재
  PASS  편집 강제 활성화 버튼 존재

[시나리오 4] forceEditMode (사용자 강제 활성화)
  PASS  body[data-mode=readonly-forced]
  PASS  forced에서도 block 클래스 (시각 경고)
  PASS  읽기 전용으로 복귀 버튼 존재
  PASS  강제 편집에서 icon-toolbar 활성

[시나리오 5] clearForcedEdit (읽기 전용 복귀)
  PASS  clearForcedEdit 후 body[data-mode=readonly-auto]

[시나리오 6] 자세히 다이얼로그
  PASS  ModalDialog 표시
  PASS  다이얼로그 제목 "폰트 가용성"

결과: 18 pass / 0 fail
```

E2E 환경:
- Vite dev server (localhost:7711, 자동 spawn/kill)
- Chrome 자동 탐지 (`C:\Program Files\Google\Chrome\Application\chrome.exe`)
- headless='new'

## 누계 검증

```
단위 (font-availability)   : 32 pass
단위 (readonly-mode)       : 38 pass
E2E  (readonly-mode)       : 18 pass
─────────────────────────────────────
                       합계 88 pass / 0 fail

tsc --noEmit               : 무경고
npm run build              : 성공 (PWA precache 17 entries / 1674 KiB)
```

## 모바일 통합 검증 (대기)

Task #1 단계 4b/5 머지 후 진행:
- Capacitor APK 빌드 → 실 안드로이드 폰 설치
- 누락률 60% 이상 .hwp 파일 → 빨간 배너 표시 확인
- 강제 편집 → 토큰 입력 → 저장 → PC에서 재오픈 시 손상 정도 평가

## Task #1 머지 시 주의사항

본 타스크에서 main.ts에 `isMobileLike()` 인라인 헬퍼를 추가했으나, Task #1은 `src/core/platform.ts`의 `isNativePlatform()`을 사용. **머지 후 `isMobileLike()`를 `isNativePlatform()` 기반으로 통일**해야 함.

```ts
// 머지 후 권장
import { isNativePlatform } from '@/core/platform';
function isMobileLike() {
  return isNativePlatform() || window.innerWidth < 768;
}
```

## 사용자 가이드

`mydocs/manual/readonly_mode_guide.md` 신규 작성:
- 모드 4종 (일반/경고/자동 읽기 전용/강제 편집) 설명
- 임계치 데스크톱·모바일 차이
- 자세히 다이얼로그 상태 색상 (🟢🔵🟡🔴)
- FAQ (영구 비활성, 치환 정확도, 강제 편집 안전성)

## Play Store 배포 영향

| 항목 | 영향 |
|------|------|
| AAB 빌드 | 영향 없음 (코드 추가만) |
| Play Console 데이터 안전 | 영향 없음 (수집 없음) |
| 권한 변경 | 없음 |
| 사용자 가이드 | `readonly_mode_guide.md` 추가 → Play Store 등록 시 도움말 링크 또는 앱 내 도움말 메뉴에 포함 가능 |

특히 **모바일에서 폰트 누락이 잦은 점을 고려**한 본 기능은 Play Store 출시 시 사용자 데이터 손상을 방지하는 핵심 안전 장치.

## 다음 단계

**최종 결과 보고서 (`task_m100_2_report.md`)** 작성 후 Task #2 종료. 이후:

1. `local/task2` → `local/devel` 머지 (Task #1과 충돌 해소 — `isMobileLike` 통일)
2. Task #1 단계 4b·5 (작업지시자 작업) 진행
3. Play Store 배포 시 본 모듈 동작 모바일 검증

## 승인 요청

본 단계 4 완료 보고 승인 + 최종 결과보고서 작성 + 머지 절차 합의 요청.
