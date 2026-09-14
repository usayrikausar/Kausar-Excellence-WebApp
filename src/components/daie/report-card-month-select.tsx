"use client";

import { useRouter } from "next/navigation";
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

/** `basePath` is the route to navigate to with `?month=` appended — e.g. `/report-card/{uid}` or `/team-report`. */
export function ReportCardMonthSelect({ basePath, monthKey }: { basePath: string; monthKey: MonthKey }) {
  const router = useRouter();
  const options = recentMonths(12);

  return (
    <Select value={monthKey} onValueChange={(v) => router.push(`${basePath}?month=${v}`)}>
      <SelectTrigger className="print:hidden"><SelectValue /></SelectTrigger>
      <SelectContent>
        {(options.includes(monthKey) ? options : [monthKey, ...options]).map((mk) => (
          <SelectItem key={mk} value={mk}>{monthLabel(mk)}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
