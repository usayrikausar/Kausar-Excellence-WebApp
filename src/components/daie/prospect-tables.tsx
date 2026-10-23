"use client";

import { useMemo, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PaginationFooter } from "@/components/ui/pagination-footer";
import { ProspectDetailDialog } from "@/components/daie/prospect-detail-dialog";
import { STAGE_LABELS, SOURCE_LABELS } from "@/lib/constants";
import { PIPPPAS_STAGES, type PipppasStage, type SaleEntry } from "@/lib/types";
import { formatDate, formatRM } from "@/lib/utils";
import type { ProspectWithId } from "@/lib/data";

const PAGE_SIZE = 25;

const SERVICE_LABELS: Record<string, string> = {
  perancangan: "Perancangan",
  pengurusan: "Pengurusan (Al Wasitah)",
  kesPusaka: "Kes Pusaka",
};
const SUB_LABELS: Record<string, string> = { wasiat: "Wasiat", hibah: "Hibah", berlian: "Berlian", mutiara: "Mutiara", besar: "Besar", kecil: "Kecil" };

/** A client is a prospect who decided to subscribe — a sale was linked at Present Solution (agreed 2026-10-23). */
export function isClient(p: ProspectWithId): boolean {
  return !!p.linkedSaleId;
}

function daysAtStep(p: ProspectWithId): number {
  const since = new Date(p.updatedAt || p.createdAt).getTime();
  return Math.max(0, Math.floor((Date.now() - since) / 86_400_000));
}

function matchesSearch(p: ProspectWithId, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  const digits = needle.replace(/\D/g, "");
  return p.name.toLowerCase().includes(needle) || (digits.length > 0 && (p.phone ?? "").replace(/\D/g, "").includes(digits));
}

type Direction = "asc" | "desc";
function compare(a: string | number, b: string | number, direction: Direction) {
  const cmp = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b));
  return direction === "asc" ? cmp : -cmp;
}

