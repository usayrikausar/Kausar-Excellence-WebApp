"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, FileText, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { TEAM_STATUS_FILTERS, matchesStatus, type TeamStatusFilter } from "@/components/daie/team-table";
import { unitLabel } from "@/lib/constants";
import type { CurrentUser } from "@/lib/types";
import { cn, contractExpiryDate, daysUntilExpiry, formatDate, formatRM, isActiveStatus, isExpiryReminderDue } from "@/lib/utils";

// Mirrors lib/data.ts's TeamMember (that file is server-only).
type TeamMember = CurrentUser & {
  salesTotal: number;
  collectionTotal: number;
  wasitahTotal: number;
  pusakaTotal: number;
};

const CHIP_LABELS: Record<TeamStatusFilter, string> = {
  all: "All",
  active: "Active",
  expired: "Expired",
  expiring6: "Expiring in 6 months",
  expiring3: "Expiring in 3 months",
};

type SortKey = "name" | "sales" | "expiry";
const SORT_LABELS: Record<SortKey, string> = { name: "Name", sales: "Sales", expiry: "Expiry date" };
const PAGE = 30;

function rm(n: number) {
  return formatRM(Math.round(n)).replace(/\.00$/, "");
}

/**
 * My Team on a phone (below `lg`; desktop keeps the tree and the table).
 * Structure: drill down one level at a time, with a breadcrumb back up.
 * List: everyone, with status chips, search and sort. Each card opens to
 * the full figures and a link to the report card (same tab).
 */
