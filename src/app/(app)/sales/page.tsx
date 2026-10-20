import { requireDaie } from "@/lib/auth/session";
import {
  getSalesSummary,
  getProspectsForUid,
  getDownline,
  pickViewedDaie,
  getSaleEntriesForUids,
  getCollectionEntriesForUid,
  getGoal,
} from "@/lib/data";
import { currentMonthKey, type MonthKey } from "@/lib/scoring";
import { PerancanganForm, PengurusanForm, KesPusakaForm, CollectionForm } from "@/components/daie/sales-forms";
import { SalesComparison } from "@/components/daie/sales-totals";
import { ExportSalesCsvButton } from "@/components/daie/export-sales-csv-button";
import { SalesTrackingCard } from "@/components/daie/sales-tracking-card";
import { DaiePicker } from "@/components/daie/daie-picker";
import { ReportCardMonthSelect } from "@/components/daie/report-card-month-select";

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ month?: string; daie?: string }> }) {
  const user = await requireDaie();
  const { month: monthParam, daie: daieParam } = await searchParams;
  const monthKey: MonthKey = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonthKey();

  const [{ personalTotals, groupTotals, groupStatusCounts }, allProspects, downline] = await Promise.all([
    getSalesSummary(user),
    getProspectsForUid(user.uid),
    getDownline(user),
  ]);
  // Only prospects still in play are worth linking a new sale/collection to.
  const prospects = allProspects.filter((p) => p.status === "active").map((p) => ({ id: p.id, name: p.name }));

  // Sales tracking: the viewer's own by default; an upline/mentor can pick
  // anyone in their downline (any depth).
  const viewed = pickViewedDaie(user, downline, daieParam);
  const viewedDownline = viewed.uid === user.uid ? downline : await getDownline(viewed);
  const [viewedEntries, viewedCollections, viewedGoal, groupEntries] = await Promise.all([
    getSaleEntriesForUids([viewed.uid]),
    getCollectionEntriesForUid(viewed.uid),
    getGoal(viewed.uid),
    viewedDownline.length > 0 ? getSaleEntriesForUids([viewed.uid, ...viewedDownline.map((m) => m.uid)]) : Promise.resolve(null),
  ]);
  const pickerOptions = [user, ...downline]
    .map((m) => ({ uid: m.uid, name: m.name, daieId: m.daieId, rank: m.rank }))
    .sort((a, b) => (a.uid === user.uid ? -1 : b.uid === user.uid ? 1 : a.name.localeCompare(b.name)));

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

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-ink">Sales report card</h2>
            <p className="text-sm text-muted-foreground">
              {downline.length > 0 ? "Track your own sales or pick anyone in your team." : "Your sales for the month you choose."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {downline.length > 0 && (
              <DaiePicker basePath="/sales" selfUid={user.uid} selectedUid={viewed.uid} options={pickerOptions} />
            )}
            <div className="w-48">
              <ReportCardMonthSelect basePath="/sales" monthKey={monthKey} />
            </div>
          </div>
        </div>
        <SalesTrackingCard
          uid={viewed.uid}
          name={viewed.uid === user.uid ? `${viewed.name} (me)` : `${viewed.name} · ${viewed.daieId} · ${viewed.rank}`}
          monthKey={monthKey}
          entries={viewedEntries}
          collections={viewedCollections}
          groupEntries={groupEntries}
          salesGoal={viewedGoal?.salesGoal ?? null}
        />
      </section>
    </div>
  );
}
