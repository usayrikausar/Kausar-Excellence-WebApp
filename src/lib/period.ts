// Report periods for the sales report cards: one month, a quick pick, or a
// custom From–To range of whole months (agreed 2026-11-16 — whole months, not
// exact dates, because sheet-imported sales are recorded per month). Shared by
// the printable report card and My Sales & Collection; client-safe.
import { KONVENSYEN_PERIOD } from "@/lib/konvensyen";
import type { MonthKey } from "@/lib/scoring";

export type PeriodKind = "month" | "last3" | "last6" | "ytd" | "fy" | "custom";

export interface Period {
  kind: PeriodKind;
  from: MonthKey;
  to: MonthKey;
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const FY_FROM: MonthKey = KONVENSYEN_PERIOD.start.slice(0, 7);
export const FY_TO: MonthKey = KONVENSYEN_PERIOD.end.slice(0, 7);

export function shiftMonth(monthKey: MonthKey, delta: number): MonthKey {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(monthKey: MonthKey, style: "long" | "short" = "long"): string {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-MY", { month: style, year: style === "long" ? "numeric" : "2-digit" });
}

/** Oldest → newest, inclusive. */
export function monthsBetween(from: MonthKey, to: MonthKey): MonthKey[] {
  const out: MonthKey[] = [];
  for (let mk = from; mk <= to && out.length < 240; mk = shiftMonth(mk, 1)) out.push(mk);
  return out;
}

/** The period in a page's search params (`?month=` · `?period=last3|last6|ytd|fy` · `?period=custom&from=&to=`); defaults to `now`'s month. */
export function resolvePeriod(params: { month?: string; period?: string; from?: string; to?: string }, now: MonthKey): Period {
  switch (params.period) {
    case "last3": return { kind: "last3", from: shiftMonth(now, -2), to: now };
    case "last6": return { kind: "last6", from: shiftMonth(now, -5), to: now };
    case "ytd": return { kind: "ytd", from: `${now.slice(0, 4)}-01`, to: now };
    case "fy": return { kind: "fy", from: FY_FROM, to: FY_TO };
    case "custom":
      if (params.from && params.to && MONTH_RE.test(params.from) && MONTH_RE.test(params.to)) {
        const [from, to] = params.from <= params.to ? [params.from, params.to] : [params.to, params.from];
        return from === to ? { kind: "month", from, to } : { kind: "custom", from, to };
      }
  }
  const month = params.month && MONTH_RE.test(params.month) ? params.month : now;
  return { kind: "month", from: month, to: month };
}

export function periodMonths(p: Period): MonthKey[] {
  return monthsBetween(p.from, p.to);
}

export function inPeriod(dateIso: string, p: Period): boolean {
  const mk = dateIso.slice(0, 7);
  return mk >= p.from && mk <= p.to;
}

function rangeLabel(p: Period): string {
  return p.from.slice(0, 4) === p.to.slice(0, 4)
    ? `${monthLabel(p.from).split(" ")[0]} – ${monthLabel(p.to)}`
    : `${monthLabel(p.from)} – ${monthLabel(p.to)}`;
}

export function periodLabel(p: Period): string {
  switch (p.kind) {
    case "month": return monthLabel(p.from);
    case "last3": return `Last 3 months (${rangeLabel(p)})`;
    case "last6": return `Last 6 months (${rangeLabel(p)})`;
    case "ytd": return `Year to date ${p.to.slice(0, 4)} (${rangeLabel(p)})`;
    case "fy": return `FY25/26 (${rangeLabel(p)})`;
    case "custom": return rangeLabel(p);
  }
}

/** Search params that reproduce `p` (for links, e.g. the "Print" button). */
export function periodQuery(p: Period): string {
  if (p.kind === "month") return `month=${p.from}`;
  if (p.kind === "custom") return `period=custom&from=${p.from}&to=${p.to}`;
  return `period=${p.kind}`;
}
