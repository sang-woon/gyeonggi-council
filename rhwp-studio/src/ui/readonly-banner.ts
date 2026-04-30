/**
 * 읽기 전용 모드 배너 (#editor-area 상단 부착)
 *
 * 모드 변화에 반응하여 표시/숨김:
 *   level=ok           → 숨김
 *   level=warn         → 노란 배너 (편집 허용)
 *   level=block (auto) → 빨간 배너 (자동 읽기 전용 진입, 편집 강제 활성화 버튼)
 *   readonly-forced    → 빨간 경고 배너 잔존 (사용자가 강제 편집 중임을 시각적으로 인지)
 */

import {
  onModeChange,
  forceEditMode,
  clearForcedEdit,
  getMode,
  getCurrentDecision,
  type Mode,
  type ModeDecision,
} from '@/core/readonly-mode';
import { showConfirm } from './confirm-dialog';
import { showFontStatusDialog } from './font-status-dialog';

const BANNER_ID = 'rhwp-readonly-banner';

let mounted = false;
let unsubscribe: (() => void) | null = null;

export function mountReadonlyBanner(): void {
  if (mounted) return;
  mounted = true;

  unsubscribe = onModeChange((mode, decision) => {
    render(mode, decision);
  });

  // 초기 렌더 (이미 결정이 있을 수 있음)
  render(getMode(), getCurrentDecision());
}

export function unmountReadonlyBanner(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  document.getElementById(BANNER_ID)?.remove();
  mounted = false;
}

function render(mode: Mode, decision: ModeDecision | null): void {
  // body data-mode 속성 (CSS가 도구 비활성 처리)
  document.body.dataset.mode = mode;

  const editorArea = document.getElementById('editor-area');
  if (!editorArea) return;

  // ok 레벨 + edit 모드는 배너 숨김
  if (!decision || (decision.level === 'ok' && mode === 'edit')) {
    document.getElementById(BANNER_ID)?.remove();
    return;
  }

  let banner = document.getElementById(BANNER_ID) as HTMLDivElement | null;
  if (!banner) {
    banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.className = 'readonly-banner';
    editorArea.parentElement?.insertBefore(banner, editorArea);
  }

  const missing = decision.report.missingCount;
  const total = decision.report.totalCount;
  const ratio = Math.round(decision.report.missingRatio * 100);

  banner.classList.remove('readonly-banner--warn', 'readonly-banner--block');

  if (mode === 'readonly-auto') {
    banner.classList.add('readonly-banner--block');
    banner.innerHTML = `
      <div class="readonly-banner__icon" aria-hidden="true">⚠</div>
      <div class="readonly-banner__text">
        <strong>읽기 전용</strong> — 이 문서의 폰트 ${missing}/${total}종(${ratio}%)이 시스템에 없어 글자가 다르게 보일 수 있습니다.
      </div>
      <div class="readonly-banner__actions">
        <button class="readonly-banner__btn readonly-banner__btn--detail" type="button">자세히</button>
        <button class="readonly-banner__btn readonly-banner__btn--force" type="button">편집 강제 활성화</button>
      </div>`;
  } else if (mode === 'readonly-forced') {
    banner.classList.add('readonly-banner--block');
    banner.innerHTML = `
      <div class="readonly-banner__icon" aria-hidden="true">⚠</div>
      <div class="readonly-banner__text">
        <strong>강제 편집 중</strong> — 폰트 ${missing}/${total}종(${ratio}%) 누락. 저장 시 원본 폰트가 손상될 수 있습니다.
      </div>
      <div class="readonly-banner__actions">
        <button class="readonly-banner__btn readonly-banner__btn--detail" type="button">자세히</button>
        <button class="readonly-banner__btn readonly-banner__btn--restore" type="button">읽기 전용으로</button>
      </div>`;
  } else {
    // edit + warn
    banner.classList.add('readonly-banner--warn');
    banner.innerHTML = `
      <div class="readonly-banner__icon" aria-hidden="true">ⓘ</div>
      <div class="readonly-banner__text">
        이 문서의 폰트 ${missing}/${total}종(${ratio}%)이 시스템에 없습니다. 일부 글자 모양이 다를 수 있습니다.
      </div>
      <div class="readonly-banner__actions">
        <button class="readonly-banner__btn readonly-banner__btn--detail" type="button">자세히</button>
        <button class="readonly-banner__btn readonly-banner__btn--close" type="button" aria-label="닫기">×</button>
      </div>`;
  }

  // 이벤트 바인딩 (innerHTML 재생성마다 새로 부착)
  banner.querySelector<HTMLButtonElement>('.readonly-banner__btn--detail')
    ?.addEventListener('click', () => {
      const d = getCurrentDecision();
      if (d) showFontStatusDialog(d.report);
    });

  banner.querySelector<HTMLButtonElement>('.readonly-banner__btn--force')
    ?.addEventListener('click', async () => {
      const ok = await showConfirm(
        '편집 강제 활성화',
        '폰트가 없는 글자는 다르게 보일 수 있고, 저장 시 원본 문서가 손상될 위험이 있습니다.\n\n그래도 편집을 진행하시겠습니까?',
      );
      if (ok) forceEditMode();
    });

  banner.querySelector<HTMLButtonElement>('.readonly-banner__btn--restore')
    ?.addEventListener('click', () => {
      clearForcedEdit();
    });

  banner.querySelector<HTMLButtonElement>('.readonly-banner__btn--close')
    ?.addEventListener('click', () => {
      banner?.remove();
    });
}
