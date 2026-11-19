"use client";

// My Activities on a phone (below `lg`; desktop keeps the board and tables).
// Agreed 2026-11-19: pipeline as stage chips + a card list, Prospects and
// Clients as searchable card lists, the team traffic light as cards, and
// Call / WhatsApp on every prospect with a phone number.

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, MessageCircle, Phone, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProspectDetailDialog } from "@/components/daie/prospect-detail-dialog";
import { TrafficLightDot } from "@/components/daie/traffic-light-dot";
import { isClient } from "@/components/daie/prospect-tables";
import { STAGE_LABELS, SOURCE_LABELS } from "@/lib/constants";
import { PIPPPAS_STAGES, type PipppasStage, type SaleEntry } from "@/lib/types";
import { TRAFFIC_LIGHT_STYLES, criteriaNeededForGreen, criteriaStatus, type TrafficLightColor } from "@/lib/scoring";
import { cn, formatDate, formatRM } from "@/lib/utils";
import type { ProspectWithId } from "@/lib/data";
import type { TeamScoreRow } from "@/components/daie/team-traffic-light-table";

const PAGE = 20;

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

/** Malaysian numbers for wa.me: 012-345 6789 -> 60123456789; +60… and 60… kept. */
export function whatsappNumber(phone: string): string | null {
  let d = phone.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("0")) d = `6${d}`;
  return d.length >= 9 ? d : null;
}

