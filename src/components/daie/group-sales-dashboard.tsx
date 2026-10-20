"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatRM } from "@/lib/utils";
import type { UnitMonthSales } from "@/lib/data";

type Metric = "perancangan" | "pengurusan" | "pusaka";

const METRICS: Record<Metric, { label: string; format: (n: number) => string; unitHint: string }> = {
  perancangan: { label: "Perancangan", format: (n) => formatRM(n), unitHint: "RM" },
  pengurusan: { label: "Pengurusan (Al Wasitah)", format: (n) => `${n.toLocaleString()} kes`, unitHint: "cases" },
  pusaka: { label: "Kes Pusaka", format: (n) => formatRM(n), unitHint: "RM" },
};

/** Fixed order + colour per unit so a unit keeps the same colour in every bar and month. */
export const DASHBOARD_UNITS = [
  { id: "kausar-wealth", short: "KWM", color: "#001f64" },
  { id: "kausar-global", short: "KG", color: "#0029fc" },
  { id: "kausar-aspire", short: "KA", color: "#00c0fb" },
  { id: "kausar-intisar", short: "KI", color: "#f8c700" },
  { id: "kausar-nusrah", short: "KN", color: "#00c400" },
] as const;

function monthShort(monthKey: string) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-MY", { month: "short", year: "2-digit" });
}

function compactRM(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}m`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(Math.round(n));
}

/**
 * Kausar Group dashboard for Group Admin / KDE on Home: this month's and
 * FY-to-date total group sales (TGS), and a month-by-month bar per FY month,
 * each bar stacked by unit — switchable between Perancangan, Pengurusan and
 * Kes Pusaka.
 */
export function GroupSalesDashboard({
  rows,
  months,
  unitLabels,
  fyLabel,
}: {
  rows: UnitMonthSales[];
  /** FY months oldest → newest, ending at the current month. */
  months: string[];
  unitLabels: Record<string, string>;
  fyLabel: string;
}) {
  const [metric, setMetric] = useState<Metric>("perancangan");
  const { format, label } = METRICS[metric];
  const currentMonth = months[months.length - 1];

  const value = (monthKey: string, unitId: string) =>
    rows.find((r) => r.monthKey === monthKey && r.unitId === unitId)?.[metric] ?? 0;
  const monthTotal = (monthKey: string) => DASHBOARD_UNITS.reduce((s, u) => s + value(monthKey, u.id), 0);
  const unitFytd = (unitId: string) => months.reduce((s, mk) => s + value(mk, unitId), 0);

  const fytd = months.reduce((s, mk) => s + monthTotal(mk), 0);
  const thisMonth = monthTotal(currentMonth);
  const maxBar = Math.max(1, ...months.map(monthTotal));

  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-ink">Kausar Group performance</h2>
            <p className="text-sm text-muted-foreground">Total group sales (TGS) by unit · {fyLabel}</p>
          </div>
          <div role="tablist" aria-label="Sales category" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
            {(Object.keys(METRICS) as Metric[]).map((m) => (
              <button
                key={m}
                role="tab"
                aria-selected={metric === m}
                onClick={() => setMetric(m)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                  metric === m ? "bg-white text-ink shadow-sm" : "text-muted-foreground hover:text-ink",
                )}
              >
                {METRICS[m].label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">TGS · {monthShort(currentMonth)} (this month)</p>
            <p className="font-[family-name:var(--font-display)] text-2xl font-extrabold text-ink">{format(thisMonth)}</p>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">TGS · {fyLabel} to date</p>
            <p className="font-[family-name:var(--font-display)] text-2xl font-extrabold text-ink">{format(fytd)}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {DASHBOARD_UNITS.map((u) => (
            <span key={u.id} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: u.color }} />
              {u.short} · {unitLabels[u.id] ?? u.id}
            </span>
          ))}
        </div>

        {fytd === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No {label} recorded yet this financial year.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex min-w-[640px] items-end gap-1.5 pt-2" aria-label={`${label} by month, stacked by unit`}>
              {months.map((mk) => {
                const total = monthTotal(mk);
                return (
                  <div key={mk} className="flex flex-1 flex-col items-center gap-1">
                    <span className="h-4 whitespace-nowrap text-[10px] font-bold leading-4 tabular-nums text-ink">{total > 0 ? (metric === "pengurusan" ? total : compactRM(total)) : ""}</span>
                    <div className="flex h-44 w-full max-w-[40px] flex-col-reverse overflow-hidden rounded-t">
                      <div className="flex w-full flex-col-reverse" style={{ height: `${(total / maxBar) * 100}%` }}>
                        {DASHBOARD_UNITS.map((u) => {
                          const v = value(mk, u.id);
                          if (v <= 0) return null;
                          return (
                            <div
                              key={u.id}
                              title={`${u.short} ${monthShort(mk)}: ${format(v)}`}
                              style={{ height: `${(v / total) * 100}%`, backgroundColor: u.color }}
                            />
                          );
                        })}
                      </div>
                    </div>
                    <span className={cn("h-4 whitespace-nowrap text-[10px] leading-4 text-muted-foreground", mk === currentMonth && "font-bold text-ink")}>{monthShort(mk)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="border-b border-border py-2 pr-2 font-semibold">Unit</th>
                <th className="border-b border-border py-2 pr-2 text-right font-semibold">This month</th>
                <th className="border-b border-border py-2 text-right font-semibold">{fyLabel} to date</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {DASHBOARD_UNITS.map((u) => (
                <tr key={u.id}>
                  <td className="border-b border-border py-2 pr-2">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: u.color }} />
                      {unitLabels[u.id] ?? u.id}
                    </span>
                  </td>
                  <td className="border-b border-border py-2 pr-2 text-right">{format(value(currentMonth, u.id))}</td>
                  <td className="border-b border-border py-2 text-right">{format(unitFytd(u.id))}</td>
                </tr>
              ))}
              <tr className="font-bold text-ink">
                <td className="py-2 pr-2">Kausar Group (TGS)</td>
                <td className="py-2 pr-2 text-right">{format(thisMonth)}</td>
                <td className="py-2 text-right">{format(fytd)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
