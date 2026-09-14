import { Users } from "lucide-react";
import { requireDaie } from "@/lib/auth/session";
import { getSalesSummary, getSaleEntriesForUids, getTeamWithTotals, getMonthlyScoreForUid } from "@/lib/data";
import { currentMonthKey } from "@/lib/scoring";
import { KpiTile } from "@/components/daie/kpi-tile";
import { SalesComparison } from "@/components/daie/sales-totals";
import { ExportSalesCsvButton } from "@/components/daie/export-sales-csv-button";
import { PersonalProductionReport } from "@/components/daie/personal-production-report";
import { TopProducersTable } from "@/components/daie/top-producers-table";
import { TeamTrafficLightTable } from "@/components/daie/team-traffic-light-table";
import { ComingSoon } from "@/components/daie/coming-soon";

// The real Reports builder (fully customizable columns/sorting/filters,
// qualifiers, and — once Activities exists — PIPPPAS process/open-close case
// status) is bigger Phase 2 scope that needs its own design pass. This ships
// the concrete, buildable slice of that vision now: personal monthly
// production with highest-month/biggest-case highlights, and a sortable
// team ranking — both real, backed by actual sale entries, not placeholders.
// "Top clients" isn't here because no sale entry captures a client name yet
// — that needs a schema/form change first, not something to fake.
export default async function ReportsPage() {
  const user = await requireDaie();
  const [{ personalTotals, groupTotals, groupStatusCounts }, team] = await Promise.all([
    getSalesSummary(user),
    getTeamWithTotals(user),
  ]);
  const downlineCount = team.length;

  const [personalEntries, groupEntries] = await Promise.all([
    getSaleEntriesForUids([user.uid]),
    getSaleEntriesForUids([user.uid, ...team.map((m) => m.uid)]),
  ]);

  const monthKey = currentMonthKey();
  const teamScores = await Promise.all(
    team.map(async (member) => ({
      uid: member.uid,
      name: member.name,
      daieId: member.daieId,
      score: await getMonthlyScoreForUid(member.uid, monthKey),
    })),
  );

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

      <div className="flex justify-end">
        <ExportSalesCsvButton personalTotals={personalTotals} groupTotals={groupTotals} />
      </div>
      <SalesComparison personalTotals={personalTotals} groupTotals={groupTotals} groupStatusCounts={groupStatusCounts} />

      <PersonalProductionReport entries={personalEntries} title="My Production" />
      {team.length > 0 && <PersonalProductionReport entries={groupEntries} title="My Total Group Production" />}
      {team.length > 0 && <TopProducersTable producers={team} />}
      {team.length > 0 && <TeamTrafficLightTable rows={teamScores} />}

      <ComingSoon title="Reports (full customizable builder)" phase={2} />
    </div>
  );
}
