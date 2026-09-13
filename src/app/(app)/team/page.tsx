import { Users } from "lucide-react";
import { requireDaie } from "@/lib/auth/session";
import { getTeamWithTotals, getUnits, unitLabel } from "@/lib/data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiTile } from "@/components/daie/kpi-tile";
import { TeamView } from "@/components/daie/team-view";

export default async function TeamPage() {
  const user = await requireDaie();
  const [team, units] = await Promise.all([getTeamWithTotals(user), getUnits()]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-ink">My Team</h1>
        <p className="text-sm text-muted-foreground">
          {user.isGroupAdmin ? "Every daie across all 5 units." : `Your downline in ${unitLabel(user.unitId, units)}.`}
        </p>
      </div>

      <div className="max-w-xs">
        <KpiTile label="My recruitment total" value={String(team.length)} icon={Users} accent="accent" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Downline</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <TeamView
            team={team}
            rootUid={user.isGroupAdmin ? null : user.uid}
            viewerName={user.name}
            showUnit={user.isGroupAdmin}
            units={units}
          />
        </CardContent>
      </Card>
    </div>
  );
}
