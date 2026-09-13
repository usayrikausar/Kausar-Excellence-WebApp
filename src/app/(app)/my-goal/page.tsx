import { requireDaie } from "@/lib/auth/session";
import { getContests, getContestProgressForUids, getGoal, getDownline, getSalesTotalsForUid } from "@/lib/data";
import { ContestCard } from "@/components/daie/contest-card";
import { GoalForm } from "@/components/daie/goal-form";
import { CreateContestForm } from "@/components/admin/create-contest-form";
import { EditContestDialog } from "@/components/admin/edit-contest-dialog";
import { Card, CardContent } from "@/components/ui/card";

export default async function MyGoalPage() {
  const user = await requireDaie();
  const downline = await getDownline(user);
  const uids = [user.uid, ...downline.map((m) => m.uid)];

  const [contests, progress, goal, personalTotals] = await Promise.all([
    getContests(),
    getContestProgressForUids(uids),
    getGoal(user.uid),
    getSalesTotalsForUid(user.uid),
  ]);

  const amountByContestAndUid = new Map<string, number>();
  for (const p of progress) amountByContestAndUid.set(`${p.contestId}_${p.uid}`, p.amount);

  function personalAmount(contestId: string) {
    return amountByContestAndUid.get(`${contestId}_${user.uid}`) ?? 0;
  }
  function groupAmount(contestId: string) {
    return uids.reduce((sum, uid) => sum + (amountByContestAndUid.get(`${contestId}_${uid}`) ?? 0), 0);
  }

  const wasiyyahContests = contests.filter((c) => c.section === "wasiyyah");
  const kausarContests = contests.filter((c) => c.section === "kausar");
  const personalSalesTotal = personalTotals.perancangan + personalTotals.kesPusakaBesar + personalTotals.kesPusakaKecil;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-ink">My Goal</h1>
        <p className="text-sm text-muted-foreground">Your contest & reward tracker, and your own sales/income goal.</p>
      </div>

      <GoalForm uid={user.uid} salesGoal={goal?.salesGoal ?? null} incomeGoal={goal?.incomeGoal ?? null} personalSalesTotal={personalSalesTotal} />

      {user.isGroupAdmin && (
        <div className="space-y-3">
          <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-ink">Manage contests</h2>
          <CreateContestForm createdBy={user.uid} />
        </div>
      )}

      <ContestSection
        title="Wasiyyah Contests"
        contests={wasiyyahContests}
        uid={user.uid}
        hasDownline={downline.length > 0}
        personalAmount={personalAmount}
        groupAmount={groupAmount}
        isGroupAdmin={user.isGroupAdmin}
      />

      <ContestSection
        title="Kausar Group Contests"
        contests={kausarContests}
        uid={user.uid}
        hasDownline={downline.length > 0}
        personalAmount={personalAmount}
        groupAmount={groupAmount}
        isGroupAdmin={user.isGroupAdmin}
      />
    </div>
  );
}

function ContestSection({
  title,
  contests,
  uid,
  hasDownline,
  personalAmount,
  groupAmount,
  isGroupAdmin,
}: {
  title: string;
  contests: Awaited<ReturnType<typeof getContests>>;
  uid: string;
  hasDownline: boolean;
  personalAmount: (contestId: string) => number;
  groupAmount: (contestId: string) => number;
  isGroupAdmin: boolean;
}) {
  return (
    <div className="space-y-3">
      <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-ink">{title}</h2>
      {contests.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">No contests running right now.</CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {contests.map((contest) => (
            <div key={contest.id} className="space-y-2">
              <ContestCard
                contest={contest}
                uid={uid}
                personalAmount={personalAmount(contest.id)}
                groupAmount={groupAmount(contest.id)}
                hasDownline={hasDownline}
              />
              {isGroupAdmin && (
                <div className="flex justify-end">
                  <EditContestDialog contest={contest} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
