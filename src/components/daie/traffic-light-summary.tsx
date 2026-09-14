import { Card, CardContent } from "@/components/ui/card";
import { ProgressBar } from "@/components/daie/progress-bar";
import { TrafficLightDot } from "@/components/daie/traffic-light-dot";
import { formatRM } from "@/lib/utils";
import type { MonthlyScore } from "@/lib/scoring";

export function TrafficLightSummary({ score, title = "This Month's Traffic Light" }: { score: MonthlyScore; title?: string }) {
  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
            <p className="font-[family-name:var(--font-display)] text-2xl font-extrabold text-ink">{score.total} / 100</p>
          </div>
          <TrafficLightDot color={score.color} size="lg" withLabel />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <ProgressBar
            label={`Training (${score.training.count}/${score.training.target} sessions)`}
            value={score.training.points}
            max={25}
            accent={score.training.points ? "success" : "primary"}
            formatValue={(n) => `${n} pts`}
          />
          <ProgressBar
            label={`Reach (${score.reach.count}/${score.reach.target})`}
            value={score.reach.points}
            max={25}
            accent={score.reach.points ? "success" : "primary"}
            formatValue={(n) => `${n} pts`}
          />
          <ProgressBar
            label={`Presentations (${score.presentations.count}/${score.presentations.target})`}
            value={score.presentations.points}
            max={25}
            accent={score.presentations.points ? "success" : "primary"}
            formatValue={(n) => `${n} pts`}
          />
          <ProgressBar
            label={`Closed sales (${formatRM(score.sales.amount)} / ${formatRM(score.sales.target)})`}
            value={score.sales.points}
            max={25}
            accent={score.sales.points ? "success" : "primary"}
            formatValue={(n) => `${n} pts`}
          />
        </div>
      </CardContent>
    </Card>
  );
}
