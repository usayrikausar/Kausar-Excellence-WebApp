import { requireDaie } from "@/lib/auth/session";
import { getSalesSummary, getProspectsForUid } from "@/lib/data";
import { PerancanganForm, PengurusanForm, KesPusakaForm, CollectionForm } from "@/components/daie/sales-forms";
import { SalesComparison } from "@/components/daie/sales-totals";
import { ExportSalesCsvButton } from "@/components/daie/export-sales-csv-button";

export default async function SalesPage() {
  const user = await requireDaie();
  const [{ personalTotals, groupTotals, groupStatusCounts }, allProspects] = await Promise.all([
    getSalesSummary(user),
    getProspectsForUid(user.uid),
  ]);
  // Only prospects still in play are worth linking a new sale/collection to.
  const prospects = allProspects.filter((p) => p.status === "active").map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-ink">Sales & Collection</h1>
        <p className="text-sm text-muted-foreground">Record a new entry, then check your running totals below.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PerancanganForm uid={user.uid} prospects={prospects} />
        <PengurusanForm uid={user.uid} prospects={prospects} />
        <KesPusakaForm uid={user.uid} prospects={prospects} />
        <CollectionForm uid={user.uid} prospects={prospects} />
      </div>

      <div className="flex justify-end">
        <ExportSalesCsvButton personalTotals={personalTotals} groupTotals={groupTotals} />
      </div>
      <SalesComparison personalTotals={personalTotals} groupTotals={groupTotals} groupStatusCounts={groupStatusCounts} />
    </div>
  );
}
