"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatRM } from "@/lib/utils";
import { downloadCsv } from "@/lib/csv";
import type { SalesTotals } from "@/lib/data";

export function ExportSalesCsvButton({
  personalTotals,
  groupTotals,
}: {
  personalTotals: SalesTotals;
  groupTotals: SalesTotals | null;
}) {
  function exportCsv() {
    const headers = [
      "Scope",
      "Perancangan",
      "Pengurusan - Berlian",
      "Pengurusan - Mutiara",
      "Kes Pusaka - Besar",
      "Kes Pusaka - Kecil",
      "Collection",
    ];
    function row(scope: string, t: SalesTotals): string[] {
      return [
        scope,
        formatRM(t.perancangan),
        String(t.pengurusanBerlian),
        String(t.pengurusanMutiara),
        formatRM(t.kesPusakaBesar),
        formatRM(t.kesPusakaKecil),
        formatRM(t.collectionTotal),
      ];
    }
    const rows = [row("Personal", personalTotals)];
    if (groupTotals) rows.push(row("My Total Group Production", groupTotals));

    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(`kausar-sales-${today}.csv`, headers, rows);
  }

  return (
    <Button variant="outline" size="sm" onClick={exportCsv}>
      <Download className="mr-1.5 h-4 w-4" />
      Export CSV
    </Button>
  );
}
