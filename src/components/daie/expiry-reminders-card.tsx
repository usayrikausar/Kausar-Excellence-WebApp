import Link from "next/link";
import { AlarmClock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { contractExpiryDate, daysUntilExpiry, isExpiryReminderDue, EXPIRY_REMINDER_URGENT_DAYS } from "@/lib/utils";
import type { CurrentUser } from "@/lib/types";

/**
 * Renewal reminders, 6 and 3 months out — no separate notification store:
 * dateExpiry is already on every daie's own doc, so this is computed at
 * render time from data the page already fetched. Shown to everyone in the
 * chain for free, since each level's own downline query already includes
 * everyone below them: a DM sees their own reminder here, their DPM sees the
 * same DM in "downline expiring soon", and so does their KDE.
 */
export function ExpiryRemindersCard({ self, downline }: { self: CurrentUser; downline: CurrentUser[] }) {
  const selfDue = isExpiryReminderDue(self);
  const downlineDue = downline
    .filter(isExpiryReminderDue)
    .sort((a, b) => (daysUntilExpiry(a) ?? 0) - (daysUntilExpiry(b) ?? 0));

  if (!selfDue && downlineDue.length === 0) return null;

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

        {downlineDue.length > 0 && (
          <div className="space-y-1.5">
            {selfDue && <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Downline expiring soon</p>}
            {downlineDue.map((member) => (
              <ReminderRow
                key={member.uid}
                label={`${member.name} (${member.daieId})`}
                days={daysUntilExpiry(member)!}
                date={contractExpiryDate(member)!}
              />
            ))}
          </div>
        )}

        <Link href="/team" className="inline-block text-sm font-semibold text-primary hover:underline">
          View My Team
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
