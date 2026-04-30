/**
 * 폰트 가용성 평가 모듈 단위 테스트
 *
 * Node 24의 --experimental-strip-types로 실행:
 *   node --experimental-strip-types rhwp-studio/test/font-availability.test.mjs
 *
 * 또는 npm script:
 *   npm run test:unit
 */
import { evaluateFontAvailabilityWith } from '../src/core/font-availability-core.ts';

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
function near(actual, expected, eps, label) {
  if (Math.abs(actual - expected) <= eps) {
    pass++;
    console.log(`  PASS  ${label}`);
  } else {
    fail++;
    console.error(`  FAIL  ${label}: expected≈${expected}, actual=${actual}`);
  }
}
function group(name, fn) {
  console.log(`\n[${name}]`);
  fn();
}

const REGISTERED = new Set(['함초롬바탕', '함초롬돋움', 'Pretendard']);
const OS = new Set(['맑은 고딕', 'Apple SD Gothic Neo']);
const SUBST_MAP = new Map([
  ['한컴바탕', '함초롬바탕'],
  ['한컴돋움', '함초롬돋움'],
  ['Malgun Gothic', '맑은 고딕'],
]);
const deps = {
  isRegistered: (n) => REGISTERED.has(n),
  isOsFont: (n) => OS.has(n),
  substitute: (n) => SUBST_MAP.get(n),
};

group('빈 입력', () => {
  const r = evaluateFontAvailabilityWith([], deps);
  eq(r.totalCount, 0, '총 폰트 수 0');
  eq(r.missingRatio, 0, '비율 0');
  eq(r.perFont, [], 'perFont 빈 배열');
});

group('전부 registered', () => {
  const r = evaluateFontAvailabilityWith(['함초롬바탕', '함초롬돋움', 'Pretendard'], deps);
  eq(r.totalCount, 3, '총 3개');
  eq(r.availableCount, 3, '가용 3개');
  eq(r.missingCount, 0, '누락 0');
  eq(r.missingRatio, 0, '비율 0');
});

group('전부 OS 폰트', () => {
  const r = evaluateFontAvailabilityWith(['맑은 고딕', 'Apple SD Gothic Neo'], deps);
  eq(r.availableCount, 2, '가용 2개');
  eq(r.missingCount, 0, '누락 0');
  eq(r.perFont.map((f) => f.availability), ['os', 'os'], '모두 os 분류');
});

group('치환 가능', () => {
  const r = evaluateFontAvailabilityWith(['한컴바탕', 'Malgun Gothic'], deps);
  eq(r.substitutedCount, 2, '치환 2개');
  eq(r.missingCount, 0, '누락 0');
  eq(r.perFont[0].availability, 'substituted', '한컴바탕 → substituted');
  eq(r.perFont[0].resolvedTo, '함초롬바탕', '한컴바탕 → 함초롬바탕');
  eq(r.perFont[1].resolvedTo, '맑은 고딕', 'Malgun Gothic → 맑은 고딕');
});

group('전부 missing', () => {
  const r = evaluateFontAvailabilityWith(['UnknownFont1', 'UnknownFont2'], deps);
  eq(r.missingCount, 2, '누락 2개');
  eq(r.missingRatio, 1, '비율 1.0');
  eq(r.perFont.every((f) => f.availability === 'missing'), true, '모두 missing');
});

group('50% missing', () => {
  const r = evaluateFontAvailabilityWith(
    ['함초롬바탕', '함초롬돋움', 'UnknownA', 'UnknownB'],
    deps,
  );
  eq(r.totalCount, 4, '총 4개');
  eq(r.missingCount, 2, '누락 2개');
  near(r.missingRatio, 0.5, 1e-9, '비율 0.5');
});

group('33% missing (10건 중 3건)', () => {
  const fonts = [
    '함초롬바탕', '함초롬돋움', 'Pretendard',          // registered
    '맑은 고딕', 'Apple SD Gothic Neo',                  // os
    '한컴바탕', 'Malgun Gothic',                          // substituted
    'UnknownA', 'UnknownB', 'UnknownC',                   // missing
  ];
  const r = evaluateFontAvailabilityWith(fonts, deps);
  eq(r.totalCount, 10, '총 10개');
  eq(r.availableCount, 5, 'registered+os 5개');
  eq(r.substitutedCount, 2, '치환 2개');
  eq(r.missingCount, 3, '누락 3개');
  near(r.missingRatio, 0.3, 1e-9, '비율 0.3');
});

group('빈 문자열·undefined·공백 정리', () => {
  const r = evaluateFontAvailabilityWith(['함초롬바탕', '', '   ', undefined], deps);
  eq(r.totalCount, 1, '빈 항목은 제외되어 총 1개');
  eq(r.missingCount, 0, '누락 0');
});

group('치환 결과가 미설치 폰트면 missing', () => {
  const odd = {
    isRegistered: (n) => false,
    isOsFont: (n) => false,
    substitute: (n) => '존재하지않는치환결과',
  };
  const r = evaluateFontAvailabilityWith(['SomeFont'], odd);
  eq(r.missingCount, 1, '치환했어도 결과가 미설치면 missing');
  eq(r.perFont[0].availability, 'missing', 'availability=missing');
});

group('대소문자 구분 (정책: 입력 그대로)', () => {
  const r = evaluateFontAvailabilityWith(['pretendard', 'Pretendard'], deps);
  eq(r.perFont[0].availability, 'missing', 'pretendard ≠ Pretendard');
  eq(r.perFont[1].availability, 'registered', 'Pretendard 일치');
});

console.log(`\n결과: ${pass} pass / ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
