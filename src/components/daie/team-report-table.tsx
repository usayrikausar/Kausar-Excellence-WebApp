"use client";

import { useMemo, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TrafficLightDot } from "@/components/daie/traffic-light-dot";
import { TRAFFIC_LIGHT_STYLES } from "@/lib/scoring";
import { unitLabel } from "@/lib/constants";
import { cn, formatRM } from "@/lib/utils";
import type { TeamReportRow } from "@/lib/data";

type View = "traffic" | "sales" | "konvensyen";

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

type TrafficSortKey = "status" | "name" | "daieId" | "training" | "reach" | "presentations" | "sales" | "total";
type SalesSortKey = "name" | "daieId" | "rank" | "perancangan" | "berlian" | "mutiara" | "besar" | "kecil" | "collection";
type KonvensyenSortKey = "name" | "daieId" | "alWasitah" | "pusaka" | "rookieAlWasitah" | "rookiePerancangan" | "qualified";

export function TeamReportTable({ rows, units, showUnit }: { rows: TeamReportRow[]; units: Record<string, string>; showUnit: boolean }) {
  const [view, setView] = useState<View>("traffic");
  const [trafficSort, setTrafficSort] = useState<{ key: TrafficSortKey; dir: "asc" | "desc" }>({ key: "total", dir: "desc" });
  const [salesSort, setSalesSort] = useState<{ key: SalesSortKey; dir: "asc" | "desc" }>({ key: "perancangan", dir: "desc" });
  const [konvSort, setKonvSort] = useState<{ key: KonvensyenSortKey; dir: "asc" | "desc" }>({ key: "name", dir: "asc" });

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
        case "berlian": return row.sales.pengurusanBerlian;
        case "mutiara": return row.sales.pengurusanMutiara;
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
  }, [rows, salesSort]);

  const konvRows = useMemo(() => {
    const value = (row: TeamReportRow, key: KonvensyenSortKey): string | number => {
      switch (key) {
        case "name": return row.name;
        case "daieId": return row.daieId;
        case "alWasitah": return konv(row, "Al-Wasitah RT")?.value ?? -1;
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

  if (rows.length === 0) {
    return <p className="p-8 text-center text-sm text-muted-foreground">No downline to report on.</p>;
  }

  return (
    <div>
      <div className="flex gap-1 border-b border-border px-6 pt-4 print:hidden">
        {(["traffic", "sales", "konvensyen"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={cn("rounded-t-md px-3 py-2 text-sm font-medium", view === v ? "border border-b-0 border-border bg-white text-ink" : "text-muted-foreground hover:text-ink")}
          >
            {v === "traffic" ? "Traffic light" : v === "sales" ? "Sales by category" : "Convention qualifiers"}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
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
                  <th className="px-3 py-2.5 text-right"><SortHeaderButton align="right" label="Sales" sortKey="sales" activeSortKey={trafficSort.key} direction={trafficSort.dir} onSort={(k) => toggleSort(trafficSort, k, setTrafficSort)} /></th>
                  <th className="px-3 py-2.5 text-right"><SortHeaderButton align="right" label="Total" sortKey="total" activeSortKey={trafficSort.key} direction={trafficSort.dir} onSort={(k) => toggleSort(trafficSort, k, setTrafficSort)} /></th>
                </tr>
              </thead>
              <tbody>
                {trafficRows.map((row) => (
                  <tr key={row.uid} className={cn("border-b border-border", TRAFFIC_LIGHT_STYLES[row.score.color].rowClassName)}>
                    <td className="px-3 py-2"><TrafficLightDot color={row.score.color} withLabel /></td>
                    <td className="px-3 py-2 font-medium text-ink">{row.name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-ink">{row.daieId}</td>
                    {showUnit && <td className="px-3 py-2 text-ink">{unitLabel(row.unitId, units)}</td>}
                    <td className="px-3 py-2 text-right text-ink">{row.score.training.points}</td>
                    <td className="px-3 py-2 text-right text-ink">{row.score.reach.points}</td>
                    <td className="px-3 py-2 text-right text-ink">{row.score.presentations.points}</td>
                    <td className="px-3 py-2 text-right text-ink">{row.score.sales.points}</td>
                    <td className="px-3 py-2 text-right font-semibold text-ink">{row.score.total}</td>
                  </tr>
                ))}
              </tbody>
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
                  <th className="px-3 py-2.5 text-right"><SortHeaderButton align="right" label="Wasitah Berlian" sortKey="berlian" activeSortKey={salesSort.key} direction={salesSort.dir} onSort={(k) => toggleSort(salesSort, k, setSalesSort)} /></th>
                  <th className="px-3 py-2.5 text-right"><SortHeaderButton align="right" label="Wasitah Mutiara" sortKey="mutiara" activeSortKey={salesSort.key} direction={salesSort.dir} onSort={(k) => toggleSort(salesSort, k, setSalesSort)} /></th>
                  <th className="px-3 py-2.5 text-right"><SortHeaderButton align="right" label="Pusaka Besar" sortKey="besar" activeSortKey={salesSort.key} direction={salesSort.dir} onSort={(k) => toggleSort(salesSort, k, setSalesSort)} /></th>
                  <th className="px-3 py-2.5 text-right"><SortHeaderButton align="right" label="Pusaka Kecil" sortKey="kecil" activeSortKey={salesSort.key} direction={salesSort.dir} onSort={(k) => toggleSort(salesSort, k, setSalesSort)} /></th>
                  <th className="px-3 py-2.5 text-right"><SortHeaderButton align="right" label="Collection" sortKey="collection" activeSortKey={salesSort.key} direction={salesSort.dir} onSort={(k) => toggleSort(salesSort, k, setSalesSort)} /></th>
                </tr>
              </thead>
              <tbody>
                {salesRows.map((row) => (
                  <tr key={row.uid} className="border-b border-border">
                    <td className="px-3 py-2 font-medium text-ink">{row.name}</td>
                    <td className="px-3 py-2 font-mono text-xs text-ink">{row.daieId}</td>
                    <td className="px-3 py-2"><Badge variant="outline">{row.rank}</Badge></td>
                    {showUnit && <td className="px-3 py-2 text-ink">{unitLabel(row.unitId, units)}</td>}
                    <td className="px-3 py-2 text-right text-ink">{formatRM(row.sales.perancangan)}</td>
                    <td className="px-3 py-2 text-right text-ink">{row.sales.pengurusanBerlian}</td>
                    <td className="px-3 py-2 text-right text-ink">{row.sales.pengurusanMutiara}</td>
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
                  <th className="px-3 py-2.5 text-right"><SortHeaderButton align="right" label="Pusaka RT" sortKey="pusaka" activeSortKey={konvSort.key} direction={konvSort.dir} onSort={(k) => toggleSort(konvSort, k, setKonvSort)} /></th>
                  <th className="px-3 py-2.5 text-right"><SortHeaderButton align="right" label="Rookie Al-Wasitah" sortKey="rookieAlWasitah" activeSortKey={konvSort.key} direction={konvSort.dir} onSort={(k) => toggleSort(konvSort, k, setKonvSort)} /></th>
                  <th className="px-3 py-2.5 text-right"><SortHeaderButton align="right" label="Rookie Perancangan" sortKey="rookiePerancangan" activeSortKey={konvSort.key} direction={konvSort.dir} onSort={(k) => toggleSort(konvSort, k, setKonvSort)} /></th>
                  <th className="px-3 py-2.5 text-center"><SortHeaderButton label="Qualified" sortKey="qualified" activeSortKey={konvSort.key} direction={konvSort.dir} onSort={(k) => toggleSort(konvSort, k, setKonvSort)} /></th>
                </tr>
              </thead>
              <tbody>
                {konvRows.map((row) => {
                  const alWasitah = konv(row, "Al-Wasitah RT");
                  const pusaka = konv(row, "Pusaka RT");
                  const rookieAlWasitah = konv(row, "Rookie Al-Wasitah");
                  const rookiePerancangan = konv(row, "Rookie Perancangan");
                  return (
                    <tr key={row.uid} className="border-b border-border">
                      <td className="px-3 py-2 font-medium text-ink">{row.name}</td>
                      <td className="px-3 py-2 font-mono text-xs text-ink">{row.daieId}</td>
                      {showUnit && <td className="px-3 py-2 text-ink">{unitLabel(row.unitId, units)}</td>}
                      <td className={cn("px-3 py-2 text-right", alWasitah?.met ? "text-success" : "text-ink")}>{alWasitah ? `${alWasitah.value}/${alWasitah.target}` : "—"}</td>
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
        </table>
      </div>
    </div>
  );
}