export function PhoneTeam({
  team,
  rootUid,
  viewerName,
  outsideNames,
  showUnit,
  units,
  initialStatus = "all",
}: {
  team: TeamMember[];
  /** The viewer (their downline view), or null for a whole unit / all units. */
  rootUid: string | null;
  viewerName: string;
  outsideNames?: Record<string, string>;
  showUnit: boolean;
  units: Record<string, string>;
  initialStatus?: TeamStatusFilter;
}) {
  const [mode, setMode] = useState<"structure" | "list">(initialStatus !== "all" ? "list" : "structure");
  const [status, setStatus] = useState<TeamStatusFilter>(initialStatus);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>(initialStatus.startsWith("expiring") ? "expiry" : "name");
  const [path, setPath] = useState<string[]>([]); // drill-down: uids from the top level down
  const [shown, setShown] = useState(PAGE);
  const [openUid, setOpenUid] = useState<string | null>(null);

  const byUid = useMemo(() => new Map(team.map((m) => [m.uid, m])), [team]);
  const childrenOf = useMemo(() => {
    const map = new Map<string | null, TeamMember[]>();
    for (const m of team) {
      // Top level: the viewer's direct reports, or (unit / all units) anyone whose upline isn't in view.
      const parent = m.uplineId && (m.uplineId === rootUid || !byUid.has(m.uplineId)) ? null : m.uplineId;
      map.set(parent, [...(map.get(parent) ?? []), m]);
    }
    return map;
  }, [team, rootUid, byUid]);
  const counts = useMemo(
    () => Object.fromEntries(TEAM_STATUS_FILTERS.map((f) => [f, team.filter((m) => matchesStatus(m, f)).length])) as Record<TeamStatusFilter, number>,
    [team],
  );

  function uplineName(m: TeamMember) {
    if (!m.uplineId) return "—";
    if (m.uplineId === rootUid) return viewerName;
    return byUid.get(m.uplineId)?.name ?? outsideNames?.[m.uplineId] ?? "—";
  }

  const current = path.length ? path[path.length - 1] : null;
  const rows = useMemo(() => {
    let list: TeamMember[];
    if (mode === "structure") {
      list = [...(childrenOf.get(current) ?? [])];
    } else {
      const q = query.trim().toLowerCase();
      list = team.filter((m) => matchesStatus(m, status) && (!q || m.name.toLowerCase().includes(q) || String(m.daieId).toLowerCase().includes(q)));
    }
    list.sort((a, b) => {
      if (sort === "sales") return b.salesTotal - a.salesTotal;
      if (sort === "expiry") return (contractExpiryDate(a)?.getTime() ?? Infinity) - (contractExpiryDate(b)?.getTime() ?? Infinity);
      return a.name.localeCompare(b.name);
    });
    return list;
  }, [mode, childrenOf, current, team, status, query, sort]);

  function goList(next: TeamStatusFilter) {
    setMode("list");
    setStatus(next);
    if (next.startsWith("expiring")) setSort("expiry");
    setShown(PAGE);
  }

  if (team.length === 0) return <p className="p-6 text-sm text-muted-foreground">No downline yet.</p>;

  return (
    <div className="space-y-3">
      {/* Structure / List */}
      <div role="tablist" aria-label="Team view" className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        {(["structure", "list"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setShown(PAGE);
              if (m === "structure") {
                setStatus("all");
                setQuery("");
              }
            }}
            className={cn("rounded-md py-2 text-sm font-semibold", mode === m ? "bg-white text-ink shadow-sm" : "text-muted-foreground")}
          >
            {m === "structure" ? "By upline" : "Everyone"}
          </button>
        ))}
      </div>

      {/* Search, always available: typing switches to Everyone */}
      <label className="flex items-center gap-2 rounded-lg border border-border bg-white px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="sr-only">Search by name or Daie ID</span>
        <input
          id="team-search"
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value && mode !== "list") setMode("list");
            setShown(PAGE);
          }}
          placeholder="Search name or Daie ID"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </label>

      {/* Status chips */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        {TEAM_STATUS_FILTERS.map((f) => {
          const on = mode === "list" && status === f;
          return (
            <button
              key={f}
              type="button"
              onClick={() => goList(f)}
              aria-pressed={on}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold",
                on ? "border-primary bg-primary text-white" : "border-border bg-white text-ink",
                (f === "expired" || f.startsWith("expiring")) && !on && counts[f] > 0 && "text-red-700",
              )}
            >
              {CHIP_LABELS[f]} · {counts[f]}
            </button>
          );
        })}
      </div>

      {/* Breadcrumb (structure) or result count + sort (list) */}
      <div className="flex items-center justify-between gap-2 text-xs">
        {mode === "structure" ? (
          <nav aria-label="Team level" className="flex min-w-0 flex-wrap items-center gap-1 text-muted-foreground">
            <button type="button" onClick={() => { setPath([]); setShown(PAGE); }} className={cn("font-semibold", path.length ? "text-primary" : "text-ink")}>
              {rootUid ? viewerName : "Top"}
            </button>
            {path.map((uid, i) => (
              <span key={uid} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3" aria-hidden />
                <button
                  type="button"
                  onClick={() => { setPath(path.slice(0, i + 1)); setShown(PAGE); }}
                  className={cn("max-w-[9rem] truncate font-semibold", i === path.length - 1 ? "text-ink" : "text-primary")}
                >
                  {byUid.get(uid)?.name ?? "—"}
                </button>
              </span>
            ))}
          </nav>
        ) : (
          <span className="text-muted-foreground">{rows.length === 0 ? "No one matches" : `${rows.length} ${rows.length === 1 ? "person" : "people"}`}</span>
        )}
        <label className="flex shrink-0 items-center gap-1 text-muted-foreground">
          Sort
          <select id="team-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-md border border-border bg-white px-1.5 py-1 font-semibold text-ink">
            {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
              <option key={k} value={k}>{SORT_LABELS[k]}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Cards */}
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {mode === "structure" ? "No downline at this level." : "No one matches."}
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.slice(0, shown).map((m) => {
            const active = isActiveStatus(m);
            const expiry = contractExpiryDate(m);
            const due = isExpiryReminderDue(m);
            const kids = childrenOf.get(m.uid)?.length ?? 0;
            const open = openUid === m.uid;
            return (
              <li key={m.uid} className="overflow-hidden rounded-xl border border-border bg-white">
                <button type="button" onClick={() => setOpenUid(open ? null : m.uid)} aria-expanded={open} className="flex w-full items-start gap-3 p-3 text-left">
                  <span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", active ? "bg-success" : "bg-red-600")} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold leading-snug text-ink [overflow-wrap:anywhere]">
                      {m.name}{" "}
                      <Badge variant="outline" className="ml-0.5 px-1.5 py-0 align-middle text-[10px]">{m.rank}</Badge>
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {m.daieId} · {active ? "Active" : "Expired"}
                      {showUnit && ` · ${unitLabel(m.unitId, units)}`}
                      {kids > 0 && ` · ${kids} downline`}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">Upline: {uplineName(m)}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-bold tabular-nums text-ink">{rm(m.salesTotal)}</span>
                    <span className={cn("block text-[11px]", due ? "font-semibold text-red-700" : "text-muted-foreground")}>
                      {expiry ? `Exp ${formatDate(expiry)}${due ? ` (${daysUntilExpiry(m)}d)` : ""}` : "No expiry"}
                    </span>
                  </span>
                  <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden />
                </button>

                {open && (
                  <div className="space-y-3 border-t border-border bg-muted/40 p-3">
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                      <div><dt className="text-muted-foreground">Total sales</dt><dd className="font-semibold text-ink">{rm(m.salesTotal)}</dd></div>
                      <div><dt className="text-muted-foreground">Total collection</dt><dd className="font-semibold text-ink">{rm(m.collectionTotal)}</dd></div>
                      <div><dt className="text-muted-foreground">Total Wasitah</dt><dd className="font-semibold text-ink">{m.wasitahTotal} case{m.wasitahTotal === 1 ? "" : "s"}</dd></div>
                      <div><dt className="text-muted-foreground">Total Pusaka</dt><dd className="font-semibold text-ink">{rm(m.pusakaTotal)}</dd></div>
                      <div><dt className="text-muted-foreground">Licensed</dt><dd className="font-semibold text-ink">{m.dateLicensed ? formatDate(m.dateLicensed) : "—"}</dd></div>
                      <div><dt className="text-muted-foreground">Expiry</dt><dd className={cn("font-semibold", due ? "text-red-700" : "text-ink")}>{expiry ? formatDate(expiry) : "—"}</dd></div>
                    </dl>
                    <div className="flex gap-2">
                      <Link href={`/report-card/${m.uid}`} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white">
                        <FileText className="h-4 w-4" aria-hidden /> Report card
                      </Link>
                      {kids > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setMode("structure");
                            setStatus("all");
                            setQuery("");
                            // Jump into this person's downline, keeping the path to them.
                            const chain: string[] = [];
                            for (let cur: TeamMember | undefined = m; cur && cur.uid !== rootUid; cur = cur.uplineId ? byUid.get(cur.uplineId) : undefined) chain.unshift(cur.uid);
                            setPath(chain);
                            setOpenUid(null);
                            setShown(PAGE);
                          }}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-sm font-semibold text-ink"
                        >
                          <Users className="h-4 w-4" aria-hidden /> Downline ({kids})
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {rows.length > shown && (
        <button type="button" onClick={() => setShown((n) => n + PAGE)} className="w-full rounded-lg border border-border bg-white py-2.5 text-sm font-semibold text-primary">
          Show more ({rows.length - shown} left)
        </button>
      )}
    </div>
  );
}
