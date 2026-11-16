"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { currentMonthKey } from "@/lib/scoring";
import { FY_FROM, monthLabel, monthsBetween, shiftMonth, type Period, type PeriodKind } from "@/lib/period";

const QUICK: Array<{ kind: Exclude<PeriodKind, "month" | "custom">; label: string }> = [
  { kind: "last3", label: "Last 3 months" },
  { kind: "last6", label: "Last 6 months" },
  { kind: "ytd", label: "Year to date" },
  { kind: "fy", label: "FY25/26 (Jul 2025 – Dec 2026)" },
];

/**
 * Period picker for the sales report cards: a month, a quick pick, or a
 * custom From–To range of whole months. Navigates to `basePath` with the
 * period in the query, keeping other params (e.g. `daie`, `view`).
 */
export function ReportPeriodSelect({ basePath, period }: { basePath: string; period: Period }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const now = currentMonthKey();
  const months = monthsBetween(FY_FROM < shiftMonth(now, -11) ? FY_FROM : shiftMonth(now, -11), now).reverse();
  const [editing, setEditing] = useState(period.kind === "custom");
  const [from, setFrom] = useState(period.from);
  const [to, setTo] = useState(period.to);

  function go(next: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const k of ["month", "period", "from", "to"]) params.delete(k);
    for (const [k, v] of Object.entries(next)) params.set(k, v);
    router.push(`${basePath}?${params.toString()}`);
  }

  const value = period.kind === "month" ? `m:${period.from}` : period.kind;
  const monthOptions = period.kind !== "month" || months.includes(period.from) ? months : [period.from, ...months];

  return (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Select
        value={editing ? "custom" : value}
        onValueChange={(v) => {
          if (v === "custom") return setEditing(true);
          setEditing(false);
          go(v.startsWith("m:") ? { month: v.slice(2) } : { period: v });
        }}
      >
        <SelectTrigger id="report-period" className="w-64" aria-label="Report period"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Quick picks</SelectLabel>
            {QUICK.map((q) => <SelectItem key={q.kind} value={q.kind}>{q.label}</SelectItem>)}
            <SelectItem value="custom">{period.kind === "custom" ? `Custom: ${monthLabel(period.from, "short")} – ${monthLabel(period.to, "short")}` : "Custom range…"}</SelectItem>
          </SelectGroup>
          <SelectGroup>
            <SelectLabel>Month</SelectLabel>
            {monthOptions.map((mk) => <SelectItem key={mk} value={`m:${mk}`}>{monthLabel(mk)}</SelectItem>)}
          </SelectGroup>
        </SelectContent>
      </Select>

      {editing && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-white p-1.5">
          <span className="pl-1 text-sm text-muted-foreground">From</span>
          <Select value={from} onValueChange={setFrom}>
            <SelectTrigger id="report-period-from" className="h-8 w-40" aria-label="From month"><SelectValue /></SelectTrigger>
            <SelectContent>{months.map((mk) => <SelectItem key={mk} value={mk}>{monthLabel(mk)}</SelectItem>)}</SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">To</span>
          <Select value={to} onValueChange={setTo}>
            <SelectTrigger id="report-period-to" className="h-8 w-40" aria-label="To month"><SelectValue /></SelectTrigger>
            <SelectContent>{months.map((mk) => <SelectItem key={mk} value={mk}>{monthLabel(mk)}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" onClick={() => go({ period: "custom", from, to })}>Apply</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      )}
    </div>
  );
}
