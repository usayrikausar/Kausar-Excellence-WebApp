/**
 * Group analytics (Reports → Analytics): the figures Kausar Group's FY review
 * slides show, computed from the app's own data instead of by hand.
 *
 * Definitions (agreed 2026-11-18):
 * - Sales = Perancangan (RM), counted toward the unit the daie was in when the
 *   sale happened (same rule as the unit tables).
 * - Target = the GROUP FY target only, spread evenly over the FY months
 *   (RM20.91m / 18 ≈ RM1.162m a month). Unit views show no target.
 * - Recruit = a daie whose dateLicensed falls in the FY, up to today.
 * - Producer = a daie with any Perancangan in the period.
 * - Active perunding = contract currently active (isActiveStatus).
 * - FY closing scenarios project the remaining days at a recent monthly
 *   average: Conservative = last 6 complete months, Base = last 4,
 *   Stretch = best 3 of the last 6.
 */
import { FY_GROUP_TARGET, KONVENSYEN_PERIOD } from "@/lib/konvensyen";

export interface AnalyticsSale {
  uid: string;
  /** Unit the sale counts toward. */
  unitId: string;
  monthKey: string;
  amount: number;
}

export interface AnalyticsMember {
  uid: string;
  /** Unit today. */
  unitId: string;
  dateLicensed: string | null;
  active: boolean;
}

export interface MonthBar {
  monthKey: string;
  amount: number;
  /** null for the current (unfinished) month. */
  hitTarget: boolean | null;
  current: boolean;
}

export interface Scenario {
  key: "conservative" | "base" | "stretch";
  label: string;
  basis: string;
  monthlyRate: number;
  projected: number;
}

export interface GroupAnalytics {
  /** null = whole group */
  unitId: string | null;
  fyMonths: string[];
  currentMonth: string;
  elapsedMonths: number;
  /** Months after the current one, to FY end. */
  monthsAfterCurrent: number;

  salesToDate: number;
  /** Group view only. */
  monthlyTarget: number | null;
  targetToDate: number | null;
  fyTarget: number | null;
  /** Share of the whole group's sales (unit view) — null in group view. */
  shareOfGroup: number | null;

  bars: MonthBar[];
  completedMonths: number;
  monthsHit: number;
  bestMonth: MonthBar | null;

  thisMonth: {
    amount: number;
    day: number;
    daysInMonth: number;
    perDayNow: number;
    /** Needed per remaining day (incl. today) to hit the monthly target; group view only. */
    perDayNeeded: number | null;
  };

  recruits: {
    total: number;
    byMonth: Array<{ monthKey: string; count: number }>;
    avgPerMonth: number;
    /** Average over the last 3 complete months. */
    recentAvg: number;
    becameProducer: number;
    inactive: number;
    activationRate: number;
  };

  producers: {
    fy: number;
    thisMonth: number;
    activePerunding: number;
    /** Active perunding who have produced. */
    activeProducers: number;
    /** activeProducers ÷ active perunding. */
    rate: number;
    salesPerProducer: number;
  };

  /** Group view only: each unit's share of FY sales. */
  unitShares: Array<{ unitId: string; amount: number; share: number }> | null;

  scenarios: Scenario[];
  /** Auto-written headline, or null when nothing stands out. */
  keyIssue: string | null;
}

/** FY months (Jul 2025 – Dec 2026), oldest first. */
export function fyMonthKeys(): string[] {
  const out: string[] = [];
  let [y, m] = KONVENSYEN_PERIOD.start.slice(0, 7).split("-").map(Number);
  const end = KONVENSYEN_PERIOD.end.slice(0, 7);
  while (`${y}-${String(m).padStart(2, "0")}` <= end) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
}

