// Wasiyyah Konvensyen award categories — pure functions, used by the
// printable report card. Real thresholds from Wasiyyah's own category list
// (financial year Jul 2025 – Dec 2026, an 18-month period due to a
// financial-year readjustment). Hibah Round Table and Perlantikan Round
// Table are deliberately NOT modeled here — the app has no Hibah sales
// category and no recruitment-appointment count, so showing a number for
// either would be a guess, not a fact.

export const KONVENSYEN_PERIOD = { start: "2025-07-01", end: "2026-12-31" } as const;
export const ROOKIE_WINDOW = { start: "2025-05-01", end: "2026-10-31" } as const;

export const KONVENSYEN_TARGETS = {
  alWasitahKes: 40,
  pusakaAmount: 30_000,
  rookieAlWasitahKes: 25,
  rookiePerancangan: 60_000,
} as const;

export function isWithinKonvensyenPeriod(dateIso: string): boolean {
  return dateIso >= KONVENSYEN_PERIOD.start && dateIso <= KONVENSYEN_PERIOD.end;
}

/** A daie counts as a "rookie" for Rookie Terbaik if they were licensed within the registration window. */
export function isRookieEligible(dateLicensed: string | null): boolean {
  return dateLicensed != null && dateLicensed >= ROOKIE_WINDOW.start && dateLicensed <= ROOKIE_WINDOW.end;
}

export interface KonvensyenCriterion {
  label: string;
  value: number;
  target: number;
  met: boolean;
}

export function computeKonvensyenProgress(params: {
  alWasitahKesInPeriod: number;
  pusakaAmountInPeriod: number;
  perancanganInPeriod: number;
  rookieEligible: boolean;
}): KonvensyenCriterion[] {
  const { alWasitahKesInPeriod, pusakaAmountInPeriod, perancanganInPeriod, rookieEligible } = params;

  const criteria: KonvensyenCriterion[] = [
    { label: "Al-Wasitah RT", value: alWasitahKesInPeriod, target: KONVENSYEN_TARGETS.alWasitahKes, met: alWasitahKesInPeriod >= KONVENSYEN_TARGETS.alWasitahKes },
    { label: "Pusaka RT", value: pusakaAmountInPeriod, target: KONVENSYEN_TARGETS.pusakaAmount, met: pusakaAmountInPeriod >= KONVENSYEN_TARGETS.pusakaAmount },
  ];

  if (rookieEligible) {
    criteria.push(
      { label: "Rookie Al-Wasitah", value: alWasitahKesInPeriod, target: KONVENSYEN_TARGETS.rookieAlWasitahKes, met: alWasitahKesInPeriod >= KONVENSYEN_TARGETS.rookieAlWasitahKes },
      { label: "Rookie Perancangan", value: perancanganInPeriod, target: KONVENSYEN_TARGETS.rookiePerancangan, met: perancanganInPeriod >= KONVENSYEN_TARGETS.rookiePerancangan },
    );
  }

  return criteria;
}
