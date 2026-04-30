/**
 * 폰트 가용성 평가 — 런타임 엔트리
 *
 * 실제 font-loader/font-substitution 의존성을 주입하여
 * 순수 코어(font-availability-core.ts)를 호출한다.
 */

import { REGISTERED_FONTS, getDetectedOSFonts } from './font-loader';
import { resolveFont } from './font-substitution';
import {
  evaluateFontAvailabilityWith,
  type AvailabilityReport,
} from './font-availability-core';

export type {
  FontAvailability,
  FontStatus,
  AvailabilityReport,
  AvailabilityDeps,
} from './font-availability-core';
export { evaluateFontAvailabilityWith } from './font-availability-core';

/** 실제 의존성을 자동 주입하는 표준 진입점 */
export function evaluateFontAvailability(fontsUsed: readonly string[]): AvailabilityReport {
  return evaluateFontAvailabilityWith(fontsUsed, {
    isRegistered: (n) => REGISTERED_FONTS.has(n),
    isOsFont: (n) => getDetectedOSFonts().has(n),
    substitute: (n) => {
      // 한국어(0) + altType 자동(0)으로 시도. 결과가 입력과 같으면 치환 없음.
      const r = resolveFont(n, 0, 0);
      return r && r !== n ? r : undefined;
    },
  });
}