export function computeGroupAnalytics({
  sales,
  members,
  unitIds,
  unitId,
  today,
}: {
  sales: AnalyticsSale[];
  members: AnalyticsMember[];
  /** Every unit, for the group view's share table. */
  unitIds: string[];
  unitId: string | null;
  /** YYYY-MM-DD, local (Malaysia) date. */
  today: string;
}): GroupAnalytics {
  const fyMonths = fyMonthKeys();
  const currentMonth = today.slice(0, 7);
  const elapsed = fyMonths.filter((m) => m <= currentMonth);
  const monthsAfterCurrent = fyMonths.filter((m) => m > currentMonth).length;
  const inFy = (mk: string) => mk >= fyMonths[0] && mk <= currentMonth && mk <= fyMonths[fyMonths.length - 1];

  const fySales = sales.filter((s) => inFy(s.monthKey) && s.amount > 0);
  const scopedSales = unitId ? fySales.filter((s) => s.unitId === unitId) : fySales;
  const scopedMembers = unitId ? members.filter((m) => m.unitId === unitId) : members;
  const isGroup = unitId === null;

  const byMonth = new Map<string, number>();
  for (const s of scopedSales) byMonth.set(s.monthKey, (byMonth.get(s.monthKey) ?? 0) + s.amount);
  const salesToDate = scopedSales.reduce((t, s) => t + s.amount, 0);
  const groupTotal = fySales.reduce((t, s) => t + s.amount, 0);

  const monthlyTarget = isGroup ? FY_GROUP_TARGET / fyMonths.length : null;
  const bars: MonthBar[] = elapsed.map((mk) => {
    const amount = byMonth.get(mk) ?? 0;
    return { monthKey: mk, amount, current: mk === currentMonth, hitTarget: mk === currentMonth || monthlyTarget == null ? null : amount >= monthlyTarget };
  });
  const completedBars = bars.filter((b) => !b.current);
  const bestMonth = bars.reduce<MonthBar | null>((best, b) => (!best || b.amount > best.amount ? b : best), null);

  // This month
  const [cy, cm] = currentMonth.split("-").map(Number);
  const daysInMonth = new Date(cy, cm, 0).getDate();
  const day = Number(today.slice(8, 10));
  const thisAmount = byMonth.get(currentMonth) ?? 0;
  const daysLeft = daysInMonth - day + 1;
  const perDayNeeded = monthlyTarget == null ? null : Math.max(0, monthlyTarget - thisAmount) / daysLeft;

  // Recruits
  const fyStart = KONVENSYEN_PERIOD.start;
  const recruits = scopedMembers.filter((m) => m.dateLicensed && m.dateLicensed >= fyStart && m.dateLicensed <= today);
  const recruitsByMonth = elapsed.map((mk) => ({ monthKey: mk, count: recruits.filter((r) => r.dateLicensed!.slice(0, 7) === mk).length }));
  const producerUids = new Set(scopedSales.map((s) => s.uid));
  const thisMonthProducers = new Set(scopedSales.filter((s) => s.monthKey === currentMonth).map((s) => s.uid));
  const becameProducer = recruits.filter((r) => producerUids.has(r.uid)).length;
  const recruitInactive = recruits.filter((r) => !r.active).length;
  const recentRecruitMonths = recruitsByMonth.filter((r) => r.monthKey < currentMonth).slice(-3);

  // Producers
  const activePerunding = scopedMembers.filter((m) => m.active).length;
  const producers = producerUids.size;
  const activeProducers = scopedMembers.filter((m) => m.active && producerUids.has(m.uid)).length;

  // Unit shares
  const unitShares = isGroup
    ? unitIds
        .map((u) => {
          const amount = fySales.filter((s) => s.unitId === u).reduce((t, s) => t + s.amount, 0);
          return { unitId: u, amount, share: groupTotal > 0 ? (amount / groupTotal) * 100 : 0 };
        })
        .sort((a, b) => b.amount - a.amount)
    : null;

  // Scenarios: the rest of this month + every month after it, at a recent rate.
  const remainingMonths = monthsAfterCurrent + (daysInMonth - day) / daysInMonth;
  const last6 = completedBars.slice(-6).map((b) => b.amount);
  const last4 = completedBars.slice(-4).map((b) => b.amount);
  const best3 = [...last6].sort((a, b) => b - a).slice(0, 3);
  const scenarioDefs: Array<Omit<Scenario, "projected">> = [
    { key: "conservative", label: "Conservative", basis: "Average of the last 6 months", monthlyRate: avg(last6) },
    { key: "base", label: "Base", basis: "Average of the last 4 months", monthlyRate: avg(last4) },
    { key: "stretch", label: "Stretch", basis: "Average of the best 3 of the last 6 months", monthlyRate: avg(best3) },
  ];
  const scenarios = scenarioDefs.map((s) => ({ ...s, projected: salesToDate + s.monthlyRate * remainingMonths }));

  const activationRate = recruits.length ? (becameProducer / recruits.length) * 100 : 0;
  const producerRate = activePerunding ? (activeProducers / activePerunding) * 100 : 0;

  // Key issue: the first rule that fires, most pressing first.
  let keyIssue: string | null = null;
  if (recruits.length >= 10 && activationRate < 30) {
    const lostPerActive = becameProducer > 0 ? recruitInactive / becameProducer : null;
    keyIssue =
      `Recruits are not becoming producers: only ${becameProducer} of ${recruits.length} FY recruits (${activationRate.toFixed(1)}%) have made a sale` +
      (lostPerActive != null && lostPerActive >= 1 ? `, and ${lostPerActive.toFixed(1)} have gone inactive for every one who did.` : ".") +
      " Focus on activating new recruits.";
  } else if (monthlyTarget != null && completedBars.length >= 3 && completedBars.filter((b) => b.hitTarget).length / completedBars.length < 0.25) {
    keyIssue = `Only ${completedBars.filter((b) => b.hitTarget).length} of ${completedBars.length} months reached the monthly target of RM${(monthlyTarget / 1_000_000).toFixed(2)}m.`;
  } else if (activePerunding >= 10 && producerRate < 50) {
    keyIssue = `Only ${activeProducers} of ${activePerunding} active perunding (${producerRate.toFixed(0)}%) have produced this FY.`;
  }

  return {
    unitId,
    fyMonths,
    currentMonth,
    elapsedMonths: elapsed.length,
    monthsAfterCurrent,
    salesToDate,
    monthlyTarget,
    targetToDate: monthlyTarget == null ? null : monthlyTarget * elapsed.length,
    fyTarget: isGroup ? FY_GROUP_TARGET : null,
    shareOfGroup: isGroup ? null : groupTotal > 0 ? (salesToDate / groupTotal) * 100 : 0,
    bars,
    completedMonths: completedBars.length,
    monthsHit: completedBars.filter((b) => b.hitTarget).length,
    bestMonth,
    thisMonth: { amount: thisAmount, day, daysInMonth, perDayNow: day > 0 ? thisAmount / day : 0, perDayNeeded },
    recruits: {
      total: recruits.length,
      byMonth: recruitsByMonth,
      avgPerMonth: elapsed.length ? recruits.length / elapsed.length : 0,
      recentAvg: avg(recentRecruitMonths.map((r) => r.count)),
      becameProducer,
      inactive: recruitInactive,
      activationRate,
    },
    producers: {
      fy: producers,
      thisMonth: thisMonthProducers.size,
      activePerunding,
      activeProducers,
      rate: producerRate,
      salesPerProducer: producers ? salesToDate / producers : 0,
    },
    unitShares,
    scenarios,
    keyIssue,
  };
}
