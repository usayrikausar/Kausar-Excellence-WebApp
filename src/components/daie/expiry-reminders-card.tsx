import Link from "next/link";
import { AlarmClock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { contractExpiryDate, daysUntilExpiry, isExpiryReminderDue, EXPIRY_REMINDER_URGENT_DAYS } from "@/lib/utils";
import type { CurrentUser } from "@/lib/types";

/**
 * Renewal reminder, 6 and 3 months out — no separate notification store:
 * dateExpiry is already on every daie's own doc, so this is computed at
 * render time from data the page already fetched.
 *
 * Home shows ONLY the viewer's own contract, not a per-person downline
 * list — for a KDE with hundreds of people, enumerating everyone nearing
 * expiry here swarmed the dashboard. The full, per-person downline detail
 * (who's expiring, when) already lives on My Team, highlighted in its
 * "Date expiry" column — this card just points there with a count so
 * nothing gets missed without listing every name twice.
 */
export function ExpiryRemindersCard({ self, downline }: { self: CurrentUser; downline: CurrentUser[] }) {
  const selfDue = isExpiryReminderDue(self);
  const downlineDueCount = downline.filter(isExpiryReminderDue).length;

  if (!selfDue && downlineDueCount === 0) return null;

  return (
    <Card className="border-accent/40 bg-accent/5">
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center gap-2">
          <AlarmClock className="h-4 w-4 text-accent" />
          <h2 className="font-[family-name:var(--font-display)] text-base font-bold text-ink">Contract renewal reminders</h2>
        </div>

        {selfDue && (
          <ReminderRow
            label="Your Wasiyyah contract"
            days={daysUntilExpiry(self)!}
            date={contractExpiryDate(self)!}
          />
        )}

        {downlineDueCount > 0 && (
          <p className="text-sm text-ink">
            <span className="font-semibold">{downlineDueCount}</span> team member{downlineDueCount === 1 ? "" : "s"} in your downline
            {downlineDueCount === 1 ? " has" : " have"} a contract expiring within 6 months.
          </p>
        )}

        <Link href="/team" className="inline-block text-sm font-semibold text-primary hover:underline">
          {downlineDueCount > 0 ? "View details on My Team" : "View My Team"}
        </Link>
      </CardContent>
    </Card>
  );
}

function ReminderRow({ label, days, date }: { label: string; days: number; date: Date }) {
  const urgent = days <= EXPIRY_REMINDER_URGENT_DAYS;
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-ink">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">expires {formatDate(date)}</span>
        <Badge variant={urgent ? "destructive" : "muted"}>{days} day{days === 1 ? "" : "s"} left</Badge>
      </div>
    </div>
  );
}
