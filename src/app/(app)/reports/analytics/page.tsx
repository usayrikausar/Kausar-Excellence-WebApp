import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { requireDaie } from "@/lib/auth/session";
import { canSwitchScope, getAnalyticsInput, getUnits } from "@/lib/data";
import { computeGroupAnalytics, FY_HISTORY, FY_HISTORY_SOURCE, type GroupAnalytics } from "@/lib/group-analytics";
import { UNIT_LABELS, unitLabel } from "@/lib/constants";
import { formatRM, cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { ScopeSwitcher } from "@/components/daie/scope-switcher";
import { ReportCardPrintButton } from "@/components/daie/report-card-print-button";
import { compareYoy, formatChange, yoyFormula, yoyWindow, PREV_FY, CURRENT_FY_LABEL } from "@/lib/yoy";
/** Same short names and colours as the Home group dashboard (that component is client-only, so its constant can't be imported here). */
const DASHBOARD_UNITS = [
  { id: "kausar-wealth", short: "KWM", color: "#001f64" },
  { id: "kausar-global", short: "KG", color: "#0029fc" },
  { id: "kausar-aspire", short: "KA", color: "#00c0fb" },
  { id: "kausar-intisar", short: "KI", color: "#f8c700" },
  { id: "kausar-nusrah", short: "KN", color: "#00c400" },
] as const;

/** Today in Malaysia (UTC+8), YYYY-MM-DD. */
function malaysiaToday(): string {
  return new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10);
}

function monthShort(mk: string) {
  const [y, m] = mk.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-MY", { month: "short", year: "2-digit" });
}

function monthLong(mk: string) {
  const [y, m] = mk.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-MY", { month: "long", year: "numeric" });
}

/** RM12.31m / RM770k / RM950 */
function rmShort(n: number) {
  if (n >= 999_500) return `RM${(n / 1_000_000).toFixed(2)}m`;
  if (n >= 1_000) return `RM${Math.round(n / 1_000).toLocaleString()}k`;
  return `RM${Math.round(n)}`;
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: React.ReactNode; tone?: "bad" | "good" }) {
  return (
    <div className="rounded-lg border border-border bg-white p-4 print:break-inside-avoid">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 font-[family-name:var(--font-display)] text-3xl font-extrabold tabular-nums", tone === "bad" ? "text-red-700" : tone === "good" ? "text-success" : "text-primary")}>{value}</p>
      {sub && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{sub}</p>}
    </div>
  );
}

