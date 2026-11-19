import Link from "next/link";
import { WASITAH_PACKAGES, wasitahBreakdown } from "@/lib/sale-details";
import { Printer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ProgressBar } from "@/components/daie/progress-bar";
import { cn, formatRM } from "@/lib/utils";
import type { CollectionEntry, SaleEntry } from "@/lib/types";
import { inPeriod, monthLabel, periodLabel, periodMonths, periodQuery, shiftMonth, type Period } from "@/lib/period";

interface MonthFigures {
  perancangan: number;
  /** Al Wasitah cases, every package, and per package. */
  wasitah: number;
  wasitahByPackage: Partial<Record<string, number>>;
  pusakaBesar: number;
  pusakaKecil: number;
}

function figuresFor(entries: SaleEntry[], period: Period): MonthFigures {
  const month = entries.filter((e) => inPeriod(e.date, period));
  const sum = (pred: (e: SaleEntry) => boolean, field: "amount" | "count") =>
    month.filter(pred).reduce((s, e) => s + (e[field] ?? 0), 0);
  return {
    perancangan: sum((e) => e.category === "perancangan", "amount"),
    wasitah: sum((e) => e.category === "pengurusan", "count"),
    wasitahByPackage: Object.fromEntries(WASITAH_PACKAGES.map((p) => [p.value, sum((e) => e.category === "pengurusan" && e.subCategory === p.value, "count")])),
    pusakaBesar: sum((e) => e.category === "kesPusaka" && e.subCategory === "besar", "amount"),
    pusakaKecil: sum((e) => e.category === "kesPusaka" && e.subCategory === "kecil", "amount"),
  };
}

const rmTotal = (f: MonthFigures) => f.perancangan + f.pusakaBesar + f.pusakaKecil;

/**
 * On-screen sales tracking for one daie and one period (a month or a range of months) — the sales half of
 * the printable report card, moved onto My Sales & Collection so an
 * upline/mentor can follow a daie's sales without leaving the tab. "Group"
 * figures are the daie plus their whole downline.
 */
