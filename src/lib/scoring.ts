import type { ActivityEntry, SaleEntry } from "@/lib/types";

/** "YYYY-MM" */
export type MonthKey = string;

export function currentMonthKey(): MonthKey {
  return new Date().toISOString().slice(0, 7);
}

function daysInMonth(monthKey: MonthKey): number {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month, 0).getDate();
}

/**
 * Weekly quotas (training, reach, presentations) roll up to a monthly target
 * by scaling: target/week × weeks-in-month. Weeks-in-month is simply
 * days-in-month / 7 — avoids arguing about which partial week at a month
 * boundary "counts," and matches how the RM10k/month sales criterion is
 * already a flat monthly number with no per-week breakdown.
 */
function weeksInMonth(monthKey: MonthKey): number {
  return daysInMonth(monthKey) / 7;
}

export const WEEKLY_TARGETS = {
  trainingSessions: 1,
  reachCount: 30,
  presentations: 6,
} as const;

export const MONTHLY_SALES_TARGET = 10_000;

/** Flat monthly minimum (not scaled by weeks-in-month, unlike the weekly-quota criteria) — inviting daie to a Wasiyyah PROSPER BOP event. */
export const MONTHLY_PROSPER_TARGET = 2;

export const POINTS_PER_CRITERION = 20;

export type TrafficLightColor = "green" | "amber" | "red" | "black";

export interface MonthlyScore {
  monthKey: MonthKey;
  training: { count: number; target: number; points: number };
  reach: { count: number; target: number; points: number };
  presentations: { count: number; target: number; points: number };
  prosperInvites: { count: number; target: number; points: number };
  sales: { amount: number; target: number; points: number };
  total: number;
  color: TrafficLightColor;
}

function isInMonth(dateIso: string, monthKey: MonthKey): boolean {
  return dateIso.slice(0, 7) === monthKey;
}

function colorFor(total: number): TrafficLightColor {
  if (total >= 75) return "green";
  if (total >= 50) return "amber";
  if (total >= 25) return "red";
  return "black";
}

/**
 * Shared styling per traffic-light color, so the dot/badge/row-tint always
 * agree wherever a score is shown (My Activities' own summary, Reports'
 * Team Traffic Light table). `order` is best-to-worst — used to group table
 * rows by color band (all greens, then all ambers, ...) like Excel
 * conditional-formatting sort, rather than a flat numeric sort.
 */
export const TRAFFIC_LIGHT_STYLES: Record<TrafficLightColor, { label: string; order: number; dotClassName: string; rowClassName: string }> = {
  green: { label: "Green", order: 0, dotClassName: "bg-success", rowClassName: "bg-success/10" },
  amber: { label: "Amber", order: 1, dotClassName: "bg-accent", rowClassName: "bg-accent/15" },
  red: { label: "Red", order: 2, dotClassName: "bg-red-600", rowClassName: "bg-red-50" },
  black: { label: "Black", order: 3, dotClassName: "bg-ink", rowClassName: "bg-ink/10" },
};

/**
 * Computes one daie's monthly traffic-light score. Each of the 5 criteria is
 * binary (hit the target → the full 20 points, miss it → 0) per the agreed
 * scoring model — no partial credit within a criterion. Training, reach, and
 * presentations scale their target by weeks-in-month; PROSPER invites and
 * sales use a flat monthly target instead.
 *
 * @param activities this daie's logged activities (any month — filtered internally)
 * @param presentStageFirstDates the earliest "reached Present stage" date for each of this daie's prospects (one per prospect; see getPresentStageFirstDatesForUid)
 * @param saleEntries this daie's personal sale entries (any month — filtered internally)
 */