function ContactButtons({ phone }: { phone: string | null }) {
  if (!phone) return null;
  const wa = whatsappNumber(phone);
  return (
    <div className="flex gap-2">
      <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-2.5 py-1 text-xs font-semibold text-ink active:bg-muted">
        <Phone className="h-3.5 w-3.5" aria-hidden /> Call
      </a>
      {wa && (
        <a
          href={`https://wa.me/${wa}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-2.5 py-1 text-xs font-semibold text-success active:bg-muted"
        >
          <MessageCircle className="h-3.5 w-3.5" aria-hidden /> WhatsApp
        </a>
      )}
    </div>
  );
}

function SearchBox({ id, value, onChange, placeholder }: { id: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2">
      <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="sr-only">{placeholder}</span>
      <input id={id} type="search" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
    </label>
  );
}

function Chips<T extends string>({ options, value, onChange, label }: { options: Array<{ value: T; label: string }>; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold",
            value === o.value ? "border-primary bg-primary text-white" : "border-border bg-white text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ShowMore({ left, onClick }: { left: number; onClick: () => void }) {
  if (left <= 0) return null;
  return (
    <button type="button" onClick={onClick} className="w-full rounded-lg border border-border bg-white py-2.5 text-sm font-semibold text-primary">
      Show more ({left} left)
    </button>
  );
}

/** One prospect: tap to open the existing detail dialog. */
function ProspectCard({ p, onOpen, extra }: { p: ProspectWithId; onOpen: () => void; extra?: React.ReactNode }) {
  return (
    <li className="rounded-xl border border-border bg-white">
      <button type="button" onClick={onOpen} className="block w-full p-3 text-left">
        <span className="flex items-start justify-between gap-2">
          <span className="text-sm font-semibold leading-snug text-ink">{p.name}</span>
          {p.status === "closed_lost" ? <Badge variant="muted">Lost</Badge> : <Badge variant="outline" className="shrink-0 text-[10px]">{STAGE_LABELS[p.stage]}</Badge>}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {SOURCE_LABELS[p.source] ?? p.source} · {daysAtStep(p)}d at this step
        </span>
        {p.nextFollowUpDate && <span className="mt-0.5 block text-xs font-semibold text-primary">Follow up {formatDate(p.nextFollowUpDate)}</span>}
        {extra}
      </button>
      {p.phone && (
        <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2">
          <span className="text-xs text-muted-foreground">{p.phone}</span>
          <ContactButtons phone={p.phone} />
        </div>
      )}
    </li>
  );
}

function useDetail(prospects: ProspectWithId[]) {
  // Keep only the id so the open dialog follows fresh data after a save.
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = selectedId ? (prospects.find((p) => p.id === selectedId) ?? null) : null;
  const dialog = selected ? <ProspectDetailDialog key={selected.id} prospect={selected} open onOpenChange={(open) => !open && setSelectedId(null)} /> : null;
  return { open: setSelectedId, dialog };
}

/** Board: pick a PIPPPAS step, see its prospects. */
export function PhonePipeline({ prospects }: { prospects: ProspectWithId[] }) {
  const active = useMemo(() => prospects.filter((p) => p.status === "active"), [prospects]);
  const counts = useMemo(() => Object.fromEntries(PIPPPAS_STAGES.map((s) => [s, active.filter((p) => p.stage === s).length])) as Record<PipppasStage, number>, [active]);
  // Open on the first step that has anyone in it.
  const [stage, setStage] = useState<PipppasStage>(() => PIPPPAS_STAGES.find((s) => counts[s] > 0) ?? PIPPPAS_STAGES[0]);
  const [shown, setShown] = useState(PAGE);
  const { open, dialog } = useDetail(prospects);
  const items = active
    .filter((p) => p.stage === stage)
    .sort((a, b) => (a.nextFollowUpDate ?? "9999").localeCompare(b.nextFollowUpDate ?? "9999") || a.name.localeCompare(b.name));

  return (
    <div className="space-y-3">
      <Chips
        label="PIPPPAS step"
        value={stage}
        onChange={(s) => { setStage(s); setShown(PAGE); }}
        options={PIPPPAS_STAGES.map((s) => ({ value: s, label: `${STAGE_LABELS[s]} · ${counts[s]}` }))}
      />
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No one at {STAGE_LABELS[stage]}.</p>
      ) : (
        <ul className="space-y-2">
          {items.slice(0, shown).map((p) => <ProspectCard key={p.id} p={p} onOpen={() => open(p.id)} />)}
        </ul>
      )}
      <ShowMore left={items.length - shown} onClick={() => setShown((n) => n + PAGE)} />
      {dialog}
    </div>
  );
}

type ProspectStatusFilter = "active" | "closed_lost" | "all";

/** Prospects (not yet clients): search, status chips, step filter, sorted by next follow-up. */
export function PhoneProspectList({ prospects }: { prospects: ProspectWithId[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ProspectStatusFilter>("active");
  const [stage, setStage] = useState<PipppasStage | "all">("all");
  const [shown, setShown] = useState(PAGE);
  const { open, dialog } = useDetail(prospects);
  const pool = useMemo(() => prospects.filter((p) => !isClient(p)), [prospects]);
  const rows = pool
    .filter((p) => (status === "all" || p.status === status) && (stage === "all" || p.stage === stage) && matchesSearch(p, search.trim()))
    .sort((a, b) => (a.nextFollowUpDate ?? "9999").localeCompare(b.nextFollowUpDate ?? "9999") || a.name.localeCompare(b.name));
  const count = (s: ProspectStatusFilter) => (s === "all" ? pool.length : pool.filter((p) => p.status === s).length);

  return (
    <div className="space-y-3">
      <SearchBox id="phone-prospect-search" value={search} onChange={(v) => { setSearch(v); setShown(PAGE); }} placeholder="Search name or phone" />
      <Chips
        label="Status"
        value={status}
        onChange={(v) => { setStatus(v); setShown(PAGE); }}
        options={[
          { value: "active", label: `Active · ${count("active")}` },
          { value: "closed_lost", label: `Lost · ${count("closed_lost")}` },
          { value: "all", label: `All · ${count("all")}` },
        ]}
      />
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        Step
        <select id="phone-prospect-stage" value={stage} onChange={(e) => { setStage(e.target.value as PipppasStage | "all"); setShown(PAGE); }} className="min-w-0 flex-1 rounded-md border border-border bg-white px-2 py-1.5 text-sm font-semibold text-ink">
          <option value="all">All steps</option>
          {PIPPPAS_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
        </select>
      </label>
      <p className="text-xs text-muted-foreground">{rows.length === 0 ? "No one matches." : `${rows.length} prospect${rows.length === 1 ? "" : "s"} · soonest follow-up first`}</p>
      <ul className="space-y-2">
        {rows.slice(0, shown).map((p) => <ProspectCard key={p.id} p={p} onOpen={() => open(p.id)} />)}
      </ul>
      <ShowMore left={rows.length - shown} onClick={() => setShown((n) => n + PAGE)} />
      {dialog}
    </div>
  );
}

const SERVICE_LABELS: Record<string, string> = { perancangan: "Perancangan", pengurusan: "Al Wasitah", kesPusaka: "Kes Pusaka" };
const SUB_LABELS: Record<string, string> = { wasiat: "Wasiat", hibah: "Hibah", berlian: "Berlian", mutiara: "Mutiara", besar: "Besar", kecil: "Kecil" };
type ClientFilter = "all" | "in_progress" | "completed";

/** Clients (a sale is linked): what they took, when, and the after-sale step. Newest first. */
export function PhoneClientList({ prospects, sales }: { prospects: ProspectWithId[]; sales: SaleEntry[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ClientFilter>("all");
  const [shown, setShown] = useState(PAGE);
  const { open, dialog } = useDetail(prospects);
  const saleById = useMemo(() => new Map(sales.map((s) => [s.id, s])), [sales]);
  const clients = useMemo(() => prospects.filter(isClient).map((p) => ({ p, sale: saleById.get(p.linkedSaleId!) ?? null })), [prospects, saleById]);
  const done = (p: ProspectWithId) => p.status === "closed_won";
  const rows = clients
    .filter(({ p }) => (filter === "all" || (filter === "completed") === done(p)) && matchesSearch(p, search.trim()))
    .sort((a, b) => (b.sale?.date ?? b.p.updatedAt).localeCompare(a.sale?.date ?? a.p.updatedAt));
  const count = (f: ClientFilter) => (f === "all" ? clients.length : clients.filter(({ p }) => (f === "completed") === done(p)).length);
  const totalRM = rows.reduce((s, { sale }) => s + (sale?.amount ?? 0), 0);

  return (
    <div className="space-y-3">
      <SearchBox id="phone-client-search" value={search} onChange={(v) => { setSearch(v); setShown(PAGE); }} placeholder="Search client name or phone" />
      <Chips
        label="After-sale progress"
        value={filter}
        onChange={(v) => { setFilter(v); setShown(PAGE); }}
        options={[
          { value: "all", label: `All · ${count("all")}` },
          { value: "in_progress", label: `In progress · ${count("in_progress")}` },
          { value: "completed", label: `Completed · ${count("completed")}` },
        ]}
      />
      <p className="text-xs text-muted-foreground">{rows.length === 0 ? "No one matches." : `${rows.length} client${rows.length === 1 ? "" : "s"} · ${formatRM(totalRM)}`}</p>
      <ul className="space-y-2">
        {rows.slice(0, shown).map(({ p, sale }) => (
          <ProspectCard
            key={p.id}
            p={done(p) ? { ...p, nextFollowUpDate: null } : p}
            onOpen={() => open(p.id)}
            extra={
              <span className="mt-1.5 flex items-center justify-between gap-2 rounded-lg bg-muted px-2.5 py-1.5 text-xs">
                <span className="text-ink">
                  {sale ? `${SERVICE_LABELS[sale.category] ?? sale.category}${sale.subCategory ? ` · ${SUB_LABELS[sale.subCategory] ?? sale.subCategory}` : ""} · ${formatDate(sale.date)}` : "Sale details not found"}
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-ink">
                  {sale ? (sale.amount != null ? formatRM(sale.amount) : `${sale.count ?? 0} kes`) : ""}
                </span>
              </span>
            }
          />
        ))}
      </ul>
      <ShowMore left={rows.length - shown} onClick={() => setShown((n) => n + PAGE)} />
      {dialog}
    </div>
  );
}

const COLORS: TrafficLightColor[] = ["green", "amber", "red", "black"];

/** Leaders: the team's traffic light as cards, grouped green → black, filterable by colour. */
export function PhoneTeamTraffic({ rows, monthLabel }: { rows: TeamScoreRow[]; monthLabel: string }) {
  const [color, setColor] = useState<TrafficLightColor | "all">("all");
  const [shown, setShown] = useState(PAGE);
  const sorted = [...rows].sort((a, b) => TRAFFIC_LIGHT_STYLES[a.score.color].order - TRAFFIC_LIGHT_STYLES[b.score.color].order || b.score.total - a.score.total);
  const list = color === "all" ? sorted : sorted.filter((r) => r.score.color === color);
  const count = (c: TrafficLightColor) => rows.filter((r) => r.score.color === c).length;

  if (rows.length === 0) return <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No downline yet.</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{monthLabel} · green needs 4 of 5 criteria.</p>
      <Chips
        label="Traffic light colour"
        value={color}
        onChange={(v) => { setColor(v); setShown(PAGE); }}
        options={[{ value: "all" as const, label: `All · ${rows.length}` }, ...COLORS.map((c) => ({ value: c, label: `${TRAFFIC_LIGHT_STYLES[c].label} · ${count(c)}` }))]}
      />
      <ul className="space-y-2">
        {list.slice(0, shown).map((row) => {
          const needed = criteriaNeededForGreen(row.score);
          return (
            <li key={row.uid} className={cn("rounded-xl border border-border p-3", TRAFFIC_LIGHT_STYLES[row.score.color].rowClassName)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                    <TrafficLightDot color={row.score.color} /> <span className="leading-snug">{row.name}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{row.daieId} · {needed === 0 ? "Green" : `${needed} more to green`}</p>
                </div>
                <span className="shrink-0 text-lg font-extrabold tabular-nums text-ink">{row.score.total}</span>
              </div>
              <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                {criteriaStatus(row.score).map((c) => (
                  <li key={c.key} className="flex items-center justify-between gap-2">
                    <span className="truncate text-muted-foreground">{c.label}</span>
                    <span className={cn("shrink-0 font-semibold tabular-nums", c.met ? "text-success" : "text-red-700")}>
                      {c.isMoney ? `${Math.round(c.done / 1000)}k/${Math.round(c.target / 1000)}k` : `${c.done}/${c.target}`} {c.met ? "✓" : "✗"}
                    </span>
                  </li>
                ))}
              </ul>
              <Link href={`/report-card/${row.uid}?month=${row.score.monthKey}&view=activities`} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                <FileText className="h-3.5 w-3.5" aria-hidden /> Activity report card
              </Link>
            </li>
          );
        })}
      </ul>
      <ShowMore left={list.length - shown} onClick={() => setShown((n) => n + PAGE)} />
    </div>
  );
}
