/**
 * 폰트 가용성 평가 — 순수 코어 (의존성 없음)
 *
 * Node 단위 테스트가 가능하도록 font-loader/substitution import를 분리.
 * 런타임 진입점은 font-availability.ts에서 실제 deps를 주입하여 사용.
 */

export type FontAvailability = 'registered' | 'os' | 'substituted' | 'missing';

export interface FontStatus {
  name: string;
  availability: FontAvailability;
  resolvedTo?: string;
}

export interface AvailabilityReport {
  totalCount: number;
  availableCount: number;     // registered + os
  substitutedCount: number;
  missingCount: number;
  /** missingCount / totalCount (0 if total === 0) */
  missingRatio: number;
  perFont: FontStatus[];
}

export interface AvailabilityDeps {
  isRegistered: (name: string) => boolean;
  isOsFont: (name: string) => boolean;
  /** 치환 결과가 입력과 다르면 그 폰트명을, 같으면 undefined 반환 */
  substitute: (name: string) => string | undefined;
}

/** 순수 함수 — 의존성 주입 형태 */
export function evaluateFontAvailabilityWith(
  fontsUsed: readonly (string | undefined | null)[],
  deps: AvailabilityDeps,
): AvailabilityReport {
  const perFont: FontStatus[] = [];
  let avail = 0;
  let sub = 0;
  let miss = 0;

  for (const raw of fontsUsed) {
    const name = (raw ?? '').trim();
    if (!name) continue;

    if (deps.isRegistered(name)) {
      perFont.push({ name, availability: 'registered' });
      avail++;
      continue;
    }
    if (deps.isOsFont(name)) {
      perFont.push({ name, availability: 'os' });
      avail++;
      continue;
    }

    const resolved = deps.substitute(name);
    if (resolved && (deps.isRegistered(resolved) || deps.isOsFont(resolved))) {
      perFont.push({ name, availability: 'substituted', resolvedTo: resolved });
      sub++;
      continue;
    }

    perFont.push({ name, availability: 'missing' });
    miss++;
  }

  const total = perFont.length;
  return {
    totalCount: total,
    availableCount: avail,
    substitutedCount: sub,
    missingCount: miss,
    missingRatio: total === 0 ? 0 : miss / total,
    perFont,
  };
}
