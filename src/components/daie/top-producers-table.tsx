"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn, formatRM } from "@/lib/utils";
import type { CurrentUser } from "@/lib/types";

type Producer = CurrentUser & {
  salesTotal: number;
  collectionTotal: number;
  wasitahTotal: number;
  pusakaTotal: number;
};

type SortKey = "salesTotal" | "wasitahTotal" | "pusakaTotal" | "collectionTotal";
const SORT_LABELS: Record<SortKey, string> = {
  salesTotal: "Sales",
  wasitahTotal: "Wasitah cases",
  pusakaTotal: "Pusaka",
  collectionTotal: "Collection",
};

function SortHeaderButton({
  sortKeyName,
  activeKey,
  descending,
  onToggle,
}: {
  sortKeyName: SortKey;
  activeKey: SortKey;
  descending: boolean;
  onToggle: (key: SortKey) => void;
}) {
  const isActive = activeKey === sortKeyName;
  const Icon = isActive ? (descending ? ArrowDown : ArrowUp) : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={() => onToggle(sortKeyName)}
      className={cn(
        "flex items-center gap-1 ml-auto text-xs font-semibold uppercase tracking-wide hover:text-ink",
        isActive ? "text-ink" : "text-muted-foreground",
      )}
    >
      {SORT_LABELS[sortKeyName]}
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

/**
 * "Who's producing" — the whole group (not just direct reports) as a flat,
 * sortable ranking rather than the tree view on My Team, which is built for
 * navigating reporting lines, not comparing performance. Click a column
 * header to sort by it; click again to flip direction.
 */
export function TopProducersTable({ producers }: { producers: Producer[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("salesTotal");
  const [descending, setDescending] = useState(true);

  const sorted = useMemo(() => {
    const copy = [...producers];
    copy.sort((a, b) => (descending ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]));
    return copy;
  }, [producers, sortKey, descending]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setDescending((d) => !d);
    else {
      setSortKey(key);
      setDescending(true);
    }
  }

  if (producers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Top Producers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No downline yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Producers</CardTitle>
        <p className="text-xs text-muted-foreground">Click a column to sort — every daie in your group, ranked.</p>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Daie ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Rank</TableHead>
              <TableHead className="text-right">
                <SortHeaderButton sortKeyName="salesTotal" activeKey={sortKey} descending={descending} onToggle={toggleSort} />
              </TableHead>
              <TableHead className="text-right">
                <SortHeaderButton sortKeyName="wasitahTotal" activeKey={sortKey} descending={descending} onToggle={toggleSort} />
              </TableHead>
              <TableHead className="text-right">
                <SortHeaderButton sortKeyName="pusakaTotal" activeKey={sortKey} descending={descending} onToggle={toggleSort} />
              </TableHead>
              <TableHead className="text-right">
                <SortHeaderButton sortKeyName="collectionTotal" activeKey={sortKey} descending={descending} onToggle={toggleSort} />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((p, i) => (
              <TableRow key={p.uid}>
                <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="font-mono text-xs">{p.daieId}</TableCell>
                <TableCell className="font-medium">{p.name}</TableCell>
                <TableCell><Badge variant="outline">{p.rank}</Badge></TableCell>
                <TableCell className="text-right">{formatRM(p.salesTotal)}</TableCell>
                <TableCell className="text-right">{p.wasitahTotal} case(s)</TableCell>
                <TableCell className="text-right">{formatRM(p.pusakaTotal)}</TableCell>
                <TableCell className="text-right">{formatRM(p.collectionTotal)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
