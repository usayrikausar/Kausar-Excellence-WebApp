import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrafficLightDot } from "@/components/daie/traffic-light-dot";
import { unitLabel } from "@/lib/constants";
import { TRAFFIC_LIGHT_STYLES, type TrafficLightColor } from "@/lib/scoring";

const COLORS: TrafficLightColor[] = ["green", "amber", "red", "black"];

/**
 * Traffic-light colour counts per unit — the totals-only "Overall" group
 * activity report for a KDE (no other unit's daie by name). Rows are
 * aggregated on the server; only counts reach the browser.
 */
export function UnitTrafficLightCounts({
  rows,
  units,
  monthLabel,
}: {
  rows: Array<{ unitId: string; counts: Record<TrafficLightColor, number> }>;
  units: Record<string, string>;
  monthLabel: string;
}) {
  const total = (c: Record<TrafficLightColor, number>) => COLORS.reduce((s, k) => s + c[k], 0);
  const sum = COLORS.reduce((acc, k) => ({ ...acc, [k]: rows.reduce((s, r) => s + r.counts[k], 0) }), {} as Record<TrafficLightColor, number>);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Kausar Group traffic light</CardTitle>
        <CardDescription>{monthLabel} — how many daie in each unit are green, amber, red or black. Green needs 4 of 5 criteria.</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unit</TableHead>
              {COLORS.map((c) => (
                <TableHead key={c} className="text-right">
                  <span className="inline-flex items-center gap-1.5"><TrafficLightDot color={c} /> {TRAFFIC_LIGHT_STYLES[c].label}</span>
                </TableHead>
              ))}
              <TableHead className="text-right">Daie</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="tabular-nums">
            {rows.map((r) => (
              <TableRow key={r.unitId}>
                <TableCell className="font-medium">{unitLabel(r.unitId, units)}</TableCell>
                {COLORS.map((c) => <TableCell key={c} className="text-right">{r.counts[c]}</TableCell>)}
                <TableCell className="text-right text-muted-foreground">{total(r.counts)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="font-bold">
              <TableCell>Kausar Group</TableCell>
              {COLORS.map((c) => <TableCell key={c} className="text-right">{sum[c]}</TableCell>)}
              <TableCell className="text-right">{total(sum)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
