import { notFound, redirect } from "next/navigation";
import { requireDaie } from "@/lib/auth/session";
import {
  getUserByUid,
  getMonthlyScoreForUid,
  getSaleEntriesForUids,
  getCollectionEntriesForUid,
  getGoal,
  getContests,
  getContestProgressForUids,
  getUnits,
  getSalesSummary,
} from "@/lib/data";
import { currentMonthKey, TRAFFIC_LIGHT_STYLES, type MonthKey } from "@/lib/scoring";
import { computeKonvensyenProgress, isRookieEligible, isWithinKonvensyenPeriod, KONVENSYEN_PERIOD } from "@/lib/konvensyen";
import { RANK_LABELS, unitLabel } from "@/lib/constants";
import { formatRM, formatDate, contractExpiryDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { ReportCardPrintButton } from "@/components/daie/report-card-print-button";
import { ReportCardMonthSelect } from "@/components/daie/report-card-month-select";
import type { ContestTarget } from "@/lib/types";

function monthLabel(monthKey: MonthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-MY", { month: "long", year: "numeric" });
}

function shiftMonth(monthKey: MonthKey, delta: number): MonthKey {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Oldest → newest, ending at (and including) monthKey. */
function trailingMonths(monthKey: MonthKey, count: number): MonthKey[] {
  return Array.from({ length: count }, (_, i) => shiftMonth(monthKey, -(count - 1 - i)));
}

function initials(name: string) {
  const words = name.replace(/\(.*?\)/g, "").trim().split(/\s+/);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase();
}

// A contest's targets are free-form labelled rows (see ContestTarget in
// lib/types.ts) — not a fixed schema, so matching "the individu row for this
// rank" is a best-effort text match, not a lookup. Requires BOTH "individu"
// and a rank-specific keyword, and excludes DPM's row when checking for DM
// (both contain "mawarith"). Contests with no individu-labelled row (e.g. a
// pure collection-point contest) correctly find nothing rather than guessing.
const RANK_TARGET_TERMS: Record<string, { include: string[]; exclude: string[] }> = {
  DM: { include: ["individu", "mawarith"], exclude: ["profesional"] },
  DPM: { include: ["individu", "profesional"], exclude: [] },
  KDE: { include: ["individu", "eksekutif"], exclude: [] },
};

function findIndividuTarget(targets: ContestTarget[], rank: string): ContestTarget | null {
  const rule = RANK_TARGET_TERMS[rank];
  if (!rule) return null;
  const norm = (s: string) => s.toLowerCase().replace(/['']/g, "");
  return targets.find((t) => {
    const label = norm(t.label);
    return rule.include.every((k) => label.includes(k)) && !rule.exclude.some((k) => label.includes(k));
  }) ?? null;
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2.5 whitespace-nowrap">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-semibold text-ink">{v}</span>
    </div>
  );
}

function SectionTitle({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3 font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-wide text-navy-900">
      <span>{children}</span>
      {hint && <span className="text-[11px] font-medium normal-case tracking-normal text-muted-foreground">{hint}</span>}
    </div>
  );
}

function CriterionRow({ label, value, target, met, formatValue, note }: { label: string; value: number; target: number; met: boolean; formatValue?: (n: number) => string; note?: string }) {
  const fmt = formatValue ?? ((n: number) => n.toLocaleString());
  const pct = target > 0 ? Math.min(100, Math.round((value / target) * 100)) : 0;
  return (
    <div>
      <div className="grid grid-cols-[110px_1fr_140px_26px] items-center gap-2.5">
        <div className="text-[13px] font-semibold text-ink">{label}</div>
        <div className="h-2 overflow-hidden rounded-full border border-border bg-muted">
          <div className={cn("h-full rounded-full", met ? "bg-success" : "bg-red-600")} style={{ width: `${pct}%` }} />
        </div>
        <div className="whitespace-nowrap text-right text-xs text-muted-foreground">{fmt(value)} / {fmt(target)}</div>
        <div className={cn("text-center text-sm font-extrabold", met ? "text-success" : "text-red-600")}>{met ? "✓" : "✗"}</div>
      </div>
      {note && <div className="mt-0.5 pl-[122px] text-[11px] text-muted-foreground">{note}</div>}
    </div>
  );
}

function GoalCard({ label, amount, sub, pct, pctLabel, barColor }: { label: string; amount: string; sub?: string; pct: number; pctLabel: string; barColor: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/60 p-3.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-[family-name:var(--font-display)] text-lg font-extrabold text-ink">
        {amount} {sub && <span className="text-xs font-semibold text-muted-foreground">{sub}</span>}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full border border-border bg-white">
        <div className={cn("h-full rounded-full", barColor)} style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
      </div>
      <div className="mt-1.5 text-[11px] font-bold text-navy-700">{pctLabel}</div>
    </div>
  );
}

export default async function ReportCardPage({
  params,
  searchParams,
}: {
  params: Promise<{ uid: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { uid } = await params;
  const { month: monthParam } = await searchParams;
  const viewer = await requireDaie();

  const target = await getUserByUid(uid);
  if (!target) notFound();

  const canView = viewer.uid === uid || viewer.isGroupAdmin || target.lineagePath.includes(viewer.uid);
  if (!canView) redirect("/");

  const monthKey: MonthKey = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonthKey();
  const last3 = trailingMonths(monthKey, 3);

  const [score, saleEntries, collectionEntries, goal, contests, progress, units, upline, salesSummary] = await Promise.all([
    getMonthlyScoreForUid(uid, monthKey),
    getSaleEntriesForUids([uid]),
    getCollectionEntriesForUid(uid),
    getGoal(uid),
    getContests(),
    getContestProgressForUids([uid]),
    getUnits(),
    target.uplineId ? getUserByUid(target.uplineId) : Promise.resolve(null),
    getSalesSummary(target),
  ]);

  const monthSales = saleEntries.filter((e) => e.date.slice(0, 7) === monthKey);
  const perancangan = monthSales.filter((e) => e.category === "perancangan").reduce((s, e) => s + (e.amount ?? 0), 0);
  const perancanganWasiat = monthSales.filter((e) => e.category === "perancangan" && e.subCategory !== "hibah").reduce((s, e) => s + (e.amount ?? 0), 0);
  const perancanganHibah = monthSales.filter((e) => e.category === "perancangan" && e.subCategory === "hibah").reduce((s, e) => s + (e.amount ?? 0), 0);
  const berlianCount = monthSales.filter((e) => e.category === "pengurusan" && e.subCategory === "berlian").reduce((s, e) => s + (e.count ?? 0), 0);
  const mutiaraCount = monthSales.filter((e) => e.category === "pengurusan" && e.subCategory === "mutiara").reduce((s, e) => s + (e.count ?? 0), 0);
  const pusakaBesar = monthSales.filter((e) => e.category === "kesPusaka" && e.subCategory === "besar").reduce((s, e) => s + (e.amount ?? 0), 0);
  const pusakaKecil = monthSales.filter((e) => e.category === "kesPusaka" && e.subCategory === "kecil").reduce((s, e) => s + (e.amount ?? 0), 0);
  const periodTotal = perancangan + pusakaBesar + pusakaKecil;

  const monthCollection = collectionEntries.filter((e) => e.date.slice(0, 7) === monthKey).reduce((s, e) => s + e.amountCollected, 0);

  const trend = last3.map((mk) => ({
    monthKey: mk,
    total: saleEntries
      .filter((e) => e.date.slice(0, 7) === mk && (e.category === "perancangan" || e.category === "kesPusaka"))
      .reduce((s, e) => s + (e.amount ?? 0), 0),
  }));
  const maxTrend = Math.max(1, ...trend.map((t) => t.total));

  const periodSales = saleEntries.filter((e) => isWithinKonvensyenPeriod(e.date));
  const konvensyen = computeKonvensyenProgress({
    alWasitahKesInPeriod: periodSales.filter((e) => e.category === "pengurusan").reduce((s, e) => s + (e.count ?? 0), 0),
    pusakaAmountInPeriod: periodSales.filter((e) => e.category === "kesPusaka").reduce((s, e) => s + (e.amount ?? 0), 0),
    perancanganInPeriod: periodSales.filter((e) => e.category === "perancangan").reduce((s, e) => s + (e.amount ?? 0), 0),
    hibahInPeriod: periodSales.filter((e) => e.category === "perancangan" && e.subCategory === "hibah").reduce((s, e) => s + (e.amount ?? 0), 0),
    rookieEligible: isRookieEligible(target.dateLicensed),
  });

  const progressByContest = new Map(progress.map((p) => [p.contestId, p.amount]));
  const expiry = target.dateLicensed ? contractExpiryDate(target.dateLicensed, target.rank) : null;
  const salesGoalPct = goal?.salesGoal ? Math.min(100, Math.round((periodTotal / goal.salesGoal) * 100)) : 0;
  const collectionPct = periodTotal > 0 ? Math.min(100, Math.round((monthCollection / periodTotal) * 100)) : 0;

  return (
    <div className="min-h-full bg-[#E9ECF6] px-4 py-8 print:bg-white print:p-0">
      <div className="mx-auto mb-5 flex max-w-[820px] flex-wrap items-center justify-between gap-3 print:hidden">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3 py-1.5 text-xs font-semibold text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Report card
        </span>
        <div className="flex items-center gap-2">
          <ReportCardMonthSelect basePath={`/report-card/${uid}`} monthKey={monthKey} />
          <ReportCardPrintButton />
        </div>
      </div>

      <div className="mx-auto max-w-[820px] overflow-hidden rounded-md bg-white text-[#1c1e26] shadow-sm print:overflow-visible print:shadow-none">
        <div className="flex justify-between gap-5 bg-[linear-gradient(135deg,var(--color-navy-900)_0%,var(--color-navy-700)_100%)] px-9 py-6 text-white">
          <div>
            <div className="font-[family-name:var(--font-display)] text-xl font-extrabold tracking-tight">
              Kausar<span className="text-accent">.</span> Group
            </div>
            <div className="mt-3.5 font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight">Daie Performance Report Card</div>
            <div className="mt-1 text-[13px] text-navy-100">Prepared for one-to-one coaching &middot; {unitLabel(target.unitId, units)}</div>
          </div>
          <div className="flex shrink-0 flex-col gap-0.5 whitespace-nowrap text-right text-xs text-navy-100">
            <span className="text-xs font-semibold text-white">Period</span>
            <span>{monthLabel(monthKey)}</span>
            <span className="mt-1.5 text-xs font-semibold text-white">Prepared by</span>
            <span>{viewer.name}, {viewer.rank}</span>
            <span className="mt-1.5 text-xs font-semibold text-white">Generated</span>
            <span>{formatDate(new Date())}</span>
          </div>
        </div>

        <div className="grid grid-cols-[52px_minmax(0,1fr)_190px] items-center gap-4 border-b border-border px-8 py-5">
          <div className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-border bg-muted font-[family-name:var(--font-display)] text-lg font-bold text-navy-700">
            {initials(target.name)}
          </div>
          <div className="min-w-0">
            <div className="truncate font-[family-name:var(--font-display)] text-[17px] font-bold text-ink">{target.name}</div>
            <div className="truncate text-[12.5px] text-muted-foreground">
              {RANK_LABELS[target.rank]} &middot; {target.structureType === "TS" ? "Total Service (TS)" : "Outsource Service (OS)"}
            </div>
          </div>
          <div className="flex flex-col gap-1 text-[11.5px]">
            <Fact k="Daie ID" v={target.daieId} />
            <Fact k="Upline" v={upline?.name ?? "—"} />
            <Fact k="Licensed" v={target.dateLicensed ? formatDate(target.dateLicensed) : "—"} />
            <Fact k="Expires" v={expiry ? formatDate(expiry) : "—"} />
          </div>
        </div>

        <div className="border-b border-border px-9 py-5 print:break-inside-avoid">
          <SectionTitle hint="Behaviour score · 5 criteria, 20 pts each">Monthly traffic light</SectionTitle>
          <div className="grid grid-cols-[150px_1fr] items-center gap-6">
            <div className="flex flex-col items-center justify-center gap-1.5 rounded-lg border border-border bg-muted p-4 text-center">
              <span className={cn("h-[30px] w-[30px] rounded-full border-[3px] border-white shadow-[0_0_0_1px_var(--color-border)]", TRAFFIC_LIGHT_STYLES[score.color].dotClassName)} />
              <span className="font-[family-name:var(--font-display)] text-2xl font-extrabold leading-none text-ink">
                {score.total}<span className="text-[13px] font-semibold text-muted-foreground">/100</span>
              </span>
              <span className="text-xs font-bold uppercase tracking-wide" style={{ color: score.color === "amber" ? "#8a6d00" : undefined }}>
                {TRAFFIC_LIGHT_STYLES[score.color].label}
              </span>
            </div>
            <div className="flex flex-col gap-2.5">
              <CriterionRow label="Training" value={score.training.count} target={score.training.target} met={score.training.points > 0} />
              <CriterionRow label="Reach" value={score.reach.count} target={score.reach.target} met={score.reach.points > 0} />
              <CriterionRow label="Presentations" value={score.presentations.count} target={score.presentations.target} met={score.presentations.points > 0} />
              <CriterionRow label="PROSPER invites" value={score.prosperInvites.count} target={score.prosperInvites.target} met={score.prosperInvites.points > 0} />
              <CriterionRow label="Closed sales" value={score.sales.amount} target={score.sales.target} met={score.sales.points > 0} formatValue={(n) => formatRM(n)} />
            </div>
          </div>
        </div>

        <div className="border-b border-border px-9 py-5 print:break-inside-avoid">
          <SectionTitle hint="This period vs. goal">Sales performance</SectionTitle>
          <div className="mb-4 grid grid-cols-3 gap-3.5">
            {goal?.salesGoal ? (
              <GoalCard label="Personal sales goal" amount={formatRM(periodTotal)} sub={`/ ${formatRM(goal.salesGoal)}`} pct={salesGoalPct} pctLabel={`${salesGoalPct}% of monthly goal`} barColor="bg-primary" />
            ) : (
              <GoalCard label="Personal sales goal" amount="No goal set" pct={0} pctLabel="Set one on My Goal" barColor="bg-muted-foreground" />
            )}
            <GoalCard label="Collection this period" amount={formatRM(monthCollection)} pct={collectionPct} pctLabel={`${collectionPct}% of sales collected`} barColor="bg-success" />
            <GoalCard
              label="3-month trend"
              amount={trend[2].total >= trend[1].total ? `↑ this month` : `↓ this month`}
              pct={maxTrend > 0 ? Math.round((trend[2].total / maxTrend) * 100) : 0}
              pctLabel={`${monthLabel(trend[1].monthKey)} → ${monthLabel(trend[2].monthKey)}`}
              barColor={trend[2].total >= trend[1].total ? "bg-success" : "bg-red-600"}
            />
          </div>

          <table className="mb-1 w-full border-collapse text-[12.5px]">
            <thead>
              <tr>
                <th className="border-b border-border px-2.5 pb-2 text-left text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Category</th>
                <th className="border-b border-border px-2.5 pb-2 text-right text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Cases / count</th>
                <th className="border-b border-border px-2.5 pb-2 text-right text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Amount (RM)</th>
              </tr>
            </thead>
            <tbody>
              <tr><td className="border-b border-border px-2.5 py-2 text-ink">Perancangan — Wasiat</td><td className="border-b border-border px-2.5 py-2 text-right text-ink">—</td><td className="border-b border-border px-2.5 py-2 text-right text-ink">{perancanganWasiat.toLocaleString()}</td></tr>
              <tr><td className="border-b border-border px-2.5 py-2 text-ink">Perancangan — Hibah</td><td className="border-b border-border px-2.5 py-2 text-right text-ink">—</td><td className="border-b border-border px-2.5 py-2 text-right text-ink">{perancanganHibah.toLocaleString()}</td></tr>
              <tr><td className="border-b border-border px-2.5 py-2 text-ink">Pengurusan — Al Wasitah (Berlian)</td><td className="border-b border-border px-2.5 py-2 text-right text-ink">{berlianCount}</td><td className="border-b border-border px-2.5 py-2 text-right text-ink">—</td></tr>
              <tr><td className="border-b border-border px-2.5 py-2 text-ink">Pengurusan — Al Wasitah (Mutiara)</td><td className="border-b border-border px-2.5 py-2 text-right text-ink">{mutiaraCount}</td><td className="border-b border-border px-2.5 py-2 text-right text-ink">—</td></tr>
              <tr><td className="border-b border-border px-2.5 py-2 text-ink">Kes Pusaka — Besar</td><td className="border-b border-border px-2.5 py-2 text-right text-ink">—</td><td className="border-b border-border px-2.5 py-2 text-right text-ink">{pusakaBesar.toLocaleString()}</td></tr>
              <tr><td className="border-b border-border px-2.5 py-2 text-ink">Kes Pusaka — Kecil</td><td className="border-b border-border px-2.5 py-2 text-right text-ink">—</td><td className="border-b border-border px-2.5 py-2 text-right text-ink">{pusakaKecil.toLocaleString()}</td></tr>
              <tr className="bg-muted font-bold"><td className="px-2.5 py-2 text-ink">Total (Perancangan [Wasiat+Hibah] + Kes Pusaka)</td><td className="px-2.5 py-2 text-right text-ink">—</td><td className="px-2.5 py-2 text-right text-ink">{periodTotal.toLocaleString()}</td></tr>
            </tbody>
          </table>

          <div className="mt-4 flex items-end gap-0">
            {trend.map((t) => (
              <div key={t.monthKey} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="text-[11px] font-bold text-ink">{formatRM(t.total)}</div>
                <div className="flex h-[70px] w-full max-w-[46px] items-end">
                  <div className={cn("w-full rounded-t", t.monthKey === monthKey ? "bg-primary" : "bg-navy-300")} style={{ height: `${maxTrend > 0 ? Math.max(4, Math.round((t.total / maxTrend) * 100)) : 4}%` }} />
                </div>
                <div className="text-[10.5px] text-muted-foreground">{monthLabel(t.monthKey)}{t.monthKey === monthKey ? " (this period)" : ""}</div>
              </div>
            ))}
          </div>
        </div>

        {salesSummary.groupTotals && (
          <div className="border-b border-border px-9 py-5 print:break-inside-avoid print:break-before-page">
            <SectionTitle hint={`All-time · ${salesSummary.groupStatusCounts?.active ?? 0} active downline`}>Group production</SectionTitle>
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr>
                  <th className="border-b border-border px-2.5 pb-2 text-left text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Category</th>
                  <th className="border-b border-border px-2.5 pb-2 text-right text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Personal</th>
                  <th className="border-b border-border px-2.5 pb-2 text-right text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Total group (incl. personal)</th>
                </tr>
              </thead>
              <tbody>
                <tr><td className="border-b border-border px-2.5 py-2 text-ink">Perancangan — Wasiat</td><td className="border-b border-border px-2.5 py-2 text-right text-ink">{formatRM(salesSummary.personalTotals.perancanganWasiat)}</td><td className="border-b border-border px-2.5 py-2 text-right text-ink">{formatRM(salesSummary.groupTotals.perancanganWasiat)}</td></tr>
                <tr><td className="border-b border-border px-2.5 py-2 text-ink">Perancangan — Hibah</td><td className="border-b border-border px-2.5 py-2 text-right text-ink">{formatRM(salesSummary.personalTotals.perancanganHibah)}</td><td className="border-b border-border px-2.5 py-2 text-right text-ink">{formatRM(salesSummary.groupTotals.perancanganHibah)}</td></tr>
                <tr><td className="border-b border-border px-2.5 py-2 text-ink">Wasitah — Berlian</td><td className="border-b border-border px-2.5 py-2 text-right text-ink">{salesSummary.personalTotals.pengurusanBerlian}</td><td className="border-b border-border px-2.5 py-2 text-right text-ink">{salesSummary.groupTotals.pengurusanBerlian}</td></tr>
                <tr><td className="border-b border-border px-2.5 py-2 text-ink">Wasitah — Mutiara</td><td className="border-b border-border px-2.5 py-2 text-right text-ink">{salesSummary.personalTotals.pengurusanMutiara}</td><td className="border-b border-border px-2.5 py-2 text-right text-ink">{salesSummary.groupTotals.pengurusanMutiara}</td></tr>
                <tr><td className="border-b border-border px-2.5 py-2 text-ink">Pusaka — Besar</td><td className="border-b border-border px-2.5 py-2 text-right text-ink">{formatRM(salesSummary.personalTotals.kesPusakaBesar)}</td><td className="border-b border-border px-2.5 py-2 text-right text-ink">{formatRM(salesSummary.groupTotals.kesPusakaBesar)}</td></tr>
                <tr><td className="border-b border-border px-2.5 py-2 text-ink">Pusaka — Kecil</td><td className="border-b border-border px-2.5 py-2 text-right text-ink">{formatRM(salesSummary.personalTotals.kesPusakaKecil)}</td><td className="border-b border-border px-2.5 py-2 text-right text-ink">{formatRM(salesSummary.groupTotals.kesPusakaKecil)}</td></tr>
                <tr className="bg-muted font-bold"><td className="px-2.5 py-2 text-ink">Collection</td><td className="px-2.5 py-2 text-right text-ink">{formatRM(salesSummary.personalTotals.collectionTotal)}</td><td className="px-2.5 py-2 text-right text-ink">{formatRM(salesSummary.groupTotals.collectionTotal)}</td></tr>
              </tbody>
            </table>
            <p className="mt-2.5 text-[11px] text-muted-foreground">Career-to-date totals (not scoped to this period) — same figures as Reports &rsquo; &ldquo;My Total Group Production&rdquo;.</p>
          </div>
        )}

        {contests.length > 0 && (
          <div className="border-b border-border px-9 py-5 print:break-inside-avoid">
            <SectionTitle hint="Self-reported, from My Goal">Trip contests</SectionTitle>
            <div className={cn("grid gap-3.5", contests.length === 1 ? "grid-cols-1" : "grid-cols-2")}>
              {contests.map((contest) => {
                const amount = progressByContest.get(contest.id) ?? 0;
                const matchedTarget = findIndividuTarget(contest.targets, target.rank);
                const pct = matchedTarget ? Math.min(100, Math.round((amount / matchedTarget.amount) * 100)) : 0;
                return (
                  <GoalCard
                    key={contest.id}
                    label={`${contest.section === "wasiyyah" ? "Wasiyyah" : "Kausar Group"} · ${contest.title}`}
                    amount={formatRM(amount)}
                    sub={matchedTarget ? `/ ${formatRM(matchedTarget.amount)}` : undefined}
                    pct={pct}
                    pctLabel={matchedTarget ? `${pct}% · ${matchedTarget.label}` : "No individu target found for this rank"}
                    barColor={contest.section === "wasiyyah" ? "bg-accent" : "bg-success"}
                  />
                );
              })}
            </div>
          </div>
        )}

        <div className="border-b border-border px-9 py-5 print:break-inside-avoid">
          <SectionTitle hint={`Wasiyyah FY ${formatDate(KONVENSYEN_PERIOD.start)}–${formatDate(KONVENSYEN_PERIOD.end)} · period count/amount`}>Konvensyen award progress</SectionTitle>
          <div className="flex flex-col gap-2.5">
            {konvensyen.map((c) => (
              <CriterionRow
                key={c.label}
                label={c.label}
                value={c.value}
                target={c.target}
                met={c.met}
                formatValue={c.label.includes("Perancangan") || c.label === "Pusaka RT" || c.label === "Hibah RT" ? formatRM : undefined}
                note={c.tierLabel}
              />
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Hibah RT is a single tiered award (RM100k/300k/500k/600k) — qualifying for a higher tier replaces the lower one, it doesn&rsquo;t stack.{" "}
            {isRookieEligible(target.dateLicensed) && "Rookie categories shown because this daie registered within the Rookie Terbaik window (May 2025–Oct 2026). "}
            Perlantikan Round Table isn&rsquo;t shown — the app doesn&rsquo;t track a recruitment-appointment count yet.
          </p>
        </div>

        <div className="px-9 py-5 print:break-inside-avoid">
          <SectionTitle>Mentor&rsquo;s coaching notes</SectionTitle>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-navy-700">Strengths this period</div>
              <div className="h-[22px] border-b border-dashed border-border" />
              <div className="h-[22px] border-b border-dashed border-border" />
              <div className="h-[22px] border-b border-dashed border-border" />
            </div>
            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-navy-700">Areas to work on</div>
              <div className="h-[22px] border-b border-dashed border-border" />
              <div className="h-[22px] border-b border-dashed border-border" />
              <div className="h-[22px] border-b border-dashed border-border" />
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-9">
            <div className="mt-8 border-t border-ink pt-1.5 text-[11px] text-muted-foreground">Daie signature &amp; date</div>
            <div className="mt-8 border-t border-ink pt-1.5 text-[11px] text-muted-foreground">Upline / mentor signature &amp; date</div>
          </div>
        </div>

        <div className="flex items-center justify-between px-9 py-4 text-[10.5px] text-muted-foreground">
          <span>Kausar Group Excellence — internal coaching document</span>
          <span>Confidential &middot; not for external distribution</span>
        </div>
      </div>
    </div>
  );
}
