// Wasiyyah Konvensyen award categories — pure functions, used by the
// printable report card and the Team Report. Real thresholds from
// Wasiyyah's own category list (financial year Jul 2025 – Dec 2026, an
// 18-month period due to a financial-year readjustment). Perlantikan Round
// Table is deliberately NOT modeled here — the app has no
// recruitment-appointment count, so showing a number would be a guess, not
// a fact.

export const KONVENSYEN_PERIOD = { start: "2025-07-01", end: "2026-12-31" } as const;
export const ROOKIE_WINDOW = { start: "2025-05-01", end: "2026-10-31" } as const;

/** Kausar Group FY25/26 Perancangan target (group only — no unit targets), from the official FY sales update of 16 Nov 2026. */
export const FY_GROUP_TARGET = 20_909_436.11;

export const KONVENSYEN_TARGETS = {
  alWasitahKes: 40,
  pusakaAmount: 30_000,
  rookieAlWasitahKes: 25,
  rookiePerancangan: 60_000,
} as const;

/**
 * Hibah Round Table is a SINGLE tiered award, not four stacking ones — a daie who clears RM500k qualifies for the HRT500k tier only, not HRT100k + HRT300k + HRT500k as well.
 * Measured on TOTAL Perancangan in the period, as the Konvensyen sheet does (its HRT100K–600K columns are against JUMLAH) — agreed 2026-11-16.
 */
export const HIBAH_TIERS = [100_000, 300_000, 500_000, 600_000] as const;

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
  /** Only set for tiered awards (Hibah RT) — e.g. "Qualifies for RM500k tier" or "No tier reached yet". */
  tierLabel?: string;
}

function computeHibahCriterion(perancanganInPeriod: number): KonvensyenCriterion {
  const achieved = [...HIBAH_TIERS].reverse().find((tier) => perancanganInPeriod >= tier) ?? null;
  const maxTier = HIBAH_TIERS[HIBAH_TIERS.length - 1];
  const nextTier = HIBAH_TIERS.find((tier) => perancanganInPeriod < tier) ?? maxTier;

  return {
    label: "Hibah RT",
    value: perancanganInPeriod,
    target: nextTier,
    met: achieved !== null,
    tierLabel: achieved !== null ? `Qualifies for RM${(achieved / 1000).toLocaleString()}k tier` : "No tier reached yet",
  };
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
    computeHibahCriterion(perancanganInPeriod),
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

/** Award progress straight from a daie's sale entries (only those inside the Konvensyen period count). */
export function konvensyenFromSales(
  entries: Array<{ date: string; category: string; amount: number | null; count: number | null }>,
  dateLicensed: string | null,
): KonvensyenCriterion[] {
  const inPeriod = entries.filter((e) => isWithinKonvensyenPeriod(e.date));
  const sum = (category: string, field: "amount" | "count") => inPeriod.filter((e) => e.category === category).reduce((s, e) => s + (e[field] ?? 0), 0);
  return computeKonvensyenProgress({
    alWasitahKesInPeriod: sum("pengurusan", "count"),
    pusakaAmountInPeriod: sum("kesPusaka", "amount"),
    perancanganInPeriod: sum("perancangan", "amount"),
    rookieEligible: isRookieEligible(dateLicensed),
  });
}

/** One daie's award progress for the Konvensyen & FY report. */
export interface KonvensyenRow {
  uid: string;
  name: string;
  daieId: string;
  rank: "KDE" | "DPM" | "DM";
  unitId: string;
  konvensyen: KonvensyenCriterion[];
}

/** The Hibah RT tier a total reaches (highest tier at or below it), or null. */
export function hibahTier(perancanganInPeriod: number): number | null {
  return [...HIBAH_TIERS].reverse().find((tier) => perancanganInPeriod >= tier) ?? null;
}

export interface AwardSummary {
  people: number;
  /** Daie at each HRT tier (by highest tier reached). */
  hrtByTier: Record<number, number>;
  hrt: number;
  alWasitah: number;
  pusaka: number;
  rookieEligible: number;
  rookieAlWasitah: number;
  rookiePerancangan: number;
}

/** Qualifier counts per award across a set of daie (each entry = one daie's criteria). */
export function summarizeAwards(all: KonvensyenCriterion[][]): AwardSummary {
  const met = (c: KonvensyenCriterion[], label: string) => c.find((x) => x.label === label)?.met ?? false;
  const s: AwardSummary = { people: all.length, hrtByTier: Object.fromEntries(HIBAH_TIERS.map((t) => [t, 0])), hrt: 0, alWasitah: 0, pusaka: 0, rookieEligible: 0, rookieAlWasitah: 0, rookiePerancangan: 0 };
  for (const c of all) {
    const tier = hibahTier(c.find((x) => x.label === "Hibah RT")?.value ?? 0);
    if (tier) { s.hrt++; s.hrtByTier[tier]++; }
    if (met(c, "Al-Wasitah RT")) s.alWasitah++;
    if (met(c, "Pusaka RT")) s.pusaka++;
    if (c.some((x) => x.label.startsWith("Rookie"))) s.rookieEligible++;
    if (met(c, "Rookie Al-Wasitah")) s.rookieAlWasitah++;
    if (met(c, "Rookie Perancangan")) s.rookiePerancangan++;
  }
  return s;
}
