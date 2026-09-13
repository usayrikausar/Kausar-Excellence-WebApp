import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiTile } from "@/components/daie/kpi-tile";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatRM, formatDate } from "@/lib/utils";
import { computeMonthlyBreakdown, findHighestMonth, findBiggestCase } from "@/lib/analytics";
import { TrendingUp, Award } from "lucide-react";
import type { SaleEntry } from "@/lib/types";

function monthLabel(month: string): string {
  const [year, m] = month.split("-");
  return new Date(Number(year), Number(m) - 1, 1).toLocaleDateString("en-MY", { month: "long", year: "numeric" });
}

/** Month-by-month Perancangan/Wasitah/Pusaka breakdown plus "highest month" and "biggest case" callouts — answers "when was my best month" and "what's my biggest case" from raw sale entries, not just a lump total. */
export function PersonalProductionReport({ entries, title }: { entries: SaleEntry[]; title: string }) {
  const rows = computeMonthlyBreakdown(entries);
  const highestMonth = findHighestMonth(rows);
  const biggestPerancangan = findBiggestCase(entries, "perancangan");
  const biggestPusaka = findBiggestCase(entries, "kesPusaka");
  const biggestOverall =
    biggestPerancangan && (!biggestPusaka || (biggestPerancangan.amount ?? 0) >= (biggestPusaka.amount ?? 0))
      ? { entry: biggestPerancangan, label: "Perancangan" }
      : biggestPusaka
        ? { entry: biggestPusaka, label: "Kes Pusaka" }
        : null;

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No entries yet — add a sale to see your monthly production here.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <KpiTile
          label="Highest month"
          value={highestMonth ? monthLabel(highestMonth.month) : "—"}
          icon={TrendingUp}
          accent="success"
          subtitle={highestMonth ? `${formatRM(highestMonth.perancangan)} in Perancangan` : undefined}
        />
        <KpiTile
          label="Biggest case"
          value={biggestOverall ? formatRM(biggestOverall.entry.amount ?? 0) : "—"}
          icon={Award}
          accent="accent"
          subtitle={biggestOverall ? `${biggestOverall.label} · ${formatDate(biggestOverall.entry.date)}` : undefined}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{title} — by month</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Perancangan</TableHead>
                <TableHead className="text-right">Wasitah (cases)</TableHead>
                <TableHead className="text-right">Pusaka</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...rows].reverse().map((row) => (
                <TableRow key={row.month} className={row.month === highestMonth?.month ? "bg-accent/45" : undefined}>
                  <TableCell className="font-medium">{monthLabel(row.month)}</TableCell>
                  <TableCell className="text-right">{formatRM(row.perancangan)}</TableCell>
                  <TableCell className="text-right">{row.pengurusanBerlian + row.pengurusanMutiara}</TableCell>
                  <TableCell className="text-right">{formatRM(row.kesPusakaBesar + row.kesPusakaKecil)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
