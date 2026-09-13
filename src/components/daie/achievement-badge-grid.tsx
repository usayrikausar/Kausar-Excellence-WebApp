import { Award } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { AchievementDoc } from "@/lib/types";

export function AchievementBadgeGrid({ achievements }: { achievements: Array<AchievementDoc & { id: string }> }) {
  if (achievements.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <Award className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No achievements yet — badges awarded by your admin will show up here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {achievements.map((a) => (
        <Card key={a.id}>
          <CardContent className="space-y-2 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Award className="h-5 w-5" />
            </div>
            <Badge variant="outline">{a.category}</Badge>
            <p className="font-[family-name:var(--font-display)] text-base font-bold text-ink">{a.title}</p>
            {a.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
            <p className="text-xs text-muted-foreground">{formatDate(a.dateAwarded)}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