function SalesChart({ a }: { a: GroupAnalytics }) {
  const max = Math.max(1, a.monthlyTarget ?? 0, ...a.bars.map((b) => b.amount)) * 1.08;
  const targetPct = a.monthlyTarget ? (a.monthlyTarget / max) * 100 : null;
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <div className="relative min-w-[560px] print:min-w-0">
        <div className="relative flex h-56 items-end gap-1.5 border-b border-border">
          {targetPct != null && (
            <div className="pointer-events-none absolute inset-x-0 z-10 border-t-2 border-dashed border-ink/50" style={{ bottom: `${targetPct}%` }}>
              <span className="absolute -top-5 right-0 bg-card px-1 text-[10px] font-semibold text-ink">Monthly target {rmShort(a.monthlyTarget!)}</span>
            </div>
          )}
          {a.bars.map((b) => (
            <div key={b.monthKey} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="whitespace-nowrap text-[10px] font-bold tabular-nums text-ink">{b.amount > 0 ? Math.round(b.amount / 1000).toLocaleString() : ""}</span>
              <div
                title={`${monthLong(b.monthKey)}: ${formatRM(b.amount)}`}
                className={cn(
                  "w-full max-w-[38px] rounded-t",
                  b.current ? "bg-accent" : b.hitTarget || (a.monthlyTarget == null && b.monthKey === a.bestMonth?.monthKey) ? "bg-primary" : "bg-navy-100",
                )}
                style={{ height: `${(b.amount / max) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-1.5">
          {a.bars.map((b) => (
            <span key={b.monthKey} className={cn("flex-1 text-center text-[10px] text-muted-foreground", b.current && "font-bold text-ink")}>{monthShort(b.monthKey)}</span>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {a.monthlyTarget != null && <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Reached the target</span>}
          {a.monthlyTarget == null && <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Best month</span>}
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-navy-100" /> {a.monthlyTarget != null ? "Below target" : "Other months"}</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-accent" /> This month (so far)</span>
          <span>Figures in RM thousands.</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Group analytics for KDE and Group Admin: the FY review slides' figures,
 * computed live. KDEs see the whole group or their own unit; Group Admin can
 * pick any unit. Definitions are in lib/group-analytics.ts.
 */
export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const user = await requireDaie();
  if (!canSwitchScope(user)) redirect("/reports");
  const { scope } = await searchParams;
  const unitId = scope && scope in UNIT_LABELS && (user.isGroupAdmin || scope === user.unitId) ? scope : null;

  const [{ sales, members }, units] = await Promise.all([getAnalyticsInput(), getUnits()]);
  const today = malaysiaToday();
  const a = computeGroupAnalytics({ sales, members, unitIds: Object.keys(UNIT_LABELS), unitId, today });
  const scopeName = unitId ? unitLabel(unitId, units) : "Kausar Group";
  const first = a.fyMonths[0];
  const shortName = (id: string) => DASHBOARD_UNITS.find((u) => u.id === id)?.short ?? unitLabel(id, units);
  const scopeOptionsList = [
    { value: null, label: "Kausar Group" },
    ...(user.isGroupAdmin ? Object.keys(UNIT_LABELS) : [user.unitId]).map((id) => ({ value: id, label: unitLabel(id, units) })),
  ];

  const pctOfTarget = a.targetToDate ? (a.salesToDate / a.targetToDate) * 100 : null;
  const gap = a.targetToDate != null ? a.targetToDate - a.salesToDate : null;
  const thisMonthPct = a.monthlyTarget ? (a.thisMonth.amount / a.monthlyTarget) * 100 : null;
  const recruitTrend = a.recruits.recentAvg - a.recruits.avgPerMonth;
  // Last full FY from Kausar's own sheet, for "vs last year" notes (group view only).
  const lastFy = unitId ? null : FY_HISTORY.find((h) => h.fy === "FY24/25") ?? null;

  // Year on year, per month, by TODAY's structure: FY24/25 of the people in
  // the unit now vs their FY25/26 completed months (lib/yoy.ts).
  const yoyWin = yoyWindow(today);
  const ytdByUid = new Map<string, number>();
  for (const s of sales) if (yoyWin.months.includes(s.monthKey)) ytdByUid.set(s.uid, (ytdByUid.get(s.uid) ?? 0) + s.amount);
  const yoyFor = (unit: string | null) => {
    const ms = unit ? members.filter((m) => m.unitId === unit) : members;
    return compareYoy(ms.reduce((t, m) => t + m.prevFy, 0), ms.reduce((t, m) => t + (ytdByUid.get(m.uid) ?? 0), 0), yoyWin);
  };
  const yoy = yoyFor(unitId);
  const yoyUnits = unitId ? [] : Object.keys(UNIT_LABELS).map((id) => ({ id, f: yoyFor(id) }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link href="/reports" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Reports
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {scopeOptionsList.length > 1 && <ScopeSwitcher basePath="/reports/analytics" options={scopeOptionsList} selected={unitId} />}
          <ReportCardPrintButton />
        </div>
      </div>

      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-ink">{scopeName} performance · FY25/26</h1>
        <p className="text-sm text-muted-foreground">
          {monthShort(first)} – {monthShort(a.currentMonth)} · data as of {new Date(today).toLocaleDateString("en-MY", { day: "numeric", month: "long", year: "numeric" })} · Perancangan
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3">
        <Tile
          label="Sales"
          value={rmShort(a.salesToDate)}
          sub={
            pctOfTarget != null
              ? `${pctOfTarget.toFixed(1)}% of the target to date (${rmShort(a.targetToDate!)}, ${monthShort(first)}–${monthShort(a.currentMonth)}). Gap ${rmShort(Math.max(0, gap!))}.`
              : `${a.shareOfGroup!.toFixed(1)}% of Kausar Group sales this FY. The FY target is set for the group only.`
          }
        />
        <Tile
          label="Recruitment"
          value={`${a.recruits.total} recruits`}
          sub={`Joined this FY · average ${a.recruits.avgPerMonth.toFixed(1)} a month; last 3 months ${a.recruits.recentAvg.toFixed(1)} a month${Math.abs(recruitTrend) >= 0.5 ? (recruitTrend < 0 ? " (slowing)" : " (picking up)") : ""}.${lastFy ? ` FY24/25: ${lastFy.newRecruits}.` : ""}`}
        />
        <Tile
          label="Active producers"
          value={a.producers.fy.toLocaleString()}
          sub={`${a.producers.activeProducers.toLocaleString()} of ${a.producers.activePerunding.toLocaleString()} active perunding (${a.producers.rate.toFixed(0)}%) have produced this FY · ${a.producers.thisMonth} producer${a.producers.thisMonth === 1 ? "" : "s"} in ${monthShort(a.currentMonth)} so far.${lastFy ? ` FY24/25: ${lastFy.producers}.` : ""}`}
        />
        <Tile label="Sales per producer" value={formatRM(Math.round(a.producers.salesPerProducer)).replace(/\.00$/, "")} sub={`FY sales ÷ daie who made at least one sale.${lastFy ? ` FY24/25: ${formatRM(Math.round(lastFy.salesPerProducer)).replace(/\.00$/, "")}.` : ""}`} />
        {a.unitShares ? (
          <Tile
            label="Unit contribution"
            value={`${shortName(a.unitShares[0].unitId)} ${a.unitShares[0].share.toFixed(0)}%`}
            sub={a.unitShares.slice(1).map((u) => `${shortName(u.unitId)} ${u.share.toFixed(0)}%`).join(" · ")}
          />
        ) : (
          <Tile label="Best month" value={a.bestMonth ? rmShort(a.bestMonth.amount) : "—"} sub={a.bestMonth ? monthLong(a.bestMonth.monthKey) : undefined} />
        )}
        <Tile
          label="New recruit activation"
          value={`${a.recruits.activationRate.toFixed(1)}%`}
          tone={a.recruits.activationRate < 30 ? "bad" : "good"}
          sub={`${a.recruits.becameProducer} became producers; ${a.recruits.inactive} already inactive (of ${a.recruits.total}).${lastFy ? ` FY24/25: ${lastFy.activationRate.toFixed(1)}%.` : ""}`}
        />
      </div>

      {a.keyIssue && (
        <div className="flex items-start gap-3 rounded-lg bg-navy-900 px-4 py-3 text-sm text-white print:break-inside-avoid">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
          <p><span className="font-bold text-accent">Key issue: </span>{a.keyIssue}</p>
        </div>
      )}

      <section className="space-y-3 print:break-inside-avoid">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-ink">Year on year · Perancangan per month</h2>
          <p className="text-sm text-muted-foreground">
            {PREV_FY.key} averaged over its 12 months, against {CURRENT_FY_LABEL}&rsquo;s completed months so far. Counted by today&rsquo;s structure: the people in {unitId ? scopeName : "each unit"} now, wherever they sat in {PREV_FY.key}.
          </p>
        </div>
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{PREV_FY.key} / month</p>
                <p className="font-[family-name:var(--font-display)] text-2xl font-extrabold tabular-nums text-ink">{rmShort(yoy.prevAvg)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{CURRENT_FY_LABEL} / month</p>
                <p className="font-[family-name:var(--font-display)] text-2xl font-extrabold tabular-nums text-primary">{rmShort(yoy.ytdAvg)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Change</p>
                <p className={cn("font-[family-name:var(--font-display)] text-2xl font-extrabold tabular-nums", yoy.changePct === null ? "text-muted-foreground" : yoy.changePct >= 0 ? "text-success" : "text-red-700")}>{formatChange(yoy.changePct)}</p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{yoyFormula(yoy, yoyWin, formatRM)}.</p>

            {yoyUnits.length > 0 && (
              <div className="mt-4 overflow-x-auto print:overflow-visible">
                <table className="w-full min-w-[520px] border-collapse text-sm tabular-nums print:min-w-0">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3">Unit</th>
                      <th className="px-3 py-2 text-right">{PREV_FY.key} total</th>
                      <th className="px-3 py-2 text-right">÷ 12 / month</th>
                      <th className="px-3 py-2 text-right">{CURRENT_FY_LABEL} YTD</th>
                      <th className="px-3 py-2 text-right">÷ {yoy.months} / month</th>
                      <th className="py-2 pl-3 text-right">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yoyUnits.map(({ id, f }) => (
                      <tr key={id} className="border-b border-border">
                        <td className="py-2 pr-3 font-medium text-ink">{shortName(id)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{rmShort(f.prevTotal)}</td>
                        <td className="px-3 py-2 text-right text-ink">{rmShort(f.prevAvg)}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{rmShort(f.ytdTotal)}</td>
                        <td className="px-3 py-2 text-right text-ink">{rmShort(f.ytdAvg)}</td>
                        <td className={cn("py-2 pl-3 text-right font-semibold", f.changePct === null ? "text-muted-foreground" : f.changePct >= 0 ? "text-success" : "text-red-700")}>{formatChange(f.changePct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3 print:break-before-page">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-ink">Sales by month · {a.bars.length} months</h2>
          <p className="text-sm text-muted-foreground">
            {a.monthlyTarget != null
              ? `${a.monthsHit} of ${a.completedMonths} completed months reached the monthly target of ${rmShort(a.monthlyTarget)} (FY target ÷ ${a.fyMonths.length} months).`
              : `${scopeName}'s Perancangan each month. Best month: ${a.bestMonth ? `${monthLong(a.bestMonth.monthKey)}, ${rmShort(a.bestMonth.amount)}` : "—"}.`}
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-[1fr_300px] print:grid-cols-1">
          <Card>
            <CardContent className="p-5 pt-8">
              <SalesChart a={a} />
            </CardContent>
          </Card>

          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-white p-4 print:break-inside-avoid">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{monthLong(a.currentMonth)}{thisMonthPct != null ? ` · ${thisMonthPct.toFixed(0)}% of target` : ""}</p>
              <p className="mt-1 font-[family-name:var(--font-display)] text-xl font-extrabold tabular-nums text-ink">{formatRM(a.thisMonth.amount)}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Day {a.thisMonth.day} of {a.thisMonth.daysInMonth}: about {rmShort(a.thisMonth.perDayNow)} a day so far.
                {a.thisMonth.perDayNeeded != null && (a.thisMonth.perDayNeeded > 0 ? ` Needs about ${rmShort(a.thisMonth.perDayNeeded)} a day to reach the monthly target.` : " Monthly target reached.")}
              </p>
            </div>

            <div className="rounded-lg border border-border bg-white p-4 print:break-inside-avoid">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">FY closing scenarios</p>
              <ul className="mt-2 space-y-1.5">
                {a.scenarios.map((s) => (
                  <li key={s.key} className={cn("flex items-baseline justify-between gap-2 rounded-md px-2 py-1.5 text-sm", s.key === "base" ? "bg-navy-900 text-white" : "text-ink")}>
                    <span className="font-semibold">{s.label}</span>
                    <span className="tabular-nums">
                      {rmShort(s.projected)}
                      {a.fyTarget ? <span className={cn("ml-1.5 text-xs", s.key === "base" ? "text-accent" : "text-muted-foreground")}>{((s.projected / a.fyTarget) * 100).toFixed(0)}%</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                Sales to date plus the rest of {monthShort(a.currentMonth)} and {a.monthsAfterCurrent} more month{a.monthsAfterCurrent === 1 ? "" : "s"} at a recent monthly rate:
                conservative = last 6 months ({rmShort(a.scenarios[0].monthlyRate)}/mo), base = last 4 ({rmShort(a.scenarios[1].monthlyRate)}/mo), stretch = best 3 of the last 6 ({rmShort(a.scenarios[2].monthlyRate)}/mo).
                {a.fyTarget ? ` % = of the FY target ${rmShort(a.fyTarget)}.` : ""}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2 print:grid-cols-2">
        {a.unitShares && (
          <section className="space-y-3 print:break-inside-avoid">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-ink">Unit contribution</h2>
            <Card>
              <CardContent className="space-y-3 p-5">
                {a.unitShares.map((u) => (
                  <div key={u.unitId}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium text-ink">{unitLabel(u.unitId, units)}</span>
                      <span className="tabular-nums text-muted-foreground">{rmShort(u.amount)} · <span className="font-semibold text-ink">{u.share.toFixed(1)}%</span></span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${u.share}%`, backgroundColor: DASHBOARD_UNITS.find((d) => d.id === u.unitId)?.color ?? "var(--color-primary)" }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        )}

        <section className="space-y-3 print:break-inside-avoid">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-ink">Recruits by month</h2>
          <Card>
            <CardContent className="p-5">
              {(() => {
                const maxR = Math.max(1, ...a.recruits.byMonth.map((r) => r.count));
                return (
                  <div className="flex h-36 items-end gap-1">
                    {a.recruits.byMonth.map((r) => (
                      <div key={r.monthKey} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${monthLong(r.monthKey)}: ${r.count}`}>
                        <span className="text-[10px] font-bold tabular-nums text-ink">{r.count || ""}</span>
                        <div className={cn("w-full max-w-[26px] rounded-t", r.monthKey === a.currentMonth ? "bg-accent" : "bg-navy-500")} style={{ height: `${(r.count / maxR) * 100}%` }} />
                        <span className="text-[9px] text-muted-foreground">{monthShort(r.monthKey).split(" ")[0]}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
              <p className="mt-3 text-xs text-muted-foreground">
                By licence date. {a.recruits.becameProducer} of {a.recruits.total} have made a sale; {a.recruits.inactive} no longer have an active contract.
              </p>
            </CardContent>
          </Card>
        </section>
      </div>

      {!unitId && (
        <section className="space-y-3 print:break-inside-avoid">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-ink">Previous financial years</h2>
            <p className="text-sm text-muted-foreground">As published in the {FY_HISTORY_SOURCE}. FY25/26 there is Wasiyyah&rsquo;s own count and can differ from the live figures above.</p>
          </div>
          <Card>
            <CardContent className="overflow-x-auto p-0 print:overflow-visible">
              <table className="w-full min-w-[640px] text-sm tabular-nums print:min-w-0 print:text-[11px]">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2.5">FY</th>
                    <th className="px-3 py-2.5 text-right">Sales</th>
                    <th className="px-3 py-2.5 text-right">Producers</th>
                    <th className="px-3 py-2.5 text-right">Sales / producer</th>
                    <th className="px-3 py-2.5 text-right">Perunding</th>
                    <th className="px-3 py-2.5 text-right">New recruits</th>
                    <th className="px-3 py-2.5 text-right">Recruits who produced</th>
                    <th className="px-3 py-2.5 text-right">Activation</th>
                  </tr>
                </thead>
                <tbody>
                  {FY_HISTORY.map((h, i) => {
                    const prev = FY_HISTORY[i - 1];
                    const change = (now: number, before?: number) =>
                      before ? <span className={cn("ml-1 text-xs", now >= before ? "text-success" : "text-red-700")}>{now >= before ? "+" : ""}{(((now - before) / before) * 100).toFixed(0)}%</span> : null;
                    return (
                      <tr key={h.fy} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-semibold text-ink">{h.fy}</td>
                        <td className="px-3 py-2 text-right">{rmShort(h.sales)}{change(h.sales, prev?.sales)}</td>
                        <td className="px-3 py-2 text-right">{h.producers}{change(h.producers, prev?.producers)}</td>
                        <td className="px-3 py-2 text-right">{formatRM(Math.round(h.salesPerProducer)).replace(/\.00$/, "")}{change(h.salesPerProducer, prev?.salesPerProducer)}</td>
                        <td className="px-3 py-2 text-right">{h.perunding}{change(h.perunding, prev?.perunding)}</td>
                        <td className="px-3 py-2 text-right">{h.newRecruits}{change(h.newRecruits, prev?.newRecruits)}</td>
                        <td className="px-3 py-2 text-right">{h.newRecruitProducers}</td>
                        <td className="px-3 py-2 text-right">{h.activationRate.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>
      )}

      <p className="text-xs text-muted-foreground">
        Sales count toward the unit the daie was in when the sale happened. Recruits, producers and perunding are counted by their unit today.
        Producer = at least one Perancangan sale this FY. Recruits are counted by the month they joined (Perunding sheet &ldquo;Bulan &amp; Tahun&rdquo;).
      </p>
    </div>
  );
}
