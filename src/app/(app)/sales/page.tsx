import { requireDaie } from "@/lib/auth/session";
import { getSalesSummary } from "@/lib/data";
import { PerancanganForm, PengurusanForm, KesPusakaForm } from "@/components/daie/sales-forms";
import { SalesComparison } from "@/components/daie/sales-totals";
import { ExportSalesCsvButton } from "@/components/daie/export-sales-csv-button";

export default async function SalesPage() {
  const user = await requireDaie();
  const { personalTotals, groupTotals, groupStatusCounts } = await getSalesSummary(user);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-ink">Sales & Collection</h1>
        <p className="text-sm text-muted-foreground">Record a new entry, then check your running totals below.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <PerancanganForm uid={user.uid} />
        <PengurusanForm uid={user.uid} />
        <KesPusakaForm uid={user.uid} />
      </div>

      <div className="flex justify-end">
        <ExportSalesCsvButton personalTotals={personalTotals} groupTotals={groupTotals} />
      </div>
      <SalesComparison personalTotals={personalTotals} groupTotals={groupTotals} groupStatusCounts={groupStatusCounts} />
    </div>
  );
}
