import Link from "next/link";
import { Users, FileText } from "lucide-react";
import { requireDaie } from "@/lib/auth/session";
import { getSalesSummary, getSaleEntriesForUids, getTeamWithTotals, getMonthlyScoresForUids, getUnits } from "@/lib/data";
import { currentMonthKey, type MonthKey } from "@/lib/scoring";
import { KpiTile } from "@/components/daie/kpi-tile";
import { SalesComparison } from "@/components/daie/sales-totals";
import { ExportSalesCsvButton } from "@/components/daie/export-sales-csv-button";
import { PersonalProductionReport } from "@/components/daie/personal-production-report";
import { TopProducersTable } from "@/components/daie/top-producers-table";
import { TeamTrafficLightTable } from "@/components/daie/team-traffic-light-table";
import { UnitProductionTable } from "@/components/daie/unit-production-table";
import { ReportCardMonthSelect } from "@/components/daie/report-card-month-select";
import { ComingSoon } from "@/components/daie/coming-soon";

function monthLabel(monthKey: MonthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-MY", { month: "long", year: "numeric" });
}

// The real Reports builder (fully customizable columns/sorting/filters,
// qualifiers, and — once Activities exists — PIPPPAS process/open-close case
// status) is bigger Phase 2 scope that needs its own design pass. This ships
// the concrete, buildable slice of that vision now: personal monthly
// production with highest-month/biggest-case highlights, and a sortable
// team ranking — both real, backed by actual sale entries, not placeholders.
// "Top clients" isn't here because no sale entry captures a client name yet
// — that needs a schema/form change first, not something to fake.
export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const user = await requireDaie();
  const { month: monthParam } = await searchParams;
  const monthKey: MonthKey = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonthKey();

  const [{ personalTotals, groupTotals, groupStatusCounts }, team, units] = await Promise.all([
    getSalesSummary(user),
    getTeamWithTotals(user),
    getUnits(),
  ]);
  const downlineCount = team.length;

  const [personalEntries, groupEntries] = await Promise.all([
    getSaleEntriesForUids([user.uid]),
    getSaleEntriesForUids([user.uid, ...team.map((m) => m.uid)]),
  ]);

  const scoresByUid = await getMonthlyScoresForUids(team.map((m) => m.uid), monthKey);
  const teamScores = team.map((member) => ({
    uid: member.uid,
    name: member.name,
    daieId: member.daieId,
    score: scoresByUid.get(member.uid)!,
  }));

  return (
    <div className="space-y-6">
      <div className="max-w-xs">
        <KpiTile
          label="My recruitment total"
          value={String(downlineCount)}
          icon={Users}
          accent="accent"
          subtitle={
            groupStatusCounts ? (
              <>
                <span className="font-semibold text-success">{groupStatusCounts.active} active</span>
                {" · "}
                <span className="font-semibold text-red-700">{groupStatusCounts.expired} expired</span>
              </>
            ) : undefined
          }
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="w-48">
          <ReportCardMonthSelect basePath="/reports" monthKey={monthKey} />
        </div>
        <div className="flex gap-2">
          {team.length > 0 && (
            <Link
              href="/team-report"
              target="_blank"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-sm font-medium text-ink hover:bg-muted"
            >
              <FileText className="h-4 w-4" /> Print team report
            </Link>
          )}
          <ExportSalesCsvButton personalTotals={personalTotals} groupTotals={groupTotals} />
        </div>
      </div>
      <SalesComparison personalTotals={personalTotals} groupTotals={groupTotals} groupStatusCounts={groupStatusCounts} />
      <UnitProductionTable team={team} units={units} />

      <PersonalProductionReport entries={personalEntries} title="My Production" />
      {team.length > 0 && <PersonalProductionReport entries={groupEntries} title="My Total Group Production" />}
      {team.length > 0 && <TopProducersTable producers={team} />}
      {team.length > 0 && <TeamTrafficLightTable rows={teamScores} monthLabel={monthLabel(monthKey)} />}

      <ComingSoon title="Reports (full customizable builder)" phase={2} />
    </div>
  );
}
