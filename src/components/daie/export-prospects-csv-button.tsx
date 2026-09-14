"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/csv";
import { PROSPECT_CSV_HEADERS, prospectToRow } from "@/lib/prospect-csv";
import type { ProspectWithId } from "@/lib/data";

export function ExportProspectsCsvButton({ prospects }: { prospects: ProspectWithId[] }) {
  function exportCsv() {
    const rows = prospects.map(prospectToRow);
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(`kausar-prospects-${today}.csv`, [...PROSPECT_CSV_HEADERS], rows);
  }

  return (
    <Button variant="outline" size="sm" onClick={exportCsv}>
      <Download className="mr-1.5 h-4 w-4" />
      Export CSV
    </Button>
  );
}
