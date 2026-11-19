import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { RecentEntry } from "@/lib/data";

/** The daie's last entries typed into the app — to check a record went in. */
export function RecentEntriesCard({ entries }: { entries: RecentEntry[] }) {
  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-base font-bold text-ink">Recent entries</h2>
          <p className="text-xs text-muted-foreground">The last {entries.length || 10} sales and payments you recorded in the app.</p>
        </div>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing recorded in the app yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {entries.map((e) => (
              <li key={`${e.kind}-${e.id}`} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{e.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(e.date)}
                    {e.replaced && " · replaced by the official sheet figures for that month"}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{e.value}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
