import { Users } from "lucide-react";
import { requireDaie } from "@/lib/auth/session";
import {
  getTeamWithTotalsFor,
  getUnits,
  unitLabel,
  canSwitchScope,
  resolveViewScope,
  scopeOptions,
  getScopeMembers,
  getUsersByUids,
} from "@/lib/data";
import { UNIT_LABELS } from "@/lib/constants";
import { isActiveStatus } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { KpiTile } from "@/components/daie/kpi-tile";
import { TeamView } from "@/components/daie/team-view";
import { ScopeSwitcher } from "@/components/daie/scope-switcher";

const STATUS_FILTERS = ["all", "active", "expired", "expiring6", "expiring3"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ scope?: string; status?: string }> }) {
  const user = await requireDaie();
  const { scope: scopeParamValue, status: statusParam } = await searchParams;
  const initialStatus: StatusFilter = STATUS_FILTERS.includes(statusParam as StatusFilter) ? (statusParam as StatusFilter) : "all";
  const scope = resolveViewScope(user, scopeParamValue);
  const [members, units] = await Promise.all([getScopeMembers(user, scope), getUnits()]);

  const switcher = canSwitchScope(user) ? <ScopeSwitcher basePath="/team" {...scopeOptions(user, scope, units)} /> : null;

  // KDE "Overall": head counts per unit only — no other unit's daie by name.
  if (scope.kind === "overall") {
    const everyone = [user, ...members];
    const rows = Object.keys(UNIT_LABELS).map((unitId) => {
      const inUnit = everyone.filter((m) => m.unitId === unitId);
      const active = inUnit.filter(isActiveStatus).length;
      return { unitId, total: inUnit.length, active, expired: inUnit.length - active };
    });
    const sum = rows.reduce((a, r) => ({ total: a.total + r.total, active: a.active + r.active, expired: a.expired + r.expired }), { total: 0, active: 0, expired: 0 });
    return (
      <div className="space-y-6">
        {switcher}
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-ink">Kausar Group</h1>
          <p className="text-sm text-muted-foreground">Head count across all 5 units. Switch to My group to see your unit&rsquo;s daie.</p>
        </div>
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Daie</TableHead>
                  <TableHead className="text-right">Active</TableHead>
                  <TableHead className="text-right">Expired</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.unitId}>
                    <TableCell className="font-medium">{unitLabel(r.unitId, units)}</TableCell>
                    <TableCell className="text-right">{r.total}</TableCell>
                    <TableCell className="text-right text-success">{r.active}</TableCell>
                    <TableCell className="text-right text-red-700">{r.expired}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold">
                  <TableCell>Kausar Group</TableCell>
                  <TableCell className="text-right">{sum.total}</TableCell>
                  <TableCell className="text-right text-success">{sum.active}</TableCell>
                  <TableCell className="text-right text-red-700">{sum.expired}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  const team = await getTeamWithTotalsFor(members);
  // Uplines that sit outside this list (the viewer, or a cross-unit
  // introducer) still get a name in the Upline column.
  const inTeam = new Set(team.map((m) => m.uid));
  const outsideIds = [...new Set(team.map((m) => m.uplineId).filter((id): id is string => !!id && !inTeam.has(id)))];
  const outsideNames = Object.fromEntries((await getUsersByUids(outsideIds)).map((u) => [u.uid, u.name]));

  const description =
    scope.kind === "unit"
      ? `Every daie filed under ${unitLabel(scope.unitId, units)}.`
      : scope.kind === "all"
        ? "Every daie across all 5 units."
        : `Your downline in ${unitLabel(user.unitId, units)}.`;

  return (
    <div className="space-y-6">
      {switcher}
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-ink">My Team</h1>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="max-w-xs">
        <KpiTile label={scope.kind === "lineage" ? "My recruitment total" : "Daie in view"} value={String(team.length)} icon={Users} accent="accent" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{scope.kind === "lineage" ? "Downline" : "Daie"}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <TeamView
            team={team}
            rootUid={scope.kind === "lineage" ? user.uid : null}
            viewerName={user.name}
            outsideNames={outsideNames}
            showUnit={scope.kind === "all"}
            units={units}
            initialStatus={initialStatus}
          />
        </CardContent>
      </Card>
    </div>
  );
}
