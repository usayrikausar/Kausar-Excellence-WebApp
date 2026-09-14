// DM → DPM rank-promotion quota tracker — pure functions, reused by the
// "Path to DPM" card and (later, if wanted) the printable report card. Rules
// sourced from Wasiyyah's memo WSB/MEMO/JPD/0902/2026 (9 Sept 2026): a new,
// stricter quota takes effect 1 Jan 2027, so this is deliberately
// regime-aware rather than hardcoding one set of numbers — which regime
// applies is picked purely from the date being evaluated, not from any
// per-daie flag.

export const DPM_PROMOTION_REGIME_CUTOFF = "2027-01-01";

export type PromotionRegime = "current" | "new";

export function regimeFor(asOfIso: string): PromotionRegime {
  return asOfIso >= DPM_PROMOTION_REGIME_CUTOFF ? "new" : "current";
}

const REGIME_TARGETS = {
  current: { alWasitahKes: 30, perancangan: 150_000 },
  new: { alWasitahKes: 30, perancangan: 200_000 },
} as const;

export const LANTIKAN_LANGSUNG_TARGET = 5;
export const TEMPOH_AKTIF_MONTHS = 6;
export const RECRUIT_WASITAH_MIN_MONTHS = 3;
export const RECRUIT_PERANCANGAN_MIN = 10_000;

/** Whole months between two ISO dates (from → asOf), floored, never negative. */
export function monthsBetween(fromIso: string, asOfIso: string): number {
  const from = new Date(fromIso);
  const asOf = new Date(asOfIso);
  let months = (asOf.getFullYear() - from.getFullYear()) * 12 + (asOf.getMonth() - from.getMonth());
  if (asOf.getDate() < from.getDate()) months -= 1;
  return Math.max(0, months);
}

export interface RecruitInput {
  uid: string;
  name: string;
  perancangan: number;
  wasitahActive: boolean;
  wasitahSince: string | null;
}

export interface RecruitStatus extends RecruitInput {
  wasitahMonthsActive: number;
  meetsBar: boolean; // only meaningful under the "new" regime
}

export interface DpmPromotionCriterion {
  label: string;
  met: boolean;
  detail: string;
}

export interface DpmPromotionStatus {
  regime: PromotionRegime;
  regimeEffectiveNote: string;
  jualanPeribadi: DpmPromotionCriterion & { alWasitahKes: number; alWasitahTarget: number; perancangan: number; perancanganTarget: number };
  lantikanLangsung: DpmPromotionCriterion & { count: number; target: number };
  tempohAktif: DpmPromotionCriterion & { months: number; target: number };
  wasitahSubscriptionSelf: DpmPromotionCriterion; // trivially met under "current" regime (not required yet)
  fiveDmConditions: DpmPromotionCriterion & { recruits: RecruitStatus[] }; // trivially met under "current" regime
  overallMet: boolean;
}

export function computeDpmPromotionStatus(params: {
  asOfIso: string;
  alWasitahKes: number;
  perancangan: number;
  dateLicensed: string | null;
  selfWasitahActive: boolean;
  recruits: RecruitInput[];
}): DpmPromotionStatus {
  const { asOfIso, alWasitahKes, perancangan, dateLicensed, selfWasitahActive, recruits } = params;
  const regime = regimeFor(asOfIso);
  const targets = REGIME_TARGETS[regime];

  const jualanMet = alWasitahKes >= targets.alWasitahKes && perancangan >= targets.perancangan;
  const jualanPeribadi = {
    label: "Jualan Peribadi",
    met: jualanMet,
    detail: `${alWasitahKes}/${targets.alWasitahKes} kes Al Wasitah, RM${perancangan.toLocaleString()}/RM${targets.perancangan.toLocaleString()} perancangan`,
    alWasitahKes,
    alWasitahTarget: targets.alWasitahKes,
    perancangan,
    perancanganTarget: targets.perancangan,
  };

  const lantikanCount = recruits.length;
  const lantikanMet = lantikanCount >= LANTIKAN_LANGSUNG_TARGET;
  const lantikanLangsung = {
    label: "Lantikan Langsung DM",
    met: lantikanMet,
    detail: `${lantikanCount}/${LANTIKAN_LANGSUNG_TARGET} DM dilantik terus`,
    count: lantikanCount,
    target: LANTIKAN_LANGSUNG_TARGET,
  };

  const months = dateLicensed ? monthsBetween(dateLicensed, asOfIso) : 0;
  const tempohMet = months >= TEMPOH_AKTIF_MONTHS;
  const tempohAktif = {
    label: "Tempoh Aktif",
    met: tempohMet,
    detail: `${months}/${TEMPOH_AKTIF_MONTHS} bulan`,
    months,
    target: TEMPOH_AKTIF_MONTHS,
  };

  const wasitahRequired = regime === "new";
  const wasitahSubscriptionSelf: DpmPromotionCriterion = {
    label: "Langganan Al Wasitah (calon)",
    met: !wasitahRequired || selfWasitahActive,
    detail: wasitahRequired
      ? selfWasitahActive
        ? "Aktif"
        : "Belum aktif — wajib mulai 1 Jan 2027"
      : "Tiada syarat lagi (semasa)",
  };

  const recruitStatuses: RecruitStatus[] = recruits.map((r) => {
    const wasitahMonthsActive = r.wasitahActive && r.wasitahSince ? monthsBetween(r.wasitahSince, asOfIso) : 0;
    const meetsBar = r.wasitahActive && wasitahMonthsActive >= RECRUIT_WASITAH_MIN_MONTHS && r.perancangan >= RECRUIT_PERANCANGAN_MIN;
    return { ...r, wasitahMonthsActive, meetsBar };
  });
  const qualifyingRecruits = recruitStatuses.filter((r) => r.meetsBar).length;
  const fiveDmMet = !wasitahRequired || (lantikanCount >= LANTIKAN_LANGSUNG_TARGET && qualifyingRecruits >= LANTIKAN_LANGSUNG_TARGET);
  const fiveDmConditions = {
    label: "Syarat 5 DM yang dilantik",
    met: fiveDmMet,
    detail: wasitahRequired
      ? `${qualifyingRecruits}/${Math.min(lantikanCount, LANTIKAN_LANGSUNG_TARGET)} DM memenuhi syarat (Al Wasitah ≥${RECRUIT_WASITAH_MIN_MONTHS} bulan & ≥RM${RECRUIT_PERANCANGAN_MIN.toLocaleString()} perancangan)`
      : "Tiada syarat lagi (semasa)",
    recruits: recruitStatuses,
  };

  const overallMet = jualanMet && lantikanMet && tempohMet && wasitahSubscriptionSelf.met && fiveDmMet;

  return {
    regime,
    regimeEffectiveNote:
      regime === "current"
        ? `Syarat semasa terpakai — syarat baru (RM200,000 perancangan, langganan Al Wasitah wajib) berkuatkuasa ${DPM_PROMOTION_REGIME_CUTOFF}.`
        : "Syarat baru (berkuatkuasa 1 Jan 2027) sedang terpakai.",
    jualanPeribadi,
    lantikanLangsung,
    tempohAktif,
    wasitahSubscriptionSelf,
    fiveDmConditions,
    overallMet,
  };
}
