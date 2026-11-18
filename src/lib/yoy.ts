/**
 * Year-on-year comparison (agreed with the PIC 2026-11-18): Perancangan per
 * month, because the two FYs are different lengths.
 *
 *   FY24/25 average  = FY24/25 total ÷ 12 months (Jul 2024 – Jun 2025)
 *   FY25/26 average  = FY25/26 year-to-date ÷ completed months so far
 *
 * "Completed months" leaves out the month in progress, so a half-finished
 * month never drags the average down. FY24/25 totals per daie come from the
 * "KONVENSYEN FYP 24/25 KAUSAR GROUP" sheet (SUMMARY tab), stored on each
 * daie's users doc as fyHistory["FY24/25"]. Units and groups use the CURRENT
 * structure: the FY24/25 figure is the sum for the people in it today.
 */
import { KONVENSYEN_PERIOD } from "@/lib/konvensyen";
import type { SaleEntry } from "@/lib/types";

/** Today in Malaysia (UTC+8) as YYYY-MM-DD — the server runs in UTC. */
export function malaysiaToday(): string {
  return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
}

/** A daie's FY24/25 Perancangan, 0 when the sheet has nothing for them. */
export function prevFyPerancangan(user: { fyHistory?: Record<string, { perancangan: number }> | null }): number {
  return user.fyHistory?.[PREV_FY.key]?.perancangan ?? 0;
}

export const PREV_FY ={ key: "FY24/25", months: 12, range: "Jul 2024 – Jun 2025" } as const;
export const CURRENT_FY_LABEL = "FY25/26";

function monthName(mk: string) {
  const [y, m] = mk.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-MY", { month: "short", year: "numeric" });
}

/** FY25/26 months that are fully over as of `today` (YYYY-MM-DD, Malaysia time). */
export function completedFyMonths(today: string): string[] {
  const out: string[] = [];
  let [y, m] = KONVENSYEN_PERIOD.start.slice(0, 7).split("-").map(Number);
  const end = KONVENSYEN_PERIOD.end.slice(0, 7);
  const current = today.slice(0, 7);
  for (;;) {
    const mk = `${y}-${String(m).padStart(2, "0")}`;
    if (mk > end || mk >= current) break;
    out.push(mk);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

export interface YoyWindow {
  months: string[];
  /** e.g. "Jul 2025 – Oct 2026"; empty when no month has finished yet. */
  range: string;
}

export function yoyWindow(today: string): YoyWindow {
  const months = completedFyMonths(today);
  return { months, range: months.length ? `${monthName(months[0])} – ${monthName(months[months.length - 1])}` : "" };
}

export interface YoyFigures {
  prevTotal: number;
  prevAvg: number;
  ytdTotal: number;
  ytdAvg: number;
  months: number;
  /** % change of the monthly average; null when FY24/25 had nothing to compare against. */
  changePct: number | null;
}

export function compareYoy(prevTotal: number, ytdTotal: number, window: YoyWindow): YoyFigures {
  const months = window.months.length;
  const prevAvg = prevTotal / PREV_FY.months;
  const ytdAvg = months ? ytdTotal / months : 0;
  return { prevTotal, prevAvg, ytdTotal, ytdAvg, months, changePct: prevAvg > 0 && months ? ((ytdAvg - prevAvg) / prevAvg) * 100 : null };
}

/** Perancangan in the completed FY25/26 months. */
export function ytdPerancangan(entries: Pick<SaleEntry, "category" | "date" | "amount">[], window: YoyWindow): number {
  if (!window.months.length) return 0;
  const first = window.months[0];
  const last = window.months[window.months.length - 1];
  return entries
    .filter((e) => e.category === "perancangan" && e.date.slice(0, 7) >= first && e.date.slice(0, 7) <= last)
    .reduce((s, e) => s + (e.amount ?? 0), 0);
}

/** The formula, spelled out under every comparison. */
export function yoyFormula(f: YoyFigures, window: YoyWindow, format: (n: number) => string): string {
  // Whole ringgit reads better in a sentence than RM 139,250.00.
  const fmt = (n: number) => format(Math.round(n)).replace(/\.00$/, "");
  const prev = `${PREV_FY.key} (${PREV_FY.range}): ${fmt(f.prevTotal)} ÷ 12 months = ${fmt(f.prevAvg)}/month`;
  const cur = f.months
    ? `${CURRENT_FY_LABEL} YTD (${window.range}): ${fmt(f.ytdTotal)} ÷ ${f.months} completed month${f.months === 1 ? "" : "s"} = ${fmt(f.ytdAvg)}/month`
    : `${CURRENT_FY_LABEL}: no completed month yet`;
  return `${prev} · ${cur}`;
}

export function formatChange(pct: number | null): string {
  if (pct === null) return "—";
  const r = Math.round(pct);
  return `${r > 0 ? "+" : ""}${r}%`;
}
