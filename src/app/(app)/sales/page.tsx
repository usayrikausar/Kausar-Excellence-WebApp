import { requireDaie } from "@/lib/auth/session";
import {
  getSalesSummary,
  getProspectsForUid,
  getDownline,
  pickViewedDaie,
  getSaleEntriesForUids,
  getCollectionEntriesForUid,
  getCollectionEntriesForUids,
  getGoal,
  getUnits,
  canSwitchScope,
  resolveViewScope,
  scopeOptions,
  getScopeMembers,
  getGroupSalesByMonth,
} from "@/lib/data";
import { UNIT_LABELS, unitLabel } from "@/lib/constants";
import { formatRM } from "@/lib/utils";
import { KONVENSYEN_PERIOD } from "@/lib/konvensyen";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScopeSwitcher } from "@/components/daie/scope-switcher";
import { currentMonthKey, type MonthKey } from "@/lib/scoring";
import { PerancanganForm, PengurusanForm, KesPusakaForm } from "@/components/daie/sales-forms";
import { SalesComparison } from "@/components/daie/sales-totals";
import { ExportSalesCsvButton } from "@/components/daie/export-sales-csv-button";
import { SalesTrackingCard } from "@/components/daie/sales-tracking-card";
import { DaiePicker } from "@/components/daie/daie-picker";
import { ReportCardMonthSelect } from "@/components/daie/report-card-month-select";

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ month?: string; daie?: string; scope?: string }> }) {
  const user = await requireDaie();
  const { month: monthParam, daie: daieParam, scope: scopeParamValue } = await searchParams;
  const scope = resolveViewScope(user, scopeParamValue);
  const totalsOnly = scope.kind === "overall";
  const monthKey: MonthKey = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : currentMonthKey();

  const [{ personalTotals, groupTotals, groupStatusCounts }, allProspects, downline] = await Promise.all([
    getSalesSummary(user),
    getProspectsForUid(user.uid),
    getDownline(user),
  ]);
  // Only prospects still in play are worth linking a new sale/collection to.
  const prospects = allProspects.filter((p) => p.status === "active").map((p) => ({ id: p.id, name: p.name }));

  // Sales tracking: the viewer's own by default; an upline/mentor can pick
  // anyone in their downline (any depth). A KDE picks from their whole unit
  // ("My group"); "Overall" adds per-unit totals but still only lets them
  // open their own unit's daie by name.
  const [members, units] = await Promise.all([getScopeMembers(user, scope), getUnits()]);
  const pickable = totalsOnly ? members.filter((m) => m.unitId === user.unitId) : members;
  const viewed = pickViewedDaie(user, pickable, daieParam);
  const viewedDownline = viewed.uid === user.uid ? pickable : await getDownline(viewed);
  // Same FY-start window Home's dashboard asks for, so both share one cached read.
  const fyStart = KONVENSYEN_PERIOD.start.slice(0, 7);
  const unitMonthRows = totalsOnly
    ? (await getGroupSalesByMonth(monthKey < fyStart ? monthKey : fyStart)).filter((r) => r.monthKey === monthKey)
    : null;
  const groupUids = viewedDownline.length > 0 ? [viewed.uid, ...viewedDownline.map((m) => m.uid)] : null;
  const [viewedEntries, viewedCollections, viewedGoal, groupEntries, groupCollections] = await Promise.all([
    getSaleEntriesForUids([viewed.uid]),
    getCollectionEntriesForUid(viewed.uid),
    getGoal(viewed.uid),
    groupUids ? getSaleEntriesForUids(groupUids) : Promise.resolve(null),
    groupUids ? getCollectionEntriesForUids(groupUids) : Promise.resolve(null),
  ]);
  const pickerOptions = [user, ...pickable]
    .map((m) => ({ uid: m.uid, name: m.name, daieId: m.daieId, rank: m.rank }))
    .sort((a, b) => (a.uid === user.uid ? -1 : b.uid === user.uid ? 1 : a.name.localeCompare(b.name)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-ink">Sales & Collection</h1>
        <p className="text-sm text-muted-foreground">Record a new entry, then check your running totals below.</p>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        <PerancanganForm uid={user.uid} prospects={prospects} />
        <PengurusanForm uid={user.uid} prospects={prospects} />
        <KesPusakaForm uid={user.uid} prospects={prospects} />
      </div>

      <div className="flex justify-end">
        <ExportSalesCsvButton personalTotals={personalTotals} groupTotals={groupTotals} />
      </div>
      <SalesComparison personalTotals={personalTotals} groupTotals={groupTotals} groupStatusCounts={groupStatusCounts} />

      <section className="space-y-3">
        {canSwitchScope(user) && <ScopeSwitcher basePath="/sales" {...scopeOptions(user, scope, units)} />}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] text-lg font-bold text-ink">Sales report card</h2>
            <p className="text-sm text-muted-foreground">
              {pickable.length > 0 ? "Track your own sales or pick anyone in your team." : "Your sales for the month you choose."}
            </p>
          </div>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            {pickable.length > 0 && (
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
          groupCollections={groupCollections}
          salesGoal={viewedGoal?.salesGoal ?? null}
        />

        {unitMonthRows && (
          <Card>
            <CardHeader>
              <CardTitle>Kausar Group by unit · this month</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Unit</TableHead>
                    <TableHead className="text-right">Perancangan</TableHead>
                    <TableHead className="text-right">Pengurusan</TableHead>
                    <TableHead className="text-right">Kes Pusaka</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="tabular-nums">
                  {Object.keys(UNIT_LABELS).map((unitId) => {
                    const r = unitMonthRows.find((x) => x.unitId === unitId);
                    return (
                      <TableRow key={unitId}>
                        <TableCell className="font-medium">{unitLabel(unitId, units)}</TableCell>
                        <TableCell className="text-right">{formatRM(r?.perancangan ?? 0)}</TableCell>
                        <TableCell className="text-right">{r?.pengurusan ?? 0} kes</TableCell>
                        <TableCell className="text-right">{formatRM(r?.pusaka ?? 0)}</TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="font-bold">
                    <TableCell>Kausar Group (TGS)</TableCell>
                    <TableCell className="text-right">{formatRM(unitMonthRows.reduce((a, r) => a + r.perancangan, 0))}</TableCell>
                    <TableCell className="text-right">{unitMonthRows.reduce((a, r) => a + r.pengurusan, 0)} kes</TableCell>
                    <TableCell className="text-right">{formatRM(unitMonthRows.reduce((a, r) => a + r.pusaka, 0))}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
