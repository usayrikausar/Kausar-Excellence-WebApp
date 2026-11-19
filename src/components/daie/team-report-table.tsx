"use client";

import { useMemo, useState } from "react";
import { PaginationFooter } from "@/components/ui/pagination-footer";
import { ChevronUp, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TrafficLightDot } from "@/components/daie/traffic-light-dot";
import { TRAFFIC_LIGHT_STYLES } from "@/lib/scoring";
import { unitLabel } from "@/lib/constants";
import { cn, formatRM } from "@/lib/utils";
import type { TeamReportRow } from "@/lib/data";
import { compareYoy, formatChange, yoyFormula, PREV_FY, CURRENT_FY_LABEL, type YoyWindow } from "@/lib/yoy";
import { WASITAH_PACKAGES, wasitahLabel } from "@/lib/sale-details";

type View = "traffic" | "producers" | "sales" | "konvensyen" | "yoy";

const VIEW_LABELS: Record<View, string> = {
  traffic: "Traffic light",
  producers: "Producers",
  sales: "Sales by category",
  konvensyen: "Convention qualifiers",
  yoy: "Year on year",
};

function SortHeaderButton<K extends string>({ label, sortKey, activeSortKey, direction, onSort, align }: {
  label: string;
  sortKey: K;
  activeSortKey: K;
  direction: "asc" | "desc";
  onSort: (key: K) => void;
  align?: "right";
}) {
  const isActive = sortKey === activeSortKey;
  return (
    <button type="button" onClick={() => onSort(sortKey)} className={cn("flex items-center gap-1 hover:text-ink", align === "right" && "ml-auto")}>
      {label}
      {isActive && (direction === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
    </button>
  );
}

function konv(row: TeamReportRow, label: string) {
  return row.konvensyen.find((c) => c.label === label) ?? null;
}

type TrafficSortKey = "status" | "name" | "daieId" | "training" | "reach" | "presentations" | "prosper" | "sales" | "total";
type SalesSortKey = "name" | "daieId" | "rank" | "perancangan" | "wasitah" | "besar" | "kecil" | "collection";
type KonvensyenSortKey = "name" | "daieId" | "alWasitah" | "hibah" | "pusaka" | "rookieAlWasitah" | "rookiePerancangan" | "qualified";
type YoySortKey = "name" | "daieId" | "rank" | "prev" | "ytd" | "change";
type ProducerSortKey = "name" | "daieId" | "rank" | "perancangan" | "wasitah" | "pusaka";

const PAGE_SIZE = 50;

export function TeamReportTable({
  rows,
  units,
  showUnit,
  yoyWindow,
  periodLabel,
  trafficMonthLabel,
  initialView,
}: {
  rows: TeamReportRow[];
  units: Record<string, string>;
  showUnit: boolean;
  yoyWindow: YoyWindow;
  /** The period picked at the top, e.g. "November 2026". */
  periodLabel: string;
  /** Set when the period spans several months: the traffic light scores this (last) month. */
  trafficMonthLabel: string | null;
  initialView: View;
}) {
  const [view, setView] = useState<View>(initialView);
  const [producerSort, setProducerSort] = useState<{ key: ProducerSortKey; dir: "asc" | "desc" }>({ key: "perancangan", dir: "desc" });
  const [trafficSort, setTrafficSort] = useState<{ key: TrafficSortKey; dir: "asc" | "desc" }>({ key: "total", dir: "desc" });
  const [salesSort, setSalesSort] = useState<{ key: SalesSortKey; dir: "asc" | "desc" }>({ key: "perancangan", dir: "desc" });
  const [konvSort, setKonvSort] = useState<{ key: KonvensyenSortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });
  const [yoySort, setYoySort] = useState<{ key: YoySortKey; dir: "asc" | "desc" }>({ key: "ytd", dir: "desc" });
  // One Wasitah column; the dropdown picks all packages or one (agreed 2026-11-19).
  const [wasitahPkg, setWasitahPkg] = useState<string>("all");
  const wasitahOf = (byPackage: Partial<Record<string, number>>, total: number) => (wasitahPkg === "all" ? total : (byPackage[wasitahPkg] ?? 0));
  const wasitahHeader = wasitahPkg === "all" ? "Wasitah (all)" : `Wasitah ${wasitahLabel(wasitahPkg)}`;
  // Paged on screen only — every row is still rendered and printed (rows off
  // the current page are hidden on screen but shown in print), since this
  // page exists to be printed as one complete team report.
  const [page, setPage] = useState(1);

  function toggleSort<K extends string>(current: { key: K; dir: "asc" | "desc" }, key: K, setter: (v: { key: K; dir: "asc" | "desc" }) => void) {
    setter(key === current.key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" });
  }

  const trafficRows = useMemo(() => {
    const value = (row: TeamReportRow, key: TrafficSortKey): string | number => {
      switch (key) {
        case "status": return -TRAFFIC_LIGHT_STYLES[row.score.color].order;
        case "name": return row.name;
        case "daieId": return row.daieId;
        case "training": return row.score.training.points;
        case "reach": return row.score.reach.points;
        case "presentations": return row.score.presentations.points;
        case "prosper": return row.score.prosperInvites.points;
        case "sales": return row.score.sales.points;
        case "total": return row.score.total;
      }
    };
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = value(a, trafficSort.key), bv = value(b, trafficSort.key);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return trafficSort.dir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, trafficSort]);

  const salesRows = useMemo(() => {
    const value = (row: TeamReportRow, key: SalesSortKey): string | number => {
      switch (key) {
        case "name": return row.name;
        case "daieId": return row.daieId;
        case "rank": return row.rank;
        case "perancangan": return row.sales.perancangan;
        case "wasitah": return wasitahOf(row.sales.pengurusanByPackage, row.sales.pengurusanTotal);
        case "besar": return row.sales.kesPusakaBesar;
        case "kecil": return row.sales.kesPusakaKecil;
        case "collection": return row.sales.collectionTotal;
      }
    };
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = value(a, salesSort.key), bv = value(b, salesSort.key);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return salesSort.dir === "asc" ? cmp : -cmp;
    });
    return copy;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- wasitahOf only reads wasitahPkg
  }, [rows, salesSort, wasitahPkg]);

  const konvRows = useMemo(() => {
    const value = (row: TeamReportRow, key: KonvensyenSortKey): string | number => {
      switch (key) {
        case "name": return row.name;
        case "daieId": return row.daieId;
        case "alWasitah": return konv(row, "Al-Wasitah RT")?.value ?? -1;
        case "hibah": return konv(row, "Hibah RT")?.value ?? -1;
        case "pusaka": return konv(row, "Pusaka RT")?.value ?? -1;
        case "rookieAlWasitah": return konv(row, "Rookie Al-Wasitah")?.value ?? -1;
        case "rookiePerancangan": return konv(row, "Rookie Perancangan")?.value ?? -1;
        case "qualified": return row.konvensyenQualified ? 1 : 0;
      }
    };
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = value(a, konvSort.key), bv = value(b, konvSort.key);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return konvSort.dir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, konvSort]);

  // Producers = anyone with Perancangan, Wasitah or Kes Pusaka in the period.
  const producerRows = useMemo(() => {
    const value = (row: TeamReportRow, key: ProducerSortKey): string | number => {
      switch (key) {
        case "name": return row.name;
        case "daieId": return row.daieId;
        case "rank": return row.rank;
        case "perancangan": return row.periodSales.perancangan;
        case "wasitah": return wasitahOf(row.periodSales.wasitahByPackage, row.periodSales.wasitah);
        case "pusaka": return row.periodSales.pusaka;
      }
    };
    const list = rows.filter((r) => r.periodSales.perancangan > 0 || r.periodSales.wasitah > 0 || r.periodSales.pusaka > 0);
    list.sort((a, b) => {
      const av = value(a, producerSort.key), bv = value(b, producerSort.key);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      // Ties (e.g. same Perancangan) fall back to the bigger Perancangan, then name.
      return (producerSort.dir === "asc" ? cmp : -cmp) || b.periodSales.perancangan - a.periodSales.perancangan || a.name.localeCompare(b.name);
    });
    return list;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- wasitahOf only reads wasitahPkg
  }, [rows, producerSort, wasitahPkg]);
  const producerTotals = useMemo(() => {
    const t = { perancangan: 0, wasitah: 0, wasitahByPackage: {} as Partial<Record<string, number>>, pusaka: 0 };
    for (const r of producerRows) {
      t.perancangan += r.periodSales.perancangan;
      t.wasitah += r.periodSales.wasitah;
      for (const [k, v] of Object.entries(r.periodSales.wasitahByPackage)) t.wasitahByPackage[k] = (t.wasitahByPackage[k] ?? 0) + (v ?? 0);
      t.pusaka += r.periodSales.pusaka;
    }
    return t;
  }, [producerRows]);
  const activeCount = rows.filter((r) => r.active).length;
  // Same rate as Group analytics: active producers ÷ active perunding (expired daie can still have late sales).
  const activeProducers = producerRows.filter((r) => r.active).length;
  const perancanganProducers = producerRows.filter((r) => r.periodSales.perancangan > 0).length;
  const visibleCount = view === "producers" ? producerRows.length : rows.length;
  const totalPages = Math.max(1, Math.ceil(visibleCount / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const offPage = (i: number) => i < (currentPage - 1) * PAGE_SIZE || i >= currentPage * PAGE_SIZE;

  const yoyRows = useMemo(() => {
    const withFigures = rows.map((row) => ({ row, f: compareYoy(row.yoy.prev, row.yoy.ytd, yoyWindow) }));
    const value = ({ row, f }: (typeof withFigures)[number], key: YoySortKey): string | number => {
      switch (key) {
        case "name": return row.name;
        case "daieId": return row.daieId;
        case "rank": return row.rank;
        case "prev": return f.prevAvg;
        case "ytd": return f.ytdAvg;
        // No FY24/25 to compare against sorts below every real change.
        case "change": return f.changePct ?? -Infinity;
      }
    };
    withFigures.sort((a, b) => {
      const av = value(a, yoySort.key), bv = value(b, yoySort.key);
      const cmp = typeof av === "number" && typeof bv === "number" ? (av === bv ? 0 : av < bv ? -1 : 1) : String(av).localeCompare(String(bv));
      return yoySort.dir === "asc" ? cmp : -cmp;
    });
    return withFigures;
  }, [rows, yoySort, yoyWindow]);
  const yoyTotal = useMemo(
    () => compareYoy(rows.reduce((s, r) => s + r.yoy.prev, 0), rows.reduce((s, r) => s + r.yoy.ytd, 0), yoyWindow),
    [rows, yoyWindow],
  );

  if (rows.length === 0) {
    return <p className="p-8 text-center text-sm text-muted-foreground">No downline to report on.</p>;
  }

  return (
    <div>
      <div className="flex gap-1 border-b border-border px-6 pt-4 print:hidden">
        {(["traffic", "producers", "sales", "konvensyen", "yoy"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => {
              setView(v);
              setPage(1);
              // Keep the tab when the period is changed or the page is shared.
              const url = new URL(window.location.href);
              url.searchParams.set("view", v);
              window.history.replaceState(null, "", url);
            }}
            className={cn("rounded-t-md px-3 py-2 text-sm font-medium", view === v ? "border border-b-0 border-border bg-white text-ink" : "text-muted-foreground hover:text-ink")}
          >
            {VIEW_LABELS[v]}
          </button>
        ))}
      </div>

      <div className="hidden px-6 pt-4 font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-wide text-navy-900 print:block">
        {VIEW_LABELS[view]}
      </div>
      {view === "traffic" && trafficMonthLabel && (
        <p className="px-6 pt-3 text-xs text-muted-foreground">The traffic light is a monthly score, shown here for {trafficMonthLabel} (the last month of {periodLabel}).</p>
      )}
      {view === "sales" && (
        <p className="px-6 pt-3 text-xs text-muted-foreground">Career-to-date totals. For {periodLabel} only, see Producers.</p>
      )}
      {(view === "sales" || view === "producers") && (
        <label className="flex items-center gap-2 px-6 pt-3 text-xs text-muted-foreground print:hidden">
          Wasitah column
          <select
            id="team-wasitah-package"
            value={wasitahPkg}
            onChange={(e) => setWasitahPkg(e.target.value)}
            className="rounded-md border border-border bg-white px-2 py-1 text-xs font-semibold text-ink"
          >
            <option value="all">All packages</option>
            {WASITAH_PACKAGES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </label>
      )}
      {view === "producers" && (
        <div className="flex flex-wrap gap-x-8 gap-y-2 border-b border-border px-6 py-4 text-sm">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Producers · {periodLabel}</div>
            <div className="font-[family-name:var(--font-display)] text-xl font-extrabold text-ink">
              {producerRows.length}{" "}
              <span className="text-sm font-semibold text-muted-foreground">
                · {activeProducers} of {activeCount} active perunding{activeCount ? ` (${Math.round((activeProducers / activeCount) * 100)}%)` : ""}
              </span>
            </div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Perancangan</div>
            <div className="font-[family-name:var(--font-display)] text-xl font-extrabold text-ink">{formatRM(producerTotals.perancangan)}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Average per Perancangan producer</div>
            <div className="font-[family-name:var(--font-display)] text-xl font-extrabold text-ink">{perancanganProducers ? formatRM(Math.round(producerTotals.perancangan / perancanganProducers)) : "—"}</div>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Wasitah · Kes Pusaka</div>
            <div className="font-[family-name:var(--font-display)] text-xl font-extrabold text-ink">
              {producerTotals.wasitah} cases · {formatRM(producerTotals.pusaka)}
            </div>
          </div>
        </div>
      )}
      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full border-collapse text-[12.5px] print:text-[10px] print:[&_td]:px-1.5 print:[&_th]:px-1.5 print:[&_td]:py-1.5 print:[&_th]:py-2 print:[&_tr]:break-inside-avoid print:[&_.font-mono]:text-[9px] print:[&_.font-mono]:whitespace-nowrap print:[&_.rounded-full.border]:px-1.5 print:[&_.rounded-full.border]:py-0 print:[&_.rounded-full.border]:text-[9px] print:[&_.rounded-full.border]:whitespace-nowrap">
          {view === "traffic" && (
            <>
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5"><SortHeaderButton label="Status" sortKey="status" activeSortKey={trafficSort.key} direction={trafficSort.dir} onSort={(k) => toggleSort(trafficSort, k, setTrafficSort)} /></th>
                  <th className="px-3 py-2.5"><SortHeaderButton label="Name" sortKey="name" activeSortKey={trafficSort.key} direction={trafficSort.dir} onSort={(k) => toggleSort(trafficSort, k, setTrafficSort)} /></th>
                  <th className="px-3 py-2.5"><SortHeaderButton label="Daie ID" sortKey="daieId" activeSortKey={trafficSort.key} direction={trafficSort.dir} onSort={(k) => toggleSort(trafficSort, k, setTrafficSort)} /></th>
                  {showUnit && <th className="px-3 py-2.5">Unit</th>}
                  <th className="px-3 py-2.5 text-right"><SortHeaderButton align="right" label="Training" sortKey="training" activeSortKey={trafficSort.key} direction={trafficSort.dir} onSort={(k) => toggleSort(trafficSort, k, setTrafficSort)} /></th>
                  <th className="px-3 py-2.5 text-right"><SortHeaderButton align="right" label="Reach" sortKey="reach" activeSortKey={trafficSort.key} direction={trafficSort.dir} onSort={(k) => toggleSort(trafficSort, k, setTrafficSort)} /></th>
                  <th className="px-3 py-2.5 text-right"><SortHeaderButton align="right" label="Presentations" sortKey="presentations" activeSortKey={trafficSort.key} direction={trafficSort.dir} onSort={(k) => toggleSort(trafficSort, k, setTrafficSort)} /></th>
                  <th className="px-3 py-2.5 text-right"><SortHeaderButton align="right" label="PROSPER" sortKey="prosper" activeSortKey={trafficSort.key} direction={trafficSort.dir} onSort={(k) => toggleSort(trafficSort, k, setTrafficSort)} /></th>
                  <th className="px-3 py-2.5 text-right"><SortHeaderButton align="right" label="Sales" sortKey="sales" activeSortKey={trafficSort.key} direction={trafficSort.dir} onSort={(k) => toggleSort(trafficSort, k, setTrafficSort)} /></th>
                  <th className="px-3 py-2.5 text-right"><SortHeaderButton align="right" label="Total" sortKey="total" activeSortKey={trafficSort.key} direction={trafficSort.dir} onSort={(k) => toggleSort(trafficSort, k, setTrafficSort)} /></th>
                </tr>
              </thead>
              <tbody>
                {trafficRows.map((row, i) => (
                  <tr key={row.uid} className={cn("border-b border-border", TRAFFIC_LIGHT_STYLES[row.score.color].rowClassName, offPage(i) && "hidden print:table-row")}>
                    <td className="px-3 py-2"><TrafficLightDot color={row.score.color} withLabel /></td>
                    <td className="px-3 py-2 font-medium text-ink">{row.name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-ink">{row.daieId}</td>
                    {showUnit && <td className="px-3 py-2 text-ink">{unitLabel(row.unitId, units)}</td>}
                    <td className="px-3 py-2 text-right text-ink">{row.score.training.points}</td>
                    <td className="px-3 py-2 text-right text-ink">{row.score.reach.points}</td>
                    <td className="px-3 py-2 text-right text-ink">{row.score.presentations.points}</td>
                    <td className="px-3 py-2 text-right text-ink">{row.score.prosperInvites.points}</td>
                    <td className="px-3 py-2 text-right text-ink">{row.score.sales.points}</td>
                    <td className="px-3 py-2 text-right font-semibold text-ink">{row.score.total}</td>
                  </tr>
                ))}
              </tbody>
            </>
          )}

          {view === "producers" && (
            <>
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5">#</th>
                  <th className="px-3 py-2.5"><SortHeaderButton label="Name" sortKey="name" activeSortKey={producerSort.key} direction={producerSort.dir} onSort={(k) => toggleSort(producerSort, k, setProducerSort)} /></th>
                  <th className="px-3 py-2.5"><SortHeaderButton label="Daie ID" sortKey="daieId" activeSortKey={producerSort.key} direction={producerSort.dir} onSort={(k) => toggleSort(producerSort, k, setProducerSort)} /></th>
                  <th className="px-3 py-2.5"><SortHeaderButton label="Rank" sortKey="rank" activeSortKey={producerSort.key} direction={producerSort.dir} onSort={(k) => toggleSort(producerSort, k, setProducerSort)} /></th>
                  {showUnit && <th className="px-3 py-2.5">Unit</th>}
                  <th className="px-3 py-2.5 text-right"><SortHeaderButton align="right" label="Sales (Perancangan)" sortKey="perancangan" activeSortKey={producerSort.key} direction={producerSort.dir} onSort={(k) => toggleSort(producerSort, k, setProducerSort)} /></th>
                  <th className="px-3 py-2.5 text-right">% of team</th>
                  <th className="px-3 py-2.5 text-right"><SortHeaderButton align="right" label={wasitahHeader} sortKey="wasitah" activeSortKey={producerSort.key} direction={producerSort.dir} onSort={(k) => toggleSort(producerSort, k, setProducerSort)} /></th>
                  <th className="px-3 py-2.5 text-right"><SortHeaderButton align="right" label="Kes Pusaka" sortKey="pusaka" activeSortKey={producerSort.key} direction={producerSort.dir} onSort={(k) => toggleSort(producerSort, k, setProducerSort)} /></th>
                </tr>
              </thead>
              <tbody>
                {producerRows.length === 0 && (
                  <tr><td colSpan={showUnit ? 9 : 8} className="px-3 py-8 text-center text-muted-foreground">No production recorded in {periodLabel} yet.</td></tr>
                )}
                {producerRows.map((row, i) => (
                  <tr key={row.uid} className={cn("border-b border-border", offPage(i) && "hidden print:table-row")}>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2 font-medium text-ink">{row.name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-ink">{row.daieId}</td>
                    <td className="px-3 py-2"><Badge variant="outline">{row.rank}</Badge></td>
                    {showUnit && <td className="px-3 py-2 text-ink">{unitLabel(row.unitId, units)}</td>}
                    <td className="px-3 py-2 text-right font-semibold text-ink">{formatRM(row.periodSales.perancangan)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{producerTotals.perancangan > 0 ? `${((row.periodSales.perancangan / producerTotals.perancangan) * 100).toFixed(1)}%` : "—"}</td>
                    <td className="px-3 py-2 text-right text-ink">{wasitahOf(row.periodSales.wasitahByPackage, row.periodSales.wasitah) || "—"}</td>
                    <td className="px-3 py-2 text-right text-ink">{row.periodSales.pusaka ? formatRM(row.periodSales.pusaka) : "—"}</td>
                  </tr>
                ))}
              </tbody>
              {producerRows.length > 0 && (
                <tfoot>
                  <tr className="bg-muted font-bold">
                    <td className="px-3 py-2 text-ink" colSpan={showUnit ? 5 : 4}>Total ({producerRows.length} producers)</td>
                    <td className="px-3 py-2 text-right text-ink">{formatRM(producerTotals.perancangan)}</td>
                    <td className="px-3 py-2 text-right text-ink">100%</td>
                    <td className="px-3 py-2 text-right text-ink">{wasitahOf(producerTotals.wasitahByPackage, producerTotals.wasitah)}</td>
                    <td className="px-3 py-2 text-right text-ink">{formatRM(producerTotals.pusaka)}</td>
                  </tr>
                </tfoot>
              )}
            </>
          )}

          {view === "sales" && (
            <>
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5"><SortHeaderButton label="Name" sortKey="name" activeSortKey={salesSort.key} direction={salesSort.dir} onSort={(k) => toggleSort(salesSort, k, setSalesSort)} /></th>
                  <th className="px-3 py-2.5"><SortHeaderButton label="Daie ID" sortKey="daieId" activeSortKey={salesSort.key} direction={salesSort.dir} onSort={(k) => toggleSort(salesSort, k, setSalesSort)} /></th>
                  <th className="px-3 py-2.5"><SortHeaderButton label="Rank" sortKey="rank" activeSortKey={salesSort.key} direction={salesSort.dir} onSort={(k) => toggleSort(salesSort, k, setSalesSort)} /></th>
                  {showUnit && <th className="px-3 py-2.5">Unit</th>}
                  <th className="px-3 py-2.5 text-right"><SortHeaderButton align="right" label="Perancangan" sortKey="perancangan" activeSortKey={salesSort.key} direction={salesSort.dir} onSort={(k) => toggleSort(salesSort, k, setSalesSort)} /></th>
                  <th className="px-3 py-2.5 text-right"><SortHeaderButton align="right" label={wasitahHeader} sortKey="wasitah" activeSortKey={salesSort.key} direction={salesSort.dir} onSort={(k) => toggleSort(salesSort, k, setSalesSort)} /></th>
                  <th className="px-3 py-2.5 text-right"><SortHeaderButton align="right" label="Pusaka Besar" sortKey="besar" activeSortKey={salesSort.key} direction={salesSort.dir} onSort={(k) => toggleSort(salesSort, k, setSalesSort)} /></th>
                  <th className="px-3 py-2.5 text-right"><SortHeaderButton align="right" label="Pusaka Kecil" sortKey="kecil" activeSortKey={salesSort.key} direction={salesSort.dir} onSort={(k) => toggleSort(salesSort, k, setSalesSort)} /></th>
                  <th className="px-3 py-2.5 text-right"><SortHeaderButton align="right" label="Collection" sortKey="collection" activeSortKey={salesSort.key} direction={salesSort.dir} onSort={(k) => toggleSort(salesSort, k, setSalesSort)} /></th>
                </tr>
              </thead>
              <tbody>
                {salesRows.map((row, i) => (
                  <tr key={row.uid} className={cn("border-b border-border", offPage(i) && "hidden print:table-row")}>
                    <td className="px-3 py-2 font-medium text-ink">{row.name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-ink">{row.daieId}</td>
                    <td className="px-3 py-2"><Badge variant="outline">{row.rank}</Badge></td>
                    {showUnit && <td className="px-3 py-2 text-ink">{unitLabel(row.unitId, units)}</td>}
                    <td className="px-3 py-2 text-right text-ink">{formatRM(row.sales.perancangan)}</td>
                    <td className="px-3 py-2 text-right text-ink">{wasitahOf(row.sales.pengurusanByPackage, row.sales.pengurusanTotal)}</td>
                    <td className="px-3 py-2 text-right text-ink">{formatRM(row.sales.kesPusakaBesar)}</td>
                    <td className="px-3 py-2 text-right text-ink">{formatRM(row.sales.kesPusakaKecil)}</td>
                    <td className="px-3 py-2 text-right text-ink">{formatRM(row.sales.collectionTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </>
          )}

          {view === "konvensyen" && (
            <>
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5"><SortHeaderButton label="Name" sortKey="name" activeSortKey={konvSort.key} direction={konvSort.dir} onSort={(k) => toggleSort(konvSort, k, setKonvSort)} /></th>
                  <th className="px-3 py-2.5"><SortHeaderButton label="Daie ID" sortKey="daieId" activeSortKey={konvSort.key} direction={konvSort.dir} onSort={(k) => toggleSort(konvSort, k, setKonvSort)} /></th>
                  {showUnit && <th className="px-3 py-2.5">Unit</th>}
                  <th className="px-3 py-2.5 text-right"><SortHeaderButton align="right" label="Al-Wasitah RT" sortKey="alWasitah" activeSortKey={konvSort.key} direction={konvSort.dir} onSort={(k) => toggleSort(konvSort, k, setKonvSort)} /></th>
                  <th className="px-3 py-2.5 text-right"><SortHeaderButton align="right" label="Hibah RT (tier)" sortKey="hibah" activeSortKey={konvSort.key} direction={konvSort.dir} onSort={(k) => toggleSort(konvSort, k, setKonvSort)} /></th>
                  <th className="px-3 py-2.5 text-right"><SortHeaderButton align="right" label="Pusaka RT" sortKey="pusaka" activeSortKey={konvSort.key} direction={konvSort.dir} onSort={(k) => toggleSort(konvSort, k, setKonvSort)} /></th>
                  <th className="px-3 py-2.5 text-right"><SortHeaderButton align="right" label="Rookie Al-Wasitah" sortKey="rookieAlWasitah" activeSortKey={konvSort.key} direction={konvSort.dir} onSort={(k) => toggleSort(konvSort, k, setKonvSort)} /></th>
                  <th className="px-3 py-2.5 text-right"><SortHeaderButton align="right" label="Rookie Perancangan" sortKey="rookiePerancangan" activeSortKey={konvSort.key} direction={konvSort.dir} onSort={(k) => toggleSort(konvSort, k, setKonvSort)} /></th>
                  <th className="px-3 py-2.5 text-center"><SortHeaderButton label="Qualified" sortKey="qualified" activeSortKey={konvSort.key} direction={konvSort.dir} onSort={(k) => toggleSort(konvSort, k, setKonvSort)} /></th>
                </tr>
              </thead>
              <tbody>
                {konvRows.map((row, i) => {
                  const alWasitah = konv(row, "Al-Wasitah RT");
                  const hibah = konv(row, "Hibah RT");
                  const pusaka = konv(row, "Pusaka RT");
                  const rookieAlWasitah = konv(row, "Rookie Al-Wasitah");
                  const rookiePerancangan = konv(row, "Rookie Perancangan");
                  return (
                    <tr key={row.uid} className={cn("border-b border-border", offPage(i) && "hidden print:table-row")}>
                      <td className="px-3 py-2 font-medium text-ink">{row.name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-ink">{row.daieId}</td>
                      {showUnit && <td className="px-3 py-2 text-ink">{unitLabel(row.unitId, units)}</td>}
                      <td className={cn("px-3 py-2 text-right", alWasitah?.met ? "text-success" : "text-ink")}>{alWasitah ? `${alWasitah.value}/${alWasitah.target}` : "—"}</td>
                      <td className={cn("px-3 py-2 text-right", hibah?.met ? "text-success" : "text-ink")}>
                        {hibah?.met ? hibah.tierLabel?.replace("Qualifies for ", "").replace(" tier", "") ?? "—" : "Not yet"}
                      </td>
                      <td className={cn("px-3 py-2 text-right", pusaka?.met ? "text-success" : "text-ink")}>{pusaka ? formatRM(pusaka.value) : "—"}</td>
                      <td className={cn("px-3 py-2 text-right", rookieAlWasitah?.met ? "text-success" : "text-ink")}>{rookieAlWasitah ? `${rookieAlWasitah.value}/${rookieAlWasitah.target}` : "—"}</td>
                      <td className={cn("px-3 py-2 text-right", rookiePerancangan?.met ? "text-success" : "text-ink")}>{rookiePerancangan ? formatRM(rookiePerancangan.value) : "—"}</td>
                      <td className="px-3 py-2 text-center"><Badge variant={row.konvensyenQualified ? "success" : "outline"}>{row.konvensyenQualified ? "Qualified" : "Not yet"}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </>
          )}
          {view === "yoy" && (
            <>
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2.5"><SortHeaderButton label="Name" sortKey="name" activeSortKey={yoySort.key} direction={yoySort.dir} onSort={(k) => toggleSort(yoySort, k, setYoySort)} /></th>
                  <th className="px-3 py-2.5"><SortHeaderButton label="Daie ID" sortKey="daieId" activeSortKey={yoySort.key} direction={yoySort.dir} onSort={(k) => toggleSort(yoySort, k, setYoySort)} /></th>
                  <th className="px-3 py-2.5"><SortHeaderButton label="Rank" sortKey="rank" activeSortKey={yoySort.key} direction={yoySort.dir} onSort={(k) => toggleSort(yoySort, k, setYoySort)} /></th>
                  {showUnit && <th className="px-3 py-2.5">Unit</th>}
                  <th className="px-3 py-2.5 text-right">{PREV_FY.key} total</th>
                  <th className="px-3 py-2.5 text-right"><SortHeaderButton align="right" label={`${PREV_FY.key} / month`} sortKey="prev" activeSortKey={yoySort.key} direction={yoySort.dir} onSort={(k) => toggleSort(yoySort, k, setYoySort)} /></th>
                  <th className="px-3 py-2.5 text-right">{CURRENT_FY_LABEL} YTD</th>
                  <th className="px-3 py-2.5 text-right"><SortHeaderButton align="right" label={`${CURRENT_FY_LABEL} / month`} sortKey="ytd" activeSortKey={yoySort.key} direction={yoySort.dir} onSort={(k) => toggleSort(yoySort, k, setYoySort)} /></th>
                  <th className="px-3 py-2.5 text-right"><SortHeaderButton align="right" label="Change" sortKey="change" activeSortKey={yoySort.key} direction={yoySort.dir} onSort={(k) => toggleSort(yoySort, k, setYoySort)} /></th>
                </tr>
              </thead>
              <tbody>
                {yoyRows.map(({ row, f }, i) => (
                  <tr key={row.uid} className={cn("border-b border-border", offPage(i) && "hidden print:table-row")}>
                    <td className="px-3 py-2 font-medium text-ink">{row.name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-ink">{row.daieId}</td>
                    <td className="px-3 py-2"><Badge variant="outline">{row.rank}</Badge></td>
                    {showUnit && <td className="px-3 py-2 text-ink">{unitLabel(row.unitId, units)}</td>}
                    <td className="px-3 py-2 text-right text-muted-foreground">{formatRM(f.prevTotal)}</td>
                    <td className="px-3 py-2 text-right text-ink">{formatRM(f.prevAvg)}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{formatRM(f.ytdTotal)}</td>
                    <td className="px-3 py-2 text-right text-ink">{formatRM(f.ytdAvg)}</td>
                    <td className={cn("px-3 py-2 text-right font-semibold", f.changePct === null ? "text-muted-foreground" : f.changePct >= 0 ? "text-success" : "text-red-600")}>{formatChange(f.changePct)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-muted font-bold">
                  <td className="px-3 py-2 text-ink" colSpan={showUnit ? 4 : 3}>Team total ({rows.length} daie)</td>
                  <td className="px-3 py-2 text-right text-ink">{formatRM(yoyTotal.prevTotal)}</td>
                  <td className="px-3 py-2 text-right text-ink">{formatRM(yoyTotal.prevAvg)}</td>
                  <td className="px-3 py-2 text-right text-ink">{formatRM(yoyTotal.ytdTotal)}</td>
                  <td className="px-3 py-2 text-right text-ink">{formatRM(yoyTotal.ytdAvg)}</td>
                  <td className={cn("px-3 py-2 text-right", yoyTotal.changePct === null ? "text-muted-foreground" : yoyTotal.changePct >= 0 ? "text-success" : "text-red-600")}>{formatChange(yoyTotal.changePct)}</td>
                </tr>
              </tfoot>
            </>
          )}
        </table>
      </div>
      {view === "yoy" && (
        <div className="space-y-1 border-t border-border px-6 py-3 text-[11px] text-muted-foreground">
          <p>Perancangan per month, team total: {yoyFormula(yoyTotal, yoyWindow, formatRM)}.</p>
          <p>Every row uses the same formula. {PREV_FY.key} comes from the Konvensyen {PREV_FY.key} sheet. The month in progress is left out so it doesn&rsquo;t pull the average down. &ldquo;&mdash;&rdquo; = no {PREV_FY.key} sales to compare against.</p>
        </div>
      )}
      {totalPages > 1 && (
        <div className="print:hidden">
          <PaginationFooter page={currentPage} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}
    </div>
  );
}
