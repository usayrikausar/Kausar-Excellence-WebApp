import Link from "next/link";
import { BadgeDollarSign, Users, Wallet, Megaphone } from "lucide-react";
import { requireDaie } from "@/lib/auth/session";
import {
  getSalesTotalsForUid,
  getDownline,
  getRecentBulletins,
  getThisMonthBulletinCount,
  getGoal,
  getContests,
  getContestProgressForUids,
  getGroupSalesByMonth,
  getUnits,
  canSwitchScope,
  resolveViewScope,
  scopeOptions,
} from "@/lib/data";
import { ScopeSwitcher } from "@/components/daie/scope-switcher";
import { GroupSalesDashboard } from "@/components/daie/group-sales-dashboard";
import { KONVENSYEN_PERIOD } from "@/lib/konvensyen";
import { currentMonthKey } from "@/lib/scoring";
import { HeroCarousel } from "@/components/daie/hero-carousel";
import { KpiTile } from "@/components/daie/kpi-tile";
import { BulletinCard } from "@/components/daie/bulletin-card";
import { ProgressBar } from "@/components/daie/progress-bar";
import { ExpiryRemindersCard } from "@/components/daie/expiry-reminders-card";
import { Card, CardContent } from "@/components/ui/card";
import { formatRM, isActiveStatus } from "@/lib/utils";

/** FY months (Wasiyyah's FY25/26 runs Jul 2025 – Dec 2026), oldest → newest, up to and including the current month. */
function fyMonthsToDate(): string[] {
  const start = KONVENSYEN_PERIOD.start.slice(0, 7);
  const end = [currentMonthKey(), KONVENSYEN_PERIOD.end.slice(0, 7)].sort()[0];
  const months: string[] = [];
  let [y, m] = start.split("-").map(Number);
  while (`${y}-${String(m).padStart(2, "0")}` <= end) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return months;
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const user = await requireDaie();
  const { scope: scopeParamValue } = await searchParams;
  // Group-wide figures are for Group Admin and KDE only (agreed 2026-10-20),
  // with an Overall / My group switcher.
  const showGroupDashboard = canSwitchScope(user);
  const scope = resolveViewScope(user, scopeParamValue);
  const fyMonths = fyMonthsToDate();

  const [totals, downline, recentBulletins, monthBulletinCount, goal, contests, groupSales, units] = await Promise.all([
    getSalesTotalsForUid(user.uid),
    getDownline(user),
    getRecentBulletins(3),
    getThisMonthBulletinCount(),
    getGoal(user.uid),
    getContests(),
    showGroupDashboard ? getGroupSalesByMonth(fyMonths[0]) : Promise.resolve(null),
    showGroupDashboard ? getUnits() : Promise.resolve(null),
  ]);

  const personalSalesTotal = totals.perancangan + totals.kesPusakaBesar + totals.kesPusakaKecil;
  const activeCount = downline.filter(isActiveStatus).length;
  const expiredCount = downline.length - activeCount;

  // "My Goal" summary: the daie's own sales goal if they've set one, else the
  // personal progress bar for whichever open contest ends soonest (contests
  // already come back sorted by endDate asc from getContests()).
  const nearestOpenContest = contests.find((c) => new Date(c.endDate) >= new Date(new Date().toDateString()));
  let goalSummary: { label: string; value: number; max: number } | null = null;
  if (goal?.salesGoal) {
    goalSummary = { label: "Sales goal progress", value: personalSalesTotal, max: goal.salesGoal };
  } else if (nearestOpenContest) {
    const maxTarget = nearestOpenContest.targets.reduce((max, t) => Math.max(max, t.amount), 0);
    if (maxTarget > 0) {
      const progress = await getContestProgressForUids([user.uid]);
      const amount = progress.find((p) => p.contestId === nearestOpenContest.id)?.amount ?? 0;
      goalSummary = { label: nearestOpenContest.title, value: amount, max: maxTarget };
    }
  }

  return (
    <div className="space-y-6">
      <HeroCarousel />

      {groupSales && units && fyMonths.length > 0 && (
        <div className="space-y-3">
          <ScopeSwitcher basePath="/" {...scopeOptions(user, scope, units)} />
          <GroupSalesDashboard
            rows={groupSales}
            months={fyMonths}
            unitLabels={units}
            fyLabel="FY25/26"
            onlyUnitId={scope.kind === "unit" ? scope.unitId : undefined}
          />
        </div>
      )}

      <ExpiryRemindersCard self={user} downline={downline} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile label="My sales total" value={formatRM(personalSalesTotal)} icon={BadgeDollarSign} accent="primary" />
        <KpiTile label="My collection total" value={formatRM(totals.collectionTotal)} icon={Wallet} accent="success" />
        <KpiTile
          label="Team size"
          value={String(downline.length)}
          icon={Users}
          accent="accent"
          subtitle={
            downline.length > 0 ? (
              <>
                <span className="font-semibold text-success">{activeCount} active</span>
                {" · "}
                <span className="font-semibold text-red-700">{expiredCount} expired</span>
              </>
            ) : undefined
          }
        />
        <KpiTile label="Bulletins this month" value={String(monthBulletinCount)} icon={Megaphone} accent="primary" />
      </div>

      {goalSummary && (
        <Card>
          <CardContent className="space-y-3 p-5">
            <div className="flex items-center justify-between">
              <h2 className="font-[family-name:var(--font-display)] text-base font-bold text-ink">My Goal</h2>
              <Link href="/my-goal" className="text-sm font-semibold text-primary hover:underline">
                View My Goal
              </Link>
            </div>
            <ProgressBar label={goalSummary.label} value={goalSummary.value} max={goalSummary.max} formatValue={formatRM} accent="success" />
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-ink">Latest from Bulletin</h2>
          <Link href="/bulletin" className="text-sm font-semibold text-primary hover:underline">
            View all
          </Link>
        </div>
        {recentBulletins.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            No bulletin posts yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recentBulletins.map((b) => (
              <BulletinCard key={b.id} bulletin={b} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
