import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireDaie } from "@/lib/auth/session";
import { canSwitchScope, getGroupSalesByMonth, getKonvensyenRows, getScopeMembers, getUnits, resolveViewScope, scopeOptions } from "@/lib/data";
import { FY_GROUP_TARGET, HIBAH_TIERS, KONVENSYEN_PERIOD, summarizeAwards } from "@/lib/konvensyen";
import { UNIT_LABELS, unitLabel } from "@/lib/constants";
import { currentMonthKey } from "@/lib/scoring";
import { formatRM, formatDate, cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { ScopeSwitcher } from "@/components/daie/scope-switcher";
import { ReportCardPrintButton } from "@/components/daie/report-card-print-button";
import { KonvensyenBoard } from "@/components/daie/konvensyen-board";

/** FY months (Jul 2025 – Dec 2026), oldest first. */
function fyMonths(): string[] {
  const out: string[] = [];
  let [y, m] = KONVENSYEN_PERIOD.start.slice(0, 7).split("-").map(Number);
  const end = KONVENSYEN_PERIOD.end.slice(0, 7);
  while (`${y}-${String(m).padStart(2, "0")}` <= end) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-[family-name:var(--font-display)] text-xl font-extrabold tabular-nums", tone === "good" ? "text-success" : tone === "bad" ? "text-red-700" : "text-ink")}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

/**
 * Konvensyen & FY report (KDE / Group Admin): FY25/26 closing against the
 * group Perancangan target, and who has qualified (or is closest) for each
 * Wasiyyah Konvensyen award. KDE "Overall" shows counts per unit only.
 */
export default async function KonvensyenReportPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const user = await requireDaie();
  if (!canSwitchScope(user)) redirect("/reports");
  const { scope: scopeParam } = await searchParams;
  const scope = resolveViewScope(user, scopeParam);
  const months = fyMonths();
  const [members, units, groupSales] = await Promise.all([getScopeMembers(user, scope), getUnits(), getGroupSalesByMonth(months[0])]);

  // --- FY closing (group target only) ---
  const inFy = groupSales.filter((r) => r.monthKey <= months[months.length - 1]);
  const achieved = inFy.reduce((s, r) => s + r.perancangan, 0);
  const now = currentMonthKey();
  const elapsed = Math.max(1, months.filter((m) => m <= now).length);
  const monthsLeft = Math.max(0, months.length - elapsed + 1); // including this month
  const gap = FY_GROUP_TARGET - achieved;
  const pct = (achieved / FY_GROUP_TARGET) * 100;
  const perMonthNeeded = monthsLeft > 0 && gap > 0 ? gap / monthsLeft : 0;
  const avgSoFar = achieved / elapsed;
  const thisMonth = inFy.filter((r) => r.monthKey === now).reduce((s, r) => s + r.perancangan, 0);
  const unitRows = Object.keys(UNIT_LABELS).map((unitId) => {
    const total = inFy.filter((r) => r.unitId === unitId).reduce((s, r) => s + r.perancangan, 0);
    return { unitId, total, share: achieved > 0 ? (total / achieved) * 100 : 0 };
  });
  const highlightUnit = scope.kind === "unit" ? scope.unitId : null;

  // --- Konvensyen awards ---
  const people = user.isStaff ? members : [user, ...members];
  const rows = await getKonvensyenRows(people);
  const totalsOnly = scope.kind === "overall";
  const unitSummaries = totalsOnly
    ? Object.keys(UNIT_LABELS).map((unitId) => ({ unitId, s: summarizeAwards(rows.filter((r) => r.unitId === unitId).map((r) => r.konvensyen)) }))
    : null;
  const scopeName = scope.kind === "unit" ? unitLabel(scope.unitId, units) : "Kausar Group";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/reports" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Reports
        </Link>
        <ReportCardPrintButton />
      </div>
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-ink">Konvensyen &amp; FY</h1>
        <p className="text-sm text-muted-foreground">
          Wasiyyah FY25/26 · {formatDate(KONVENSYEN_PERIOD.start)} – {formatDate(KONVENSYEN_PERIOD.end)} · Perancangan
        </p>
      </div>

      <section className="space-y-3 print:break-inside-avoid">
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-ink">FY closing · Kausar Group</h2>
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat label="FY target" value={formatRM(FY_GROUP_TARGET)} sub="Group Perancangan, Jul 2025 – Dec 2026" />
              <Stat label="Achieved" value={formatRM(achieved)} sub={`${pct.toFixed(1)}% of target`} tone="good" />
              <Stat label={gap > 0 ? "Gap to target" : "Above target"} value={formatRM(Math.abs(gap))} sub={`${monthsLeft} month${monthsLeft === 1 ? "" : "s"} left incl. this month`} tone={gap > 0 ? "bad" : "good"} />
              <Stat
                label="Needed per month"
                value={gap > 0 ? formatRM(perMonthNeeded) : "Target met"}
                sub={`Average so far ${formatRM(avgSoFar)}/month · this month ${formatRM(thisMonth)}`}
              />
            </div>
            <div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="FY target achieved">
                <div className="h-full rounded-full bg-success" style={{ width: `${Math.min(100, pct)}%` }} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {gap > 0
                  ? `To close FY25/26 on target, Kausar Group needs ${formatRM(perMonthNeeded)} a month — ${(perMonthNeeded / Math.max(1, avgSoFar)).toFixed(1)}× the average so far.`
                  : "Kausar Group has reached its FY25/26 target."}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-2">Unit</th>
                    <th className="py-2 text-right">FY Perancangan</th>
                    <th className="py-2 text-right">Share of group</th>
                  </tr>
                </thead>
                <tbody>
                  {unitRows.map((u) => (
                    <tr key={u.unitId} className={cn("border-b border-border", u.unitId === highlightUnit && "bg-primary/5 font-semibold")}>
                      <td className="py-2 pr-2">{unitLabel(u.unitId, units)}</td>
                      <td className="py-2 text-right tabular-nums">{formatRM(u.total)}</td>
                      <td className="py-2 text-right tabular-nums">{u.share.toFixed(1)}%</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td className="py-2 pr-2">Kausar Group</td>
                    <td className="py-2 text-right tabular-nums">{formatRM(achieved)}</td>
                    <td className="py-2 text-right tabular-nums">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <div className="space-y-2 print:hidden">
          <ScopeSwitcher basePath="/reports/konvensyen" {...scopeOptions(user, scope, units)} />
        </div>
        <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-ink">Konvensyen awards · {totalsOnly ? "Kausar Group (overall)" : scopeName}</h2>
        {unitSummaries ? (
          <Card>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2.5">Unit</th>
                    <th className="px-3 py-2.5 text-right">Daie</th>
                    {HIBAH_TIERS.map((t) => <th key={t} className="px-3 py-2.5 text-right">HRT {t / 1000}k</th>)}
                    <th className="px-3 py-2.5 text-right">Al-Wasitah RT</th>
                    <th className="px-3 py-2.5 text-right">Pusaka RT</th>
                    <th className="px-3 py-2.5 text-right">Rookie AW</th>
                    <th className="px-3 py-2.5 text-right">Rookie Perancangan</th>
                  </tr>
                </thead>
                <tbody>
                  {unitSummaries.map(({ unitId, s }) => (
                    <tr key={unitId} className="border-b border-border">
                      <td className="px-3 py-2 font-medium">{unitLabel(unitId, units)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{s.people}</td>
                      {HIBAH_TIERS.map((t) => <td key={t} className="px-3 py-2 text-right tabular-nums">{s.hrtByTier[t]}</td>)}
                      <td className="px-3 py-2 text-right tabular-nums">{s.alWasitah}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{s.pusaka}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{s.rookieAlWasitah}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{s.rookiePerancangan}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-3 py-2 text-xs text-muted-foreground">Qualifier counts per unit. Switch to My group to see names.</p>
            </CardContent>
          </Card>
        ) : (
          <KonvensyenBoard rows={rows} units={units} showUnit={scope.kind === "all"} />
        )}
      </section>
    </div>
  );
}
