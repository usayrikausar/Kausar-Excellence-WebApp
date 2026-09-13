import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatRM } from "@/lib/utils";
import type { SalesTotals } from "@/lib/data";

/**
 * Personal vs "My Total Group Production" side by side per metric — replaces
 * the earlier two-stacked-cards layout so personal and group figures (sales,
 * Wasitah cases, Pusaka, collection) are directly comparable at a glance
 * instead of requiring the reader to scroll and remember the first card's
 * numbers.
 */
export function SalesComparison({
  personalTotals,
  groupTotals,
  groupStatusCounts,
}: {
  personalTotals: SalesTotals;
  groupTotals: SalesTotals | null;
  groupStatusCounts?: { active: number; expired: number } | null;
}) {
  const personalPengurusan = personalTotals.pengurusanBerlian + personalTotals.pengurusanMutiara;
  const personalKesPusaka = personalTotals.kesPusakaBesar + personalTotals.kesPusakaKecil;
  const groupPengurusan = groupTotals ? groupTotals.pengurusanBerlian + groupTotals.pengurusanMutiara : 0;
  const groupKesPusaka = groupTotals ? groupTotals.kesPusakaBesar + groupTotals.kesPusakaKecil : 0;

  const rows = [
    {
      label: "Perancangan",
      personal: formatRM(personalTotals.perancangan),
      group: groupTotals ? formatRM(groupTotals.perancangan) : "—",
    },
    {
      label: "Pengurusan (Al Wasitah)",
      personal: `${personalPengurusan} case(s)`,
      personalBreakdown: `Berlian: ${personalTotals.pengurusanBerlian} · Mutiara: ${personalTotals.pengurusanMutiara}`,
      group: groupTotals ? `${groupPengurusan} case(s)` : "—",
      groupBreakdown: groupTotals ? `Berlian: ${groupTotals.pengurusanBerlian} · Mutiara: ${groupTotals.pengurusanMutiara}` : undefined,
    },
    {
      label: "Kes Pusaka",
      personal: formatRM(personalKesPusaka),
      personalBreakdown: `Besar: ${formatRM(personalTotals.kesPusakaBesar)} · Kecil: ${formatRM(personalTotals.kesPusakaKecil)}`,
      group: groupTotals ? formatRM(groupKesPusaka) : "—",
      groupBreakdown: groupTotals ? `Besar: ${formatRM(groupTotals.kesPusakaBesar)} · Kecil: ${formatRM(groupTotals.kesPusakaKecil)}` : undefined,
    },
    {
      label: "Collection",
      personal: formatRM(personalTotals.collectionTotal),
      group: groupTotals ? formatRM(groupTotals.collectionTotal) : "—",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales Summary</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-3 border-b border-border bg-muted px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <div>Metric</div>
          <div>Personal</div>
          <div>
            My Total Group Production
            {groupStatusCounts && (
              <div className="mt-0.5 text-[11px] font-semibold normal-case tracking-normal">
                <span className="text-success">{groupStatusCounts.active} active</span>
                {" · "}
                <span className="text-red-700">{groupStatusCounts.expired} expired</span>
              </div>
            )}
          </div>
        </div>
        {rows.map((row) => (
          <div key={row.label} className="grid grid-cols-3 border-b border-border px-4 py-3 last:border-0">
            <div className="text-sm font-medium text-ink">{row.label}</div>
            <div>
              <div className="font-[family-name:var(--font-display)] font-extrabold text-ink">{row.personal}</div>
              {row.personalBreakdown && <div className="text-xs text-muted-foreground">{row.personalBreakdown}</div>}
            </div>
            <div>
              <div className="font-[family-name:var(--font-display)] font-extrabold text-ink">{row.group}</div>
              {row.groupBreakdown && <div className="text-xs text-muted-foreground">{row.groupBreakdown}</div>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
