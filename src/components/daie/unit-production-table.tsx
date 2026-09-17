import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { unitLabel } from "@/lib/constants";
import { formatRM } from "@/lib/utils";

interface UnitRow {
  unitId: string;
  salesTotal: number;
  collectionTotal: number;
  wasitahTotal: number;
  pusakaTotal: number;
  count: number;
}

/**
 * Career-to-date production broken out per unit — only meaningful for
 * whoever's downline spans more than one unit (a Group Admin sees all 5;
 * a KDE's own downline is already a single unit, so this quietly renders
 * nothing extra for them rather than a one-row table that repeats what
 * "My Total Group Production" already shows).
 */
export function UnitProductionTable({
  team,
  units,
}: {
  team: Array<{ unitId: string; salesTotal: number; collectionTotal: number; wasitahTotal: number; pusakaTotal: number }>;
  units: Record<string, string>;
}) {
  const byUnit = new Map<string, UnitRow>();
  for (const member of team) {
    const row = byUnit.get(member.unitId) ?? { unitId: member.unitId, salesTotal: 0, collectionTotal: 0, wasitahTotal: 0, pusakaTotal: 0, count: 0 };
    row.salesTotal += member.salesTotal;
    row.collectionTotal += member.collectionTotal;
    row.wasitahTotal += member.wasitahTotal;
    row.pusakaTotal += member.pusakaTotal;
    row.count += 1;
    byUnit.set(member.unitId, row);
  }
  const rows = [...byUnit.values()].sort((a, b) => b.salesTotal - a.salesTotal);

  if (rows.length <= 1) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Group Sales by Unit</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Daie</TableHead>
              <TableHead className="text-right">Perancangan</TableHead>
              <TableHead className="text-right">Wasitah (cases)</TableHead>
              <TableHead className="text-right">Pusaka</TableHead>
              <TableHead className="text-right">Collection</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.unitId}>
                <TableCell className="font-medium">{unitLabel(row.unitId, units)}</TableCell>
                <TableCell className="text-right text-muted-foreground">{row.count}</TableCell>
                <TableCell className="text-right">{formatRM(row.salesTotal)}</TableCell>
                <TableCell className="text-right">{row.wasitahTotal}</TableCell>
                <TableCell className="text-right">{formatRM(row.pusakaTotal)}</TableCell>
                <TableCell className="text-right">{formatRM(row.collectionTotal)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="px-4 py-3 text-xs text-muted-foreground">Career-to-date totals (not scoped to the month above) — same basis as &ldquo;My Total Group Production&rdquo;.</p>
      </CardContent>
    </Card>
  );
}
