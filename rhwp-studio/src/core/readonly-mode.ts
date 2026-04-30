/**
 * 읽기 전용 모드 상태 머신
 *
 * 폰트 가용성 보고서를 입력받아 모드를 결정하고, 외부 구독자에게 통지한다.
 * UI 결합 없음 — readonly-banner.ts / menu-bar.ts 등이 onModeChange로 구독.
 *
 * 모드 정의:
 *   edit             — 정상 편집
 *   readonly-auto    — 임계치 초과로 자동 진입한 읽기 전용
 *   readonly-forced  — 사용자가 강제 활성화한 편집 가능 상태 (경고 잔존)
 *
 * 단일 진실 원천: isEditable()
 */

import type { AvailabilityReport } from './font-availability-core';

export type Mode = 'edit' | 'readonly-auto' | 'readonly-forced';
export type Level = 'ok' | 'warn' | 'block';

export interface ModeDecision {
  mode: Mode;
  level: Level;
  report: AvailabilityReport;
  /** 모바일 임계치 적용 여부 */
  isMobile: boolean;
}

/** 임계치 (글자 수가 아닌 폰트 선언 수 기준 비율) */
export const THRESHOLDS = {
  /** 경고 배너만 (편집 허용) */
  warn: 0.10,
  /** 자동 읽기 전용 진입 (데스크톱) */
  blockDesktop: 0.30,
  /** 자동 읽기 전용 진입 (모바일 — 시스템 폰트 적어 관대) */
  blockMobile: 0.60,
} as const;

export interface DecideOptions {
  isMobile?: boolean;
}

/** 보고서 + 옵션을 모드로 결정 (순수 함수) */
export function decideMode(report: AvailabilityReport, opts: DecideOptions = {}): ModeDecision {
  const isMobile = !!opts.isMobile;
  const block = isMobile ? THRESHOLDS.blockMobile : THRESHOLDS.blockDesktop;
  const warn = THRESHOLDS.warn;
  const r = report.missingRatio;

  if (r >= block) {
    return { mode: 'readonly-auto', level: 'block', report, isMobile };
  }
  if (r >= warn) {
    return { mode: 'edit', level: 'warn', report, isMobile };
  }
  return { mode: 'edit', level: 'ok', report, isMobile };
}

// === 상태 머신 ===

type Listener = (mode: Mode, decision: ModeDecision | null) => void;

const listeners = new Set<Listener>();
let currentMode: Mode = 'edit';
let currentDecision: ModeDecision | null = null;

/** 결정 적용 — 모드 전환 시 리스너에 통지 */
export function applyDecision(d: ModeDecision): void {
  currentDecision = d;
  setMode(d.mode);
}

/** 모드 직접 설정 — 동일 모드면 noop, 변화 시에만 통지 */
export function setMode(m: Mode): void {
  if (m === currentMode) return;
  currentMode = m;
  notify();
}

/** 사용자가 "편집 강제 활성화"를 선택한 경우 */
export function forceEditMode(): void {
  if (currentMode !== 'readonly-auto') return;
  currentMode = 'readonly-forced';
  notify();
}

/** 강제 모드를 해제하고 자동 결정으로 복귀 */
export function clearForcedEdit(): void {
  if (currentMode !== 'readonly-forced') return;
  // 결정이 남아 있으면 그 결정을 다시 적용, 없으면 edit로
  if (currentDecision) {
    currentMode = currentDecision.mode;
  } else {
    currentMode = 'edit';
  }
  notify();
}

/** 상태 초기화 — 새 문서 로드 직전에 호출 */
export function resetMode(): void {
  currentMode = 'edit';
  currentDecision = null;
  notify();
}

export function getMode(): Mode {
  return currentMode;
}

export function getCurrentDecision(): ModeDecision | null {
  return currentDecision;
}

/** 편집 가능 여부 — UI는 이 값으로 활성/비활성 판단 */
export function isEditable(): boolean {
  return currentMode === 'edit' || currentMode === 'readonly-forced';
}

/** 모드 변경 구독 — 반환 함수로 구독 해제 */
export function onModeChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** 테스트용 — 모든 리스너 제거 */
export function _clearListenersForTest(): void {
  listeners.clear();
  currentMode = 'edit';
  currentDecision = null;
}

function notify(): void {
  for (const fn of listeners) {
    try {
      fn(currentMode, currentDecision);
    } catch (e) {
      console.error('[readonly-mode] listener 예외:', e);
    }
  }
}
