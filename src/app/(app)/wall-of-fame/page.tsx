import { requireDaie } from "@/lib/auth/session";
import { getAchievementsForUid, getAllUsers } from "@/lib/data";
import { AchievementBadgeGrid } from "@/components/daie/achievement-badge-grid";
import { AwardAchievementForm } from "@/components/admin/award-achievement-form";

export default async function WallOfFamePage() {
  const user = await requireDaie();
  const [achievements, users] = await Promise.all([
    getAchievementsForUid(user.uid),
    user.isGroupAdmin ? getAllUsers() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-ink">My Wall of Fame</h1>
        <p className="text-sm text-muted-foreground">
          Top category of the month, trip targets hit, OSAK completion pins, and every other milestone awarded to you.
        </p>
      </div>

      {user.isGroupAdmin && <AwardAchievementForm users={users} awardedBy={user.uid} />}

      <AchievementBadgeGrid achievements={achievements} />
    </div>
  );
}
