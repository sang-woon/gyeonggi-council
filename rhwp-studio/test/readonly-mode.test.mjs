/**
 * 읽기 전용 모드 상태 머신 단위 테스트
 *
 * 실행: npm run test:readonly-mode
 */
import {
  decideMode,
  applyDecision,
  setMode,
  forceEditMode,
  clearForcedEdit,
  resetMode,
  getMode,
  getCurrentDecision,
  isEditable,
  onModeChange,
  _clearListenersForTest,
  THRESHOLDS,
} from '../src/core/readonly-mode.ts';

let pass = 0;
let fail = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    console.error(`  FAIL  ${label}`);
    console.error(`    expected: ${e}`);
    console.error(`    actual:   ${a}`);
  }
}
function group(name, fn) {
  console.log(`\n[${name}]`);
  _clearListenersForTest();
  fn();
}

const report = (ratio) => ({
  totalCount: 10,
  availableCount: 0,
  substitutedCount: 0,
  missingCount: Math.round(ratio * 10),
  missingRatio: ratio,
  perFont: [],
});

group('데스크톱 임계치 경계 (warn=0.10, block=0.30)', () => {
  eq(decideMode(report(0.0)).level, 'ok', '0.00 → ok');
  eq(decideMode(report(0.09)).level, 'ok', '0.09 → ok');
  eq(decideMode(report(0.10)).level, 'warn', '0.10 → warn');
  eq(decideMode(report(0.29)).level, 'warn', '0.29 → warn');
  eq(decideMode(report(0.30)).level, 'block', '0.30 → block');
  eq(decideMode(report(1.0)).level, 'block', '1.00 → block');
});

group('데스크톱 모드 결정', () => {
  eq(decideMode(report(0.05)).mode, 'edit', '0.05 → edit');
  eq(decideMode(report(0.20)).mode, 'edit', '0.20 → edit (warn이지만 편집 가능)');
  eq(decideMode(report(0.50)).mode, 'readonly-auto', '0.50 → readonly-auto');
});

group('모바일 임계치 (block=0.60)', () => {
  eq(decideMode(report(0.30), { isMobile: true }).level, 'warn', '모바일 0.30 → warn (블록 아님)');
  eq(decideMode(report(0.59), { isMobile: true }).level, 'warn', '모바일 0.59 → warn');
  eq(decideMode(report(0.60), { isMobile: true }).level, 'block', '모바일 0.60 → block');
  eq(decideMode(report(0.60), { isMobile: true }).mode, 'readonly-auto', '모바일 0.60 → readonly-auto');
});

group('isMobile 플래그 전파', () => {
  eq(decideMode(report(0.5), { isMobile: true }).isMobile, true, 'isMobile=true 전파');
  eq(decideMode(report(0.5)).isMobile, false, '기본 isMobile=false');
});

group('상수 export', () => {
  eq(THRESHOLDS.warn, 0.10, 'warn 임계치 0.10');
  eq(THRESHOLDS.blockDesktop, 0.30, '데스크톱 블록 0.30');
  eq(THRESHOLDS.blockMobile, 0.60, '모바일 블록 0.60');
});

group('applyDecision + getMode + getCurrentDecision', () => {
  resetMode();
  const d = decideMode(report(0.5));
  applyDecision(d);
  eq(getMode(), 'readonly-auto', '0.5 → readonly-auto 진입');
  eq(getCurrentDecision()?.level, 'block', 'currentDecision 보존');
  eq(isEditable(), false, '읽기 전용 → isEditable false');
});

group('forceEditMode', () => {
  resetMode();
  applyDecision(decideMode(report(0.5)));
  forceEditMode();
  eq(getMode(), 'readonly-forced', '강제 활성화 후 readonly-forced');
  eq(isEditable(), true, '강제 활성화 후 isEditable true');
});

group('forceEditMode는 readonly-auto에서만 동작', () => {
  resetMode();
  // edit 상태에서 forceEditMode 호출해도 모드 안 바뀜
  forceEditMode();
  eq(getMode(), 'edit', 'edit 상태에서 forceEditMode 호출 무시');
});

group('clearForcedEdit — 자동 결정으로 복귀', () => {
  resetMode();
  applyDecision(decideMode(report(0.5)));
  forceEditMode();
  eq(getMode(), 'readonly-forced', '강제 모드 진입');
  clearForcedEdit();
  eq(getMode(), 'readonly-auto', '강제 해제 후 자동 결정 복귀');
  eq(isEditable(), false, '복귀 후 isEditable false');
});

group('resetMode — 모든 상태 초기화', () => {
  applyDecision(decideMode(report(0.5)));
  resetMode();
  eq(getMode(), 'edit', 'reset 후 edit');
  eq(getCurrentDecision(), null, 'reset 후 결정 null');
});

group('onModeChange 리스너 호출', () => {
  resetMode();
  const calls = [];
  const off = onModeChange((mode) => calls.push(mode));
  applyDecision(decideMode(report(0.5)));
  eq(calls, ['readonly-auto'], '결정 적용 시 리스너 호출');
  forceEditMode();
  eq(calls, ['readonly-auto', 'readonly-forced'], '강제 활성화 시 리스너 호출');
  off();
  applyDecision(decideMode(report(0.0)));
  eq(calls.length, 2, '구독 해제 후 추가 호출 없음');
});

group('동일 모드 재적용 시 리스너 호출 안 됨', () => {
  resetMode();
  const calls = [];
  onModeChange((mode) => calls.push(mode));
  setMode('edit'); // 이미 edit
  eq(calls, [], '동일 모드는 noop');
  setMode('readonly-auto');
  setMode('readonly-auto');
  eq(calls, ['readonly-auto'], '같은 모드 두 번 → 한 번만 통지');
});

group('isEditable 진실값 표', () => {
  resetMode();
  eq(isEditable(), true, 'edit → editable');
  setMode('readonly-auto');
  eq(isEditable(), false, 'readonly-auto → not editable');
  setMode('readonly-forced');
  eq(isEditable(), true, 'readonly-forced → editable');
});

group('리스너 예외 시 다른 리스너 진행', () => {
  resetMode();
  const calls = [];
  onModeChange(() => { throw new Error('테스트 예외'); });
  onModeChange((m) => calls.push(m));
  // console.error 잠시 무음
  const orig = console.error;
  console.error = () => {};
  applyDecision(decideMode(report(0.5)));
  console.error = orig;
  eq(calls, ['readonly-auto'], '예외 후에도 다음 리스너 진행');
});

console.log(`\n결과: ${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
