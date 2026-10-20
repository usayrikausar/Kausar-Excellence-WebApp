"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaginationFooter } from "@/components/ui/pagination-footer";
import { TrafficLightDot } from "@/components/daie/traffic-light-dot";
import { cn, formatRM } from "@/lib/utils";
import {
  TRAFFIC_LIGHT_STYLES,
  criteriaStatus,
  criteriaNeededForGreen,
  type MonthlyScore,
  type TrafficLightColor,
} from "@/lib/scoring";

export interface TeamScoreRow {
  uid: string;
  name: string;
  daieId: string;
  score: MonthlyScore;
}

const PAGE_SIZE = 25;
const COLORS: TrafficLightColor[] = ["green", "amber", "red", "black"];

/**
 * For mentors/leaders — spot who needs coaching on the key behaviours
 * before it shows up in the sales numbers. Rows are grouped by traffic-light
 * colour band (all greens, then ambers, reds, blacks — like conditional-
 * formatting-sorted rows in a spreadsheet), each cell shows done/target with
 * the shortfall, and "To green" says how many more criteria that daie needs.
 * Paged so a KDE's whole unit doesn't become one endless scroll; the colour
 * chips at the top filter the list.
 */
export function TeamTrafficLightTable({ rows, monthLabel }: { rows: TeamScoreRow[]; monthLabel?: string }) {
  const [page, setPage] = useState(1);
  const [colorFilter, setColorFilter] = useState<TrafficLightColor | null>(null);

  const sorted = [...rows].sort((a, b) => {
    const orderDiff = TRAFFIC_LIGHT_STYLES[a.score.color].order - TRAFFIC_LIGHT_STYLES[b.score.color].order;
    if (orderDiff !== 0) return orderDiff;
    return b.score.total - a.score.total; // best-within-band first
  });
  const counts = Object.fromEntries(COLORS.map((c) => [c, rows.filter((r) => r.score.color === c).length])) as Record<TrafficLightColor, number>;
  const filtered = colorFilter ? sorted.filter((r) => r.score.color === colorFilter) : sorted;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Traffic Light</CardTitle>
        <CardDescription>
          {monthLabel ?? "This month"}&rsquo;s behaviour score for your downline — training, reach, presentations, PROSPER invites, closed sales. Green needs 4 of 5.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No downline yet.</p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 px-6 pb-4">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setColorFilter(colorFilter === c ? null : c);
                    setPage(1);
                  }}
                  aria-pressed={colorFilter === c}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold transition-colors",
                    colorFilter === c ? "border-ink bg-ink text-white" : "border-border bg-white text-ink hover:bg-muted",
                  )}
                >
                  <TrafficLightDot color={c} /> {TRAFFIC_LIGHT_STYLES[c].label} · {counts[c]}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Daie ID</TableHead>
                    <TableHead className="text-right">Training</TableHead>
                    <TableHead className="text-right">Reach</TableHead>
                    <TableHead className="text-right">Presentations</TableHead>
                    <TableHead className="text-right">PROSPER</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>To green</TableHead>
                    <TableHead>Report card</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((row) => {
                    const needed = criteriaNeededForGreen(row.score);
                    return (
                      <TableRow key={row.uid} className={cn(TRAFFIC_LIGHT_STYLES[row.score.color].rowClassName)}>
                        <TableCell><TrafficLightDot color={row.score.color} withLabel /></TableCell>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="font-mono text-xs">{row.daieId}</TableCell>
                        {criteriaStatus(row.score).map((c) => (
                          <TableCell key={c.key} className="whitespace-nowrap text-right text-xs tabular-nums">
                            {c.isMoney ? formatRM(c.done) : c.done}/{c.isMoney ? formatRM(c.target) : c.target}{" "}
                            <span className={cn("font-bold", c.met ? "text-success" : "text-red-700")}>{c.met ? "✓" : "✗"}</span>
                          </TableCell>
                        ))}
                        <TableCell className="text-right font-semibold">{row.score.total}</TableCell>
                        <TableCell className="whitespace-nowrap text-xs">
                          {needed === 0 ? <span className="font-semibold text-success">Green</span> : `${needed} more criteria`}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/report-card/${row.uid}?month=${row.score.monthKey}&view=activities`}
                            target="_blank"
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                          >
                            <FileText className="h-3.5 w-3.5" /> Print
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && <PaginationFooter page={currentPage} totalPages={totalPages} onPageChange={setPage} />}
          </>
        )}
      </CardContent>
    </Card>
  );
}
