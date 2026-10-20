"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MonthKey } from "@/lib/scoring";

function monthLabel(monthKey: MonthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-MY", { month: "long", year: "numeric" });
}

/** Last `count` months ending at (and including) the current real month, newest first — independent of whatever month is currently being viewed. */
function recentMonths(count: number): MonthKey[] {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

/**
 * `basePath` is the route to navigate to with `?month=` set — e.g.
 * `/report-card/{uid}` or `/team-report`. Any other query params already on
 * the page (e.g. the `daie` picked on Sales/Activities) are kept.
 */
export function ReportCardMonthSelect({ basePath, monthKey }: { basePath: string; monthKey: MonthKey }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const options = recentMonths(12);

  function go(month: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", month);
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <Select value={monthKey} onValueChange={go}>
      <SelectTrigger className="print:hidden"><SelectValue /></SelectTrigger>
      <SelectContent>
        {(options.includes(monthKey) ? options : [monthKey, ...options]).map((mk) => (
          <SelectItem key={mk} value={mk}>{monthLabel(mk)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
