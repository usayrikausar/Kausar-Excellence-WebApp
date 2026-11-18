"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PaginationFooter } from "@/components/ui/pagination-footer";
import { HIBAH_TIERS, KONVENSYEN_TARGETS, hibahTier, summarizeAwards, type KonvensyenCriterion, type KonvensyenRow } from "@/lib/konvensyen";
import { unitLabel } from "@/lib/constants";
import { formatRM, cn } from "@/lib/utils";

const PAGE_SIZE = 50;
type Filter = "all" | "any" | "hrt" | "alWasitah" | "pusaka" | "rookie" | "close";
const FILTER_LABELS: Record<Filter, string> = {
  all: "Everyone",
  any: "Qualified for any award",
  hrt: "Hibah RT qualified",
  alWasitah: "Al-Wasitah RT qualified",
  pusaka: "Pusaka RT qualified",
  rookie: "Rookie award qualified",
  close: "Close to the next HRT tier (≥80%)",
};
type SortKey = "name" | "perancangan" | "alWasitah" | "pusaka" | "awards";

const crit = (c: KonvensyenCriterion[], label: string) => c.find((x) => x.label === label);
const val = (c: KonvensyenCriterion[], label: string) => crit(c, label)?.value ?? 0;
const awards = (c: KonvensyenCriterion[]) => c.filter((x) => x.met).length;

function matches(c: KonvensyenCriterion[], f: Filter): boolean {
  switch (f) {
    case "all": return true;
    case "any": return awards(c) > 0;
    case "hrt": return crit(c, "Hibah RT")?.met ?? false;
    case "alWasitah": return crit(c, "Al-Wasitah RT")?.met ?? false;
    case "pusaka": return crit(c, "Pusaka RT")?.met ?? false;
    case "rookie": return c.some((x) => x.label.startsWith("Rookie") && x.met);
    case "close": {
      const h = crit(c, "Hibah RT");
      if (!h || h.value >= HIBAH_TIERS[HIBAH_TIERS.length - 1]) return false;
      return h.value >= h.target * 0.8;
    }
  }
}