export function computeMonthlyScore(
  monthKey: MonthKey,
  activities: ActivityEntry[],
  presentStageFirstDates: string[],
  saleEntries: SaleEntry[],
): MonthlyScore {
  const weeks = weeksInMonth(monthKey);
  const monthActivities = activities.filter((a) => isInMonth(a.date, monthKey));

  const trainingCount = monthActivities.filter((a) => a.type === "training").length;
  const trainingTarget = Math.round(WEEKLY_TARGETS.trainingSessions * weeks);
  const trainingPoints = trainingCount >= trainingTarget ? POINTS_PER_CRITERION : 0;

  const reachCount = monthActivities.reduce((sum, a) => sum + (a.reachCount || 0), 0);
  const reachTarget = Math.round(WEEKLY_TARGETS.reachCount * weeks);
  const reachPoints = reachCount >= reachTarget ? POINTS_PER_CRITERION : 0;

  const presentationCount = presentStageFirstDates.filter((d) => isInMonth(d, monthKey)).length;
  const presentationTarget = Math.round(WEEKLY_TARGETS.presentations * weeks);
  const presentationPoints = presentationCount >= presentationTarget ? POINTS_PER_CRITERION : 0;

  const prosperInviteCount = monthActivities.filter((a) => a.type === "prosper_invite").length;
  const prosperInvitePoints = prosperInviteCount >= MONTHLY_PROSPER_TARGET ? POINTS_PER_CRITERION : 0;

  const salesAmount = saleEntries
    .filter((s) => isInMonth(s.date, monthKey) && (s.category === "perancangan" || s.category === "kesPusaka"))
    .reduce((sum, s) => sum + (s.amount ?? 0), 0);
  const salesPoints = salesAmount >= MONTHLY_SALES_TARGET ? POINTS_PER_CRITERION : 0;

  const total = trainingPoints + reachPoints + presentationPoints + prosperInvitePoints + salesPoints;

  return {
    monthKey,
    training: { count: trainingCount, target: trainingTarget, points: trainingPoints },
    reach: { count: reachCount, target: reachTarget, points: reachPoints },
    presentations: { count: presentationCount, target: presentationTarget, points: presentationPoints },
    prosperInvites: { count: prosperInviteCount, target: MONTHLY_PROSPER_TARGET, points: prosperInvitePoints },
    sales: { amount: salesAmount, target: MONTHLY_SALES_TARGET, points: salesPoints },
    total,
    color: colorFor(total),
  };
}

export interface CriterionStatus {
  key: "training" | "reach" | "presentations" | "prosperInvites" | "sales";
  label: string;
  done: number;
  target: number;
  met: boolean;
  /** How much more is needed to meet this criterion (0 when met). */
  remaining: number;
  /** "RM" for sales, otherwise a plain count. */
  isMoney: boolean;
}

/** The 5 criteria of a score as a uniform list — for the Activities reports' "what's left to turn green" view. */
export function criteriaStatus(score: MonthlyScore): CriterionStatus[] {
  const row = (key: CriterionStatus["key"], label: string, done: number, target: number, points: number, isMoney = false): CriterionStatus => ({
    key,
    label,
    done,
    target,
    met: points > 0,
    remaining: points > 0 ? 0 : Math.max(0, target - done),
    isMoney,
  });
  return [
    row("training", "Training", score.training.count, score.training.target, score.training.points),
    row("reach", "Reach", score.reach.count, score.reach.target, score.reach.points),
    row("presentations", "Presentations", score.presentations.count, score.presentations.target, score.presentations.points),
    row("prosperInvites", "PROSPER invites", score.prosperInvites.count, score.prosperInvites.target, score.prosperInvites.points),
    row("sales", "Closed sales", score.sales.amount, score.sales.target, score.sales.points, true),
  ];
}

/** Green needs 75+ points, i.e. 4 of the 5 criteria (20 pts each). How many MORE criteria this score must meet to get there (0 = already green). */
export const GREEN_THRESHOLD = 75;
export function criteriaNeededForGreen(score: MonthlyScore): number {
  return Math.max(0, Math.ceil((GREEN_THRESHOLD - score.total) / POINTS_PER_CRITERION));
}
