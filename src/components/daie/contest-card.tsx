import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/daie/progress-bar";
import { ContestProgressForm } from "@/components/daie/contest-progress-form";
import { formatDate, formatRM } from "@/lib/utils";
import type { ContestDoc } from "@/lib/types";

export function ContestCard({
  contest,
  uid,
  personalAmount,
  groupAmount,
  hasDownline,
}: {
  contest: ContestDoc & { id: string };
  uid: string;
  personalAmount: number;
  /** Sum of the viewer's + their downline's self-reported amounts — only meaningful (and only shown) if hasDownline. */
  groupAmount: number;
  hasDownline: boolean;
}) {
  const maxTarget = contest.targets.reduce((max, t) => Math.max(max, t.amount), 0);
  const isOpen = new Date(contest.endDate) >= new Date(new Date().toDateString());

  return (
    <Card className="overflow-hidden">
      {contest.posterUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- emulator-hosted Storage URLs, same as bulletin-card.tsx
        <img src={contest.posterUrl} alt="" className="h-48 w-full object-cover" />
      )}
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">{contest.title}</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatDate(contest.startDate)} – {formatDate(contest.endDate)}
          </p>
        </div>
        <Badge variant={isOpen ? "success" : "muted"}>{isOpen ? "Open" : "Ended"}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="whitespace-pre-line text-sm text-foreground/80">{contest.requirements}</p>

        {contest.targets.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <tbody>
                {contest.targets.map((t, i) => (
                  <tr key={i} className={i > 0 ? "border-t border-border" : undefined}>
                    <td className="px-3 py-1.5 text-muted-foreground">{t.label}</td>
                    <td className="px-3 py-1.5 text-right font-semibold text-ink">{formatRM(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-sm font-semibold text-ink">🎁 {contest.rewardDescription}</p>

        {maxTarget > 0 && (
          <div className="space-y-3 rounded-lg bg-muted/50 p-3">
            <ProgressBar label="My progress" value={personalAmount} max={maxTarget} formatValue={formatRM} accent="primary" />
            {hasDownline && (
              <ProgressBar label="My group's progress" value={groupAmount} max={maxTarget} formatValue={formatRM} accent="accent" />
            )}
          </div>
        )}

        <ContestProgressForm contestId={contest.id} uid={uid} currentAmount={personalAmount} />
      </CardContent>
    </Card>
  );
}