function Tile({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-white p-3">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="font-[family-name:var(--font-display)] text-2xl font-extrabold tabular-nums text-ink">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Who has qualified (or is closest) for each Konvensyen award — summary tiles, then a sortable, filterable table. */
export function KonvensyenBoard({ rows, units, showUnit }: { rows: KonvensyenRow[]; units: Record<string, string>; showUnit: boolean }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "perancangan", dir: "desc" });
  const [page, setPage] = useState(1);

  const summary = useMemo(() => summarizeAwards(rows.map((r) => r.konvensyen)), [rows]);
  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    const value = (r: KonvensyenRow): string | number => {
      switch (sort.key) {
        case "name": return r.name.toLowerCase();
        case "perancangan": return val(r.konvensyen, "Hibah RT");
        case "alWasitah": return val(r.konvensyen, "Al-Wasitah RT");
        case "pusaka": return val(r.konvensyen, "Pusaka RT");
        case "awards": return awards(r.konvensyen);
      }
    };
    return rows
      .filter((r) => matches(r.konvensyen, filter) && (!q || r.name.toLowerCase().includes(q) || r.daieId.toLowerCase().includes(q)))
      .sort((a, b) => {
        const x = value(a), y = value(b);
        const cmp = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
        return sort.dir === "asc" ? cmp : -cmp;
      });
  }, [rows, filter, search, sort]);
  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  // Paged on screen only: every row is rendered and rows off the current
  // page are hidden on screen but printed, so a printout is the full list.
  const offPage = (i: number) => i < (current - 1) * PAGE_SIZE || i >= current * PAGE_SIZE;

  const head = (label: string, key: SortKey, right = true) => (
    <th className={cn("px-3 py-2.5", right && "text-right")}>
      <button
        type="button"
        className={cn("inline-flex items-center gap-1 hover:text-ink", right && "flex-row-reverse")}
        onClick={() => { setSort((s) => ({ key, dir: s.key === key ? (s.dir === "asc" ? "desc" : "asc") : key === "name" ? "asc" : "desc" })); setPage(1); }}
      >
        {label}
        {sort.key === key && (sort.dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
      </button>
    </th>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Hibah RT" value={summary.hrt} sub={HIBAH_TIERS.map((t) => `${t / 1000}k: ${summary.hrtByTier[t]}`).join(" · ")} />
        <Tile label="Al-Wasitah RT" value={summary.alWasitah} sub={`${KONVENSYEN_TARGETS.alWasitahKes} cases`} />
        <Tile label="Pusaka RT" value={summary.pusaka} sub={formatRM(KONVENSYEN_TARGETS.pusakaAmount)} />
        <Tile label="Rookie Al-Wasitah" value={summary.rookieAlWasitah} sub={`of ${summary.rookieEligible} rookies`} />
        <Tile label="Rookie Perancangan" value={summary.rookiePerancangan} sub={`of ${summary.rookieEligible} rookies`} />
        <Tile label="Daie" value={summary.people} sub="in this view" />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center gap-2 border-b border-border p-3 text-sm print:hidden">
            <Select value={filter} onValueChange={(v) => { setFilter(v as Filter); setPage(1); }}>
              <SelectTrigger id="konvensyen-filter" className="h-8 w-72" aria-label="Show"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(FILTER_LABELS) as Filter[]).map((f) => <SelectItem key={f} value={f}>{FILTER_LABELS[f]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input id="konvensyen-search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name or Daie ID" aria-label="Search name or Daie ID" className="h-8 w-full sm:w-56" />
            <span className="text-muted-foreground">{list.length} daie</span>
          </div>
          <div className="overflow-x-auto print:overflow-visible">
            <table className="w-full text-sm print:text-[10.5px] print:[&_td]:px-1.5 print:[&_th]:px-1.5 print:[&_td]:py-1.5 print:[&_.text-xs]:text-[9.5px] print:[&_.rounded-full.border]:px-1.5 print:[&_.rounded-full.border]:py-0 print:[&_.rounded-full.border]:text-[9px] print:[&_.rounded-full.border]:whitespace-nowrap">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5">#</th>
                  {head("Daie", "name", false)}
                  {showUnit && <th className="px-3 py-2.5">Unit</th>}
                  {head("Perancangan · HRT", "perancangan")}
                  {head("Al-Wasitah cases", "alWasitah")}
                  {head("Pusaka", "pusaka")}
                  <th className="px-3 py-2.5">Rookie</th>
                  {head("Awards", "awards")}
                </tr>
              </thead>
              <tbody>
                {list.map((r, i) => {
                  const c = r.konvensyen;
                  const per = val(c, "Hibah RT");
                  const tier = hibahTier(per);
                  const next = HIBAH_TIERS.find((t) => per < t);
                  const aw = crit(c, "Al-Wasitah RT")!;
                  const pu = crit(c, "Pusaka RT")!;
                  const rookie = c.filter((x) => x.label.startsWith("Rookie"));
                  return (
                    <tr key={r.uid} className={cn("border-b border-border align-top print:break-inside-avoid", offPage(i) && "hidden print:table-row")}>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                      <td className="px-3 py-2">
                        <Link href={`/report-card/${r.uid}`} target="_blank" className="font-medium text-ink hover:text-primary hover:underline">{r.name}</Link>
                        <p className="text-xs text-muted-foreground">{r.daieId} · {r.rank}</p>
                      </td>
                      {showUnit && <td className="px-3 py-2 text-xs">{unitLabel(r.unitId, units)}</td>}
                      <td className="px-3 py-2 text-right">
                        <p className="tabular-nums">{formatRM(per)}</p>
                        {tier ? <Badge variant="success" className="mt-0.5">HRT {tier / 1000}k</Badge> : null}
                        {next && <p className="text-xs text-muted-foreground">{formatRM(next - per)} to {next / 1000}k</p>}
                      </td>
                      <td className={cn("px-3 py-2 text-right tabular-nums", aw.met && "font-semibold text-success")}>{aw.value} / {aw.target}</td>
                      <td className={cn("px-3 py-2 text-right tabular-nums", pu.met && "font-semibold text-success")}>{formatRM(pu.value)}</td>
                      <td className="px-3 py-2 text-xs">
                        {rookie.length === 0 ? <span className="text-muted-foreground">—</span> : rookie.map((x) => (
                          <p key={x.label} className={cn(x.met && "font-semibold text-success")}>
                            {x.label.replace("Rookie ", "")}: {x.label.includes("Perancangan") ? formatRM(x.value) : x.value} / {x.label.includes("Perancangan") ? formatRM(x.target) : x.target}
                          </p>
                        ))}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{awards(c)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="print:hidden">
            <PaginationFooter page={current} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        Awards follow Wasiyyah&rsquo;s FY25/26 criteria. Hibah RT is one tiered award on total Perancangan, as in the Konvensyen sheet. Perlantikan Round Table isn&rsquo;t shown, because the app has no appointment count.
      </p>
    </div>
  );
}
