import Link from "next/link";
import { Printer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ProgressBar } from "@/components/daie/progress-bar";
import { cn, formatRM } from "@/lib/utils";
import type { CollectionEntry, SaleEntry } from "@/lib/types";
import type { MonthKey } from "@/lib/scoring";

function monthLabel(monthKey: MonthKey, style: "long" | "short" = "long") {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-MY", { month: style, year: style === "long" ? "numeric" : "2-digit" });
}

function shiftMonth(monthKey: MonthKey, delta: number): MonthKey {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface MonthFigures {
  perancangan: number;
  berlian: number;
  mutiara: number;
  pusakaBesar: number;
  pusakaKecil: number;
}

function figuresFor(entries: SaleEntry[], monthKey: MonthKey): MonthFigures {
  const month = entries.filter((e) => e.date.slice(0, 7) === monthKey);
  const sum = (pred: (e: SaleEntry) => boolean, field: "amount" | "count") =>
    month.filter(pred).reduce((s, e) => s + (e[field] ?? 0), 0);
  return {
    perancangan: sum((e) => e.category === "perancangan", "amount"),
    berlian: sum((e) => e.category === "pengurusan" && e.subCategory === "berlian", "count"),
    mutiara: sum((e) => e.category === "pengurusan" && e.subCategory === "mutiara", "count"),
    pusakaBesar: sum((e) => e.category === "kesPusaka" && e.subCategory === "besar", "amount"),
    pusakaKecil: sum((e) => e.category === "kesPusaka" && e.subCategory === "kecil", "amount"),
  };
}

const rmTotal = (f: MonthFigures) => f.perancangan + f.pusakaBesar + f.pusakaKecil;

/**
 * On-screen sales tracking for one daie and one month — the sales half of
 * the printable report card, moved onto My Sales & Collection so an
 * upline/mentor can follow a daie's sales without leaving the tab. "Group"
 * figures are the daie plus their whole downline.
 */
export function SalesTrackingCard({
  uid,
  name,
  monthKey,
  entries,
  collections,
  groupEntries,
  salesGoal,
}: {
  uid: string;
  name: string;
  monthKey: MonthKey;
  entries: SaleEntry[];
  collections: CollectionEntry[];
  /** Sale entries for the daie + their whole downline, or null when they have no downline. */
  groupEntries: SaleEntry[] | null;
  salesGoal: number | null;
}) {
  const f = figuresFor(entries, monthKey);
  const total = rmTotal(f);
  const collected = collections.filter((c) => c.date.slice(0, 7) === monthKey).reduce((s, c) => s + c.amountCollected, 0);
  const trend = [-2, -1, 0].map((d) => {
    const mk = shiftMonth(monthKey, d);
    return { monthKey: mk, total: rmTotal(figuresFor(entries, mk)) };
  });
  const maxTrend = Math.max(1, ...trend.map((t) => t.total));
  const group = groupEntries ? figuresFor(groupEntries, monthKey) : null;

  const rows: Array<{ label: string; personal: string; group?: string }> = [
    { label: "Perancangan", personal: formatRM(f.perancangan), group: group ? formatRM(group.perancangan) : undefined },
    { label: "Pengurusan — Berlian", personal: `${f.berlian} kes`, group: group ? `${group.berlian} kes` : undefined },
    { label: "Pengurusan — Mutiara", personal: `${f.mutiara} kes`, group: group ? `${group.mutiara} kes` : undefined },
    { label: "Kes Pusaka — Besar", personal: formatRM(f.pusakaBesar), group: group ? formatRM(group.pusakaBesar) : undefined },
    { label: "Kes Pusaka — Kecil", personal: formatRM(f.pusakaKecil), group: group ? formatRM(group.pusakaKecil) : undefined },
  ];

  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-ink">Sales tracking · {monthLabel(monthKey)}</h2>
            <p className="truncate text-sm text-muted-foreground">{name}</p>
          </div>
          <Link
            href={`/report-card/${uid}?month=${monthKey}&view=sales`}
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-muted"
          >
            <Printer className="h-4 w-4" /> Print sales report card
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sales this month</p>
            <p className="font-[family-name:var(--font-display)] text-xl font-extrabold text-ink">{formatRM(total)}</p>
            <p className="text-xs text-muted-foreground">Perancangan + Kes Pusaka</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Collected this month</p>
            <p className="font-[family-name:var(--font-display)] text-xl font-extrabold text-ink">{formatRM(collected)}</p>
            <p className="text-xs text-muted-foreground">{total > 0 ? `${Math.min(100, Math.round((collected / total) * 100))}% of sales` : "No sales this month"}</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">3-month trend</p>
            <div className="mt-1 flex h-14 items-end gap-2">
              {trend.map((t) => (
                <div key={t.monthKey} className="flex flex-1 flex-col items-center gap-0.5">
                  <div
                    className={cn("w-full max-w-[28px] rounded-t", t.monthKey === monthKey ? "bg-primary" : "bg-navy-300")}
                    style={{ height: `${Math.max(4, Math.round((t.total / maxTrend) * 100))}%` }}
                    title={`${monthLabel(t.monthKey)}: ${formatRM(t.total)}`}
                  />
                  <span className="text-[10px] text-muted-foreground">{monthLabel(t.monthKey, "short")}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {salesGoal ? (
          <ProgressBar label="Monthly sales goal" value={total} max={salesGoal} formatValue={formatRM} accent="success" />
        ) : (
          <p className="text-sm text-muted-foreground">No personal sales goal set (set on My Goal).</p>
        )}

        <div className="overflow-x-auto">
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
                <td className="py-2 pr-2">Total RM (Perancangan + Pusaka)</td>
                <td className="py-2 pr-2 text-right">{formatRM(total)}</td>
                {group && <td className="py-2 text-right">{formatRM(rmTotal(group))}</td>}
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
