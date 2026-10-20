import Link from "next/link";
import { Printer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TrafficLightDot } from "@/components/daie/traffic-light-dot";
import { cn, formatRM } from "@/lib/utils";
import { criteriaStatus, criteriaNeededForGreen, type MonthlyScore } from "@/lib/scoring";

/**
 * One daie's activity report for a month: each of the 5 traffic-light
 * criteria as done vs target, and exactly what's still missing to turn
 * green (75+ = at least 4 of 5 criteria met) — so a mentor can coach on the
 * specific gap, not just the colour.
 */
export function ActivityTargetCard({
  uid,
  name,
  monthLabel,
  score,
}: {
  uid: string;
  name: string;
  monthLabel: string;
  score: MonthlyScore;
}) {
  const criteria = criteriaStatus(score);
  const needed = criteriaNeededForGreen(score);
  const fmt = (n: number, money: boolean) => (money ? formatRM(n) : n.toLocaleString());
  const missing = criteria.filter((c) => !c.met);

  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-ink">Activity report · {monthLabel}</h2>
            <p className="truncate text-sm text-muted-foreground">{name}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="font-[family-name:var(--font-display)] text-2xl font-extrabold text-ink">{score.total}<span className="text-sm text-muted-foreground"> / 100</span></p>
            </div>
            <TrafficLightDot color={score.color} size="lg" withLabel />
          </div>
        </div>

        <div
          className={cn(
            "rounded-lg border p-3 text-sm",
            needed === 0 ? "border-success/40 bg-success/10 text-ink" : "border-accent/50 bg-accent/15 text-ink",
          )}
        >
          {needed === 0 ? (
            <span className="font-semibold">Green — {criteria.filter((c) => c.met).length} of 5 criteria met.</span>
          ) : (
            <>
              <span className="font-semibold">
                To turn green: meet {needed} more {needed === 1 ? "criterion" : "criteria"}
              </span>{" "}
              (need 4 of 5). Still open: {missing.map((c) => `${c.label} — ${fmt(c.remaining, c.isMoney)} more`).join("; ")}.
            </>
          )}
        </div>

        <div className="space-y-3">
          {criteria.map((c) => {
            const pct = c.target > 0 ? Math.min(100, Math.round((c.done / c.target) * 100)) : 0;
            return (
              <div key={c.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 sm:grid-cols-[140px_minmax(0,1fr)_170px]">
                <span className="text-sm font-semibold text-ink">{c.label}</span>
                <span className="text-right text-xs tabular-nums text-muted-foreground sm:order-3">
                  {fmt(c.done, c.isMoney)} / {fmt(c.target, c.isMoney)}{" "}
                  <span className={cn("font-bold", c.met ? "text-success" : "text-red-700")}>{c.met ? "✓" : `−${fmt(c.remaining, c.isMoney)}`}</span>
                </span>
                <div className="col-span-2 h-2 overflow-hidden rounded-full bg-muted sm:order-2 sm:col-span-1">
                  <div className={cn("h-full rounded-full", c.met ? "bg-success" : "bg-red-600")} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <Link
          href={`/report-card/${uid}?month=${score.monthKey}&view=activities`}
          target="_blank"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <Printer className="h-4 w-4" /> Print activity report card
        </Link>
      </CardContent>
    </Card>
  );
}