export function SalesTrackingCard({
  uid,
  name,
  period,
  entries,
  collections,
  groupEntries,
  groupCollections,
  salesGoal,
}: {
  uid: string;
  name: string;
  period: Period;
  entries: SaleEntry[];
  collections: CollectionEntry[];
  /** Sale entries for the daie + their whole downline, or null when they have no downline. */
  groupEntries: SaleEntry[] | null;
  /** Collection entries for the daie + their whole downline, or null when they have no downline. */
  groupCollections?: CollectionEntry[] | null;
  salesGoal: number | null;
}) {
  const single = period.kind === "month";
  const months = periodMonths(period);
  const f = figuresFor(entries, period);
  const total = rmTotal(f);
  const collected = collections.filter((c) => inPeriod(c.date, period)).reduce((s, c) => s + c.amountCollected, 0);
  // One month: that month and the two before it. A range: every month in it.
  const trendMonths = single ? [-2, -1, 0].map((d) => shiftMonth(period.to, d)) : months;
  const trend = trendMonths.map((mk) => ({ monthKey: mk, total: rmTotal(figuresFor(entries, { kind: "month", from: mk, to: mk })) }));
  const maxTrend = Math.max(1, ...trend.map((t) => t.total));
  const group = groupEntries ? figuresFor(groupEntries, period) : null;
  const groupCollected = (groupCollections ?? []).filter((c) => inPeriod(c.date, period)).reduce((s, c) => s + c.amountCollected, 0);
  const label = periodLabel(period);
  const when = single ? "this month" : "this period";

  const rows: Array<{ label: string; personal: string; group?: string }> = [
    { label: "Perancangan", personal: formatRM(f.perancangan), group: group ? formatRM(group.perancangan) : undefined },
    {
      label: `Al Wasitah${wasitahBreakdown(f.wasitahByPackage) ? ` (${wasitahBreakdown(f.wasitahByPackage)})` : ""}`,
      personal: `${f.wasitah} kes`,
      group: group ? `${group.wasitah} kes` : undefined,
    },
    { label: "Kes Pusaka — Besar", personal: formatRM(f.pusakaBesar), group: group ? formatRM(group.pusakaBesar) : undefined },
    { label: "Kes Pusaka — Kecil", personal: formatRM(f.pusakaKecil), group: group ? formatRM(group.pusakaKecil) : undefined },
  ];

  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-ink">Sales tracking · {label}</h2>
            <p className="truncate text-sm text-muted-foreground">{name}</p>
          </div>
          {/* Phone: same tab (the report card has a Back button); desktop: a new tab. */}
          <Link
            href={`/report-card/${uid}?${periodQuery(period)}&view=sales`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-muted lg:hidden"
          >
            <Printer className="h-4 w-4" /> Sales report card
          </Link>
          <Link
            href={`/report-card/${uid}?${periodQuery(period)}&view=sales`}
            target="_blank"
            className="hidden items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-muted lg:inline-flex"
          >
            <Printer className="h-4 w-4" /> Print sales report card
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="min-w-0 rounded-lg border border-border p-3 sm:p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sales {when}</p>
            <p className="font-[family-name:var(--font-display)] text-base font-extrabold text-ink [overflow-wrap:anywhere] sm:text-xl">{formatRM(total)}</p>
            <p className="text-xs text-muted-foreground">Perancangan + Kes Pusaka</p>
          </div>
          <div className="min-w-0 rounded-lg border border-border p-3 sm:p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Collected {when}</p>
            <p className="font-[family-name:var(--font-display)] text-base font-extrabold text-ink [overflow-wrap:anywhere] sm:text-xl">{formatRM(collected)}</p>
            <p className="text-xs text-muted-foreground">{total > 0 ? `${Math.min(100, Math.round((collected / total) * 100))}% of sales` : `No sales ${when}`}</p>
          </div>
          <div className="col-span-2 rounded-lg border border-border p-4 sm:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{single ? "3-month trend" : "Month by month"}</p>
            <div className="mt-1 flex h-16 items-stretch gap-2">
              {trend.map((t) => (
                <div key={t.monthKey} className="flex flex-1 flex-col items-center gap-0.5">
                  {/* The bar's % height needs a parent with a real height: this flex-1 box. */}
                  <div className="flex w-full flex-1 items-end justify-center">
                    <div
                      className={cn("w-full max-w-[28px] rounded-t", single && t.monthKey === period.to ? "bg-primary" : "bg-navy-300")}
                      style={{ height: `${Math.max(4, Math.round((t.total / maxTrend) * 100))}%` }}
                      title={`${monthLabel(t.monthKey)}: ${formatRM(t.total)}`}
                    />
                  </div>
                  {trend.length <= 6 && <span className="text-[10px] text-muted-foreground">{monthLabel(t.monthKey, "short")}</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {salesGoal ? (
          <ProgressBar
            label={single ? "Monthly sales goal" : `Sales goal for ${months.length} months (${formatRM(salesGoal)} a month)`}
            value={total}
            max={salesGoal * months.length}
            formatValue={formatRM}
            accent="success"
          />
        ) : (
          <p className="text-sm text-muted-foreground">No personal sales goal set (set on My Goal).</p>
        )}

        {/* Phone: one line per category, personal over group; no sideways scrolling. */}
        <ul className="divide-y divide-border text-sm sm:hidden">
          {rows.map((r) => (
            <li key={r.label} className="flex items-baseline justify-between gap-3 py-2">
              <span className="text-ink">{r.label}</span>
              <span className="shrink-0 text-right tabular-nums">
                <span className="block font-semibold text-ink">{r.personal}</span>
                {group && <span className="block text-xs text-muted-foreground">Group {r.group}</span>}
              </span>
            </li>
          ))}
          <li className="flex items-baseline justify-between gap-3 py-2 font-bold text-ink">
            <span>Total RM (Perancangan + Pusaka)</span>
            <span className="shrink-0 text-right tabular-nums">
              <span className="block">{formatRM(total)}</span>
              {group && <span className="block text-xs font-semibold text-muted-foreground">Group {formatRM(rmTotal(group))}</span>}
            </span>
          </li>
          <li className="flex items-baseline justify-between gap-3 py-2 text-ink">
            <span>Collection</span>
            <span className="shrink-0 text-right tabular-nums">
              <span className="block font-semibold">{formatRM(collected)}</span>
              {group && <span className="block text-xs text-muted-foreground">Group {formatRM(groupCollected)}</span>}
            </span>
          </li>
        </ul>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="border-b border-border py-2 pr-2 font-semibold">Category</th>
                <th className="border-b border-border py-2 pr-2 text-right font-semibold">Personal</th>
                {group && <th className="border-b border-border py-2 text-right font-semibold">Group (incl. personal)</th>}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {rows.map((r) => (
                <tr key={r.label}>
                  <td className="border-b border-border py-2 pr-2">{r.label}</td>
                  <td className="border-b border-border py-2 pr-2 text-right">{r.personal}</td>
                  {group && <td className="border-b border-border py-2 text-right">{r.group}</td>}
                </tr>
              ))}
              <tr className="font-bold text-ink">
                <td className="border-b border-border py-2 pr-2">Total RM (Perancangan + Pusaka)</td>
                <td className="border-b border-border py-2 pr-2 text-right">{formatRM(total)}</td>
                {group && <td className="border-b border-border py-2 text-right">{formatRM(rmTotal(group))}</td>}
              </tr>
              <tr className="text-ink">
                <td className="py-2 pr-2">Collection (Perancangan payments received)</td>
                <td className="py-2 pr-2 text-right">{formatRM(collected)}</td>
                {group && <td className="py-2 text-right">{formatRM(groupCollected)}</td>}
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
