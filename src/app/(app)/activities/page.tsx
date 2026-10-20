import Link from "next/link";
import { requireDaie } from "@/lib/auth/session";
import {
  getProspectsForUid,
  getMonthlyScoreForUid,
  getMonthlyScoresForUids,
  pickViewedDaie,
  getUnits,
  canSwitchScope,
  resolveViewScope,
  scopeOptions,
  getScopeMembers,
} from "@/lib/data";
import { UNIT_LABELS } from "@/lib/constants";
import { currentMonthKey, type MonthKey, type TrafficLightColor } from "@/lib/scoring";
import { ScopeSwitcher } from "@/components/daie/scope-switcher";
import { UnitTrafficLightCounts } from "@/components/daie/unit-traffic-light-counts";
import { cn } from "@/lib/utils";
import { LogActivityForm } from "@/components/daie/log-activity-form";
import { NewProspectDialog } from "@/components/daie/new-prospect-dialog";
import { ActivitiesView } from "@/components/daie/activities-view";
import { ExportProspectsCsvButton } from "@/components/daie/export-prospects-csv-button";
import { ImportProspectsCsvDialog } from "@/components/daie/import-prospects-csv-dialog";
import { ActivityTargetCard } from "@/components/daie/activity-target-card";
import { TeamTrafficLightTable } from "@/components/daie/team-traffic-light-table";
import { DaiePicker } from "@/components/daie/daie-picker";
import { ReportCardMonthSelect } from "@/components/daie/report-card-month-select";

function monthLabel(monthKey: MonthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-MY", { month: "long", year: "numeric" });
}

export default async function ActivitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; daie?: string; report?: string; scope?: string }>;
}) {
  const user = await requireDaie();
  const { month: monthParam, daie: daieParam, report: reportParam, scope: scopeParamValue } = await searchParams;
  const monthKey: MonthKey = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonthKey();
  const scope = resolveViewScope(user, scopeParamValue);
  const totalsOnly = scope.kind === "overall";

  const [prospects, members, units] = await Promise.all([getProspectsForUid(user.uid), getScopeMembers(user, scope), getUnits()]);
  // Individual reports are only for people the viewer may open by name: in a
  // KDE's "Overall" view that's still just their own unit.
  const pickable = totalsOnly ? members.filter((m) => m.unitId === user.unitId) : members;
  const hasTeam = members.length > 0;
  const report = hasTeam && reportParam === "group" ? "group" : "individual";

  const viewed = pickViewedDaie(user, pickable, daieParam);
  const [viewedScore, teamScoresByUid] = await Promise.all([
    report === "individual" ? getMonthlyScoreForUid(viewed.uid, monthKey) : Promise.resolve(null),
    report === "group" ? getMonthlyScoresForUids((totalsOnly ? [user, ...members] : members).map((m) => m.uid), monthKey) : Promise.resolve(null),
  ]);
  const teamRows =
    teamScoresByUid && !totalsOnly
      ? members.map((m) => ({ uid: m.uid, name: m.name, daieId: m.daieId, score: teamScoresByUid.get(m.uid)! }))
      : [];
  // Overall: colour counts per unit, aggregated here so no names leave the server.
  const unitCounts =
    teamScoresByUid && totalsOnly
      ? Object.keys(UNIT_LABELS).map((unitId) => {
          const counts: Record<TrafficLightColor, number> = { green: 0, amber: 0, red: 0, black: 0 };
          for (const m of [user, ...members]) if (m.unitId === unitId) counts[teamScoresByUid.get(m.uid)!.color] += 1;
          return { unitId, counts };
        })
      : null;
  const pickerOptions = [user, ...pickable]
    .map((m) => ({ uid: m.uid, name: m.name, daieId: m.daieId, rank: m.rank }))
    .sort((a, b) => (a.uid === user.uid ? -1 : b.uid === user.uid ? 1 : a.name.localeCompare(b.name)));

  const tabHref = (r: "individual" | "group") => {
    const params = new URLSearchParams({ month: monthKey });
    if (scopeParamValue) params.set("scope", scopeParamValue);
    if (r === "group") params.set("report", "group");
    else if (viewed.uid !== user.uid) params.set("daie", viewed.uid);
    return `/activities?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-ink">Activities</h1>
          <p className="text-sm text-muted-foreground">Your PIPPPAS working diary — from first contact to closed case.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ExportProspectsCsvButton prospects={prospects} />
          <ImportProspectsCsvDialog uid={user.uid} prospects={prospects} />
          <NewProspectDialog uid={user.uid} />
        </div>
      </div>

      <section className="space-y-3">
        {canSwitchScope(user) && <ScopeSwitcher basePath="/activities" {...scopeOptions(user, scope, units)} />}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-ink">Activity report</h2>
            {hasTeam && (
              <div role="tablist" aria-label="Report type" className="flex gap-1 rounded-lg bg-muted p-1">
                {(["individual", "group"] as const).map((r) => (
                  <Link
                    key={r}
                    role="tab"
                    aria-selected={report === r}
                    href={tabHref(r)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                      report === r ? "bg-white text-ink shadow-sm" : "text-muted-foreground hover:text-ink",
                    )}
                  >
                    {r === "individual" ? "Individual" : "Group"}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {report === "individual" && pickable.length > 0 && (
              <DaiePicker basePath="/activities" selfUid={user.uid} selectedUid={viewed.uid} options={pickerOptions} />
            )}
            <div className="w-48">
              <ReportCardMonthSelect basePath="/activities" monthKey={monthKey} />
            </div>
          </div>
        </div>

        {report === "individual" && viewedScore && (
          <ActivityTargetCard
            uid={viewed.uid}
            name={viewed.uid === user.uid ? `${viewed.name} (me)` : `${viewed.name} · ${viewed.daieId} · ${viewed.rank}`}
            monthLabel={monthLabel(monthKey)}
            score={viewedScore}
          />
        )}
        {report === "group" && !unitCounts && <TeamTrafficLightTable rows={teamRows} monthLabel={monthLabel(monthKey)} />}
        {report === "group" && unitCounts && <UnitTrafficLightCounts rows={unitCounts} units={units} monthLabel={monthLabel(monthKey)} />}
      </section>

      <LogActivityForm uid={user.uid} />

      <ActivitiesView prospects={prospects} />
    </div>
  );
}