function SortHeader<K extends string>({ label, sortKey, active, direction, onSort }: { label: string; sortKey: K; active: K; direction: Direction; onSort: (key: K) => void }) {
  return (
    <button type="button" onClick={() => onSort(sortKey)} className="flex items-center gap-1 hover:text-ink">
      {label}
      {sortKey === active && (direction === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
    </button>
  );
}

function useSort<K extends string>(initialKey: K, initialDirection: Direction = "asc") {
  const [sortKey, setSortKey] = useState<K>(initialKey);
  const [direction, setDirection] = useState<Direction>(initialDirection);
  function onSort(key: K) {
    if (key === sortKey) setDirection((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setDirection("asc");
    }
  }
  return { sortKey, direction, onSort };
}

function Toolbar({ id, search, onSearch, placeholder, children, shown, total }: { id: string; search: string; onSearch: (v: string) => void; placeholder: string; children?: React.ReactNode; shown: string; total: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border p-3 text-sm">
      <Input id={id} value={search} onChange={(e) => onSearch(e.target.value)} placeholder={placeholder} className="h-8 w-full sm:w-64" aria-label={placeholder} />
      {children}
      <span className="text-muted-foreground">{total === 0 ? "No one matches" : shown}</span>
    </div>
  );
}

function rangeLabel(page: number, total: number) {
  return `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, total)} of ${total}`;
}

// --- Prospects ------------------------------------------------------------------

type ProspectStatusFilter = "active" | "closed_lost" | "all";
const PROSPECT_STATUS_LABELS: Record<ProspectStatusFilter, string> = { active: "Active", closed_lost: "Lost", all: "All" };
type ProspectSortKey = "name" | "source" | "stage" | "days" | "followUp" | "added";

/** Everyone not (yet) a client — searchable, sortable, filterable by PIPPPAS step and status. */
export function ProspectListTable({ prospects }: { prospects: ProspectWithId[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ProspectStatusFilter>("active");
  const [stage, setStage] = useState<PipppasStage | "all">("all");
  const { sortKey, direction, onSort } = useSort<ProspectSortKey>("followUp");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const pool = useMemo(() => prospects.filter((p) => !isClient(p)), [prospects]);
  const rows = useMemo(() => {
    const filtered = pool.filter((p) => (status === "all" || p.status === status) && (stage === "all" || p.stage === stage) && matchesSearch(p, search.trim()));
    const value = (p: ProspectWithId): string | number => {
      switch (sortKey) {
        case "name": return p.name.toLowerCase();
        case "source": return SOURCE_LABELS[p.source] ?? p.source;
        case "stage": return PIPPPAS_STAGES.indexOf(p.stage);
        case "days": return daysAtStep(p);
        // No follow-up date sorts last either way.
        case "followUp": return p.nextFollowUpDate ?? (direction === "asc" ? "9999" : "0000");
        case "added": return p.createdAt;
      }
    };
    return filtered.sort((a, b) => compare(value(a), value(b), direction));
  }, [pool, status, stage, search, sortKey, direction]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageRows = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const selected = selectedId ? (prospects.find((p) => p.id === selectedId) ?? null) : null;
  const sortProps = { active: sortKey, direction, onSort: (k: ProspectSortKey) => { onSort(k); setPage(1); } };

  return (
    <div className="rounded-lg border border-border bg-white">
      <Toolbar id="prospect-search" search={search} onSearch={(v) => { setSearch(v); setPage(1); }} placeholder="Search name or phone" shown={rangeLabel(current, rows.length)} total={rows.length}>
        <Select value={status} onValueChange={(v) => { setStatus(v as ProspectStatusFilter); setPage(1); }}>
          <SelectTrigger id="prospect-status-filter" className="h-8 w-32" aria-label="Filter by status"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(PROSPECT_STATUS_LABELS) as ProspectStatusFilter[]).map((s) => (
              <SelectItem key={s} value={s}>{PROSPECT_STATUS_LABELS[s]} ({s === "all" ? pool.length : pool.filter((p) => p.status === s).length})</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={stage} onValueChange={(v) => { setStage(v as PipppasStage | "all"); setPage(1); }}>
          <SelectTrigger id="prospect-stage-filter" className="h-8 w-56" aria-label="Filter by PIPPPAS step"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All steps</SelectItem>
            {PIPPPAS_STAGES.map((s) => <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </Toolbar>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><SortHeader label="Name" sortKey="name" {...sortProps} /></TableHead>
              <TableHead>Phone</TableHead>
              <TableHead><SortHeader label="Source" sortKey="source" {...sortProps} /></TableHead>
              <TableHead><SortHeader label="PIPPPAS step" sortKey="stage" {...sortProps} /></TableHead>
              <TableHead className="text-right"><SortHeader label="Days at step" sortKey="days" {...sortProps} /></TableHead>
              <TableHead><SortHeader label="Next follow-up" sortKey="followUp" {...sortProps} /></TableHead>
              <TableHead><SortHeader label="Added" sortKey="added" {...sortProps} /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((p) => (
              <TableRow key={p.id} onClick={() => setSelectedId(p.id)} className="cursor-pointer">
                <TableCell className="font-medium">
                  <button type="button" className="text-left hover:text-primary hover:underline" onClick={(e) => { e.stopPropagation(); setSelectedId(p.id); }}>{p.name}</button>
                  {p.status === "closed_lost" && <Badge variant="muted" className="ml-2">Lost</Badge>}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{p.phone ?? "—"}</TableCell>
                <TableCell className="text-xs">{SOURCE_LABELS[p.source] ?? p.source}</TableCell>
                <TableCell><Badge variant="outline">{STAGE_LABELS[p.stage]}</Badge></TableCell>
                <TableCell className="text-right tabular-nums">{daysAtStep(p)}</TableCell>
                <TableCell className="whitespace-nowrap text-xs">{p.nextFollowUpDate ? formatDate(p.nextFollowUpDate) : "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(p.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <PaginationFooter page={current} totalPages={totalPages} onPageChange={setPage} />
      {selected && <ProspectDetailDialog key={selected.id} prospect={selected} open onOpenChange={(open) => !open && setSelectedId(null)} />}
    </div>
  );
}

// --- Clients ----------------------------------------------------------------------

type ClientFilter = "all" | "in_progress" | "completed";
const CLIENT_FILTER_LABELS: Record<ClientFilter, string> = { all: "All clients", in_progress: "After-sale in progress", completed: "Completed" };
type ClientSortKey = "name" | "service" | "value" | "signed" | "step";

/** Prospects who subscribed (sale linked) — what they took, when, and how far the after-sale steps are. */
export function ClientListTable({ prospects, sales }: { prospects: ProspectWithId[]; sales: SaleEntry[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ClientFilter>("all");
  const { sortKey, direction, onSort } = useSort<ClientSortKey>("signed", "desc");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const saleById = useMemo(() => new Map(sales.map((s) => [s.id, s])), [sales]);
  const clients = useMemo(() => prospects.filter(isClient).map((p) => ({ p, sale: saleById.get(p.linkedSaleId!) ?? null })), [prospects, saleById]);
  const isDone = (p: ProspectWithId) => p.status === "closed_won";

  const rows = useMemo(() => {
    const filtered = clients.filter(({ p }) => (filter === "all" || (filter === "completed") === isDone(p)) && matchesSearch(p, search.trim()));
    const value = ({ p, sale }: (typeof clients)[number]): string | number => {
      switch (sortKey) {
        case "name": return p.name.toLowerCase();
        case "service": return sale ? `${sale.category}-${sale.subCategory ?? ""}` : "";
        case "value": return sale?.amount ?? sale?.count ?? 0;
        case "signed": return sale?.date ?? p.updatedAt;
        case "step": return isDone(p) ? 99 : PIPPPAS_STAGES.indexOf(p.stage);
      }
    };
    return filtered.sort((a, b) => compare(value(a), value(b), direction));
  }, [clients, filter, search, sortKey, direction]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageRows = rows.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const selected = selectedId ? (prospects.find((p) => p.id === selectedId) ?? null) : null;
  const sortProps = { active: sortKey, direction, onSort: (k: ClientSortKey) => { onSort(k); setPage(1); } };
  const totalRM = rows.reduce((s, { sale }) => s + (sale?.amount ?? 0), 0);

  return (
    <div className="rounded-lg border border-border bg-white">
      <Toolbar id="client-search" search={search} onSearch={(v) => { setSearch(v); setPage(1); }} placeholder="Search client name or phone" shown={`${rangeLabel(current, rows.length)} · ${formatRM(totalRM)}`} total={rows.length}>
        <Select value={filter} onValueChange={(v) => { setFilter(v as ClientFilter); setPage(1); }}>
          <SelectTrigger id="client-step-filter" className="h-8 w-60" aria-label="Filter by after-sale progress"><SelectValue /></SelectTrigger>
          <SelectContent>
            {(Object.keys(CLIENT_FILTER_LABELS) as ClientFilter[]).map((f) => (
              <SelectItem key={f} value={f}>{CLIENT_FILTER_LABELS[f]} ({f === "all" ? clients.length : clients.filter(({ p }) => (f === "completed") === isDone(p)).length})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Toolbar>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><SortHeader label="Client" sortKey="name" {...sortProps} /></TableHead>
              <TableHead>Phone</TableHead>
              <TableHead><SortHeader label="Service" sortKey="service" {...sortProps} /></TableHead>
              <TableHead className="text-right"><SortHeader label="Value" sortKey="value" {...sortProps} /></TableHead>
              <TableHead><SortHeader label="Signed up" sortKey="signed" {...sortProps} /></TableHead>
              <TableHead><SortHeader label="After-sale step" sortKey="step" {...sortProps} /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map(({ p, sale }) => (
              <TableRow key={p.id} onClick={() => setSelectedId(p.id)} className="cursor-pointer">
                <TableCell className="font-medium">
                  <button type="button" className="text-left hover:text-primary hover:underline" onClick={(e) => { e.stopPropagation(); setSelectedId(p.id); }}>{p.name}</button>
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{p.phone ?? "—"}</TableCell>
                <TableCell className="text-xs">
                  {sale ? `${SERVICE_LABELS[sale.category] ?? sale.category}${sale.subCategory ? ` · ${SUB_LABELS[sale.subCategory] ?? sale.subCategory}` : ""}` : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">{sale ? (sale.amount != null ? formatRM(sale.amount) : `${sale.count ?? 0} case(s)`) : "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-xs">{sale ? formatDate(sale.date) : "—"}</TableCell>
                <TableCell>
                  {isDone(p) ? <Badge variant="success">Completed</Badge> : <Badge variant="outline">{STAGE_LABELS[p.stage]}</Badge>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <PaginationFooter page={current} totalPages={totalPages} onPageChange={setPage} />
      {selected && <ProspectDetailDialog key={selected.id} prospect={selected} open onOpenChange={(open) => !open && setSelectedId(null)} />}
    </div>
  );
}
