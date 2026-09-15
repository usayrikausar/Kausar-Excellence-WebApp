import Link from "next/link";
import { FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrafficLightDot } from "@/components/daie/traffic-light-dot";
import { cn } from "@/lib/utils";
import { TRAFFIC_LIGHT_STYLES, type MonthlyScore } from "@/lib/scoring";

export interface TeamScoreRow {
  uid: string;
  name: string;
  daieId: string;
  score: MonthlyScore;
}

/**
 * For mentors/leaders — spot who needs coaching on the 4 key behaviors
 * before it shows up in the sales numbers. Rows are grouped by traffic-light
 * color band (all greens, then ambers, reds, blacks — like conditional-
 * formatting-sorted rows in a spreadsheet) rather than a flat numeric sort,
 * and each row is tinted with its own band's color so the whole team's
 * standing reads at a glance without having to read every number.
 */
export function TeamTrafficLightTable({ rows }: { rows: TeamScoreRow[] }) {
  const sorted = [...rows].sort((a, b) => {
    const orderDiff = TRAFFIC_LIGHT_STYLES[a.score.color].order - TRAFFIC_LIGHT_STYLES[b.score.color].order;
    if (orderDiff !== 0) return orderDiff;
    return b.score.total - a.score.total; // best-within-band first
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Team Traffic Light</CardTitle>
        <CardDescription>This month&rsquo;s behavior score for your downline — training, reach, presentations, PROSPER invites, closed sales.</CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {sorted.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No downline yet.</p>
        ) : (
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
                  <TableHead>Report card</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((row) => (
                  <TableRow key={row.uid} className={cn(TRAFFIC_LIGHT_STYLES[row.score.color].rowClassName)}>
                    <TableCell><TrafficLightDot color={row.score.color} withLabel /></TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="font-mono text-xs">{row.daieId}</TableCell>
                    <TableCell className="text-right">{row.score.training.points}</TableCell>
                    <TableCell className="text-right">{row.score.reach.points}</TableCell>
                    <TableCell className="text-right">{row.score.presentations.points}</TableCell>
                    <TableCell className="text-right">{row.score.prosperInvites.points}</TableCell>
                    <TableCell className="text-right">{row.score.sales.points}</TableCell>
                    <TableCell className="text-right font-semibold">{row.score.total}</TableCell>
                    <TableCell>
                      <Link href={`/report-card/${row.uid}?month=${row.score.monthKey}`} target="_blank" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                        <FileText className="h-3.5 w-3.5" /> Print
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
