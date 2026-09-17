"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronUp, ChevronDown, FileText } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PaginationFooter } from "@/components/ui/pagination-footer";
import { unitLabel, REGION_LABELS } from "@/lib/constants";
import type { CurrentUser } from "@/lib/types";
import { contractExpiryDate, daysUntilExpiry, isExpiryReminderDue, formatDate, formatRM, isActiveStatus } from "@/lib/utils";

type TeamMember = CurrentUser & {
  salesTotal: number;
  collectionTotal: number;
  wasitahTotal: number;
  pusakaTotal: number;
};

type SortKey = "status" | "daieId" | "rank" | "name" | "region" | "salesTotal" | "collectionTotal" | "wasitahTotal" | "pusakaTotal" | "dateLicensed" | "expiry";

function sortValue(member: TeamMember, key: SortKey): string | number {
  switch (key) {
    case "status":
      return isActiveStatus(member) ? 1 : 0;
    case "region":
      return REGION_LABELS[member.region];
    case "expiry": {
      const expiry = contractExpiryDate(member);
      return expiry ? expiry.getTime() : 0;
    }
    case "dateLicensed":
      return member.dateLicensed ?? "";
    default:
      return member[key];
  }
}

function SortHeaderButton({ label, sortKey, activeSortKey, direction, onSort }: {
  label: string;
  sortKey: SortKey;
  activeSortKey: SortKey;
  direction: "asc" | "desc";
  onSort: (key: SortKey) => void;
}) {
  const isActive = sortKey === activeSortKey;
  return (
    <button type="button" onClick={() => onSort(sortKey)} className="flex items-center gap-1 hover:text-ink">
      {label}
      {isActive && (direction === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
    </button>
  );
}

export function TeamTable({
  team,
  rootUid,
  viewerName,
  showUnit,
  units,
}: {
  team: TeamMember[];
  rootUid: string | null;
  viewerName: string;
  showUnit: boolean;
  units: Record<string, string>;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  const nameByUid = useMemo(() => {
    const map = new Map<string, string>();
    for (const member of team) map.set(member.uid, member.name);
    return map;
  }, [team]);

  function uplineName(member: TeamMember): string {
    if (!member.uplineId) return "—";
    if (member.uplineId === rootUid) return viewerName;
    return nameByUid.get(member.uplineId) ?? "—";
  }

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setDirection("asc");
    }
    setPage(1);
  }

  const sorted = useMemo(() => {
    const copy = [...team];
    copy.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return direction === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [team, sortKey, direction]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const pageRows = sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  if (team.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">No downline yet.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border p-3 text-sm">
        <span className="text-muted-foreground">
          Showing {(clampedPage - 1) * pageSize + 1}–{Math.min(clampedPage * pageSize, sorted.length)} of {sorted.length}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Rows per page</span>
          <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
            <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead><SortHeaderButton label="Status" sortKey="status" activeSortKey={sortKey} direction={direction} onSort={handleSort} /></TableHead>
              <TableHead><SortHeaderButton label="Region" sortKey="region" activeSortKey={sortKey} direction={direction} onSort={handleSort} /></TableHead>
              <TableHead><SortHeaderButton label="Daie ID" sortKey="daieId" activeSortKey={sortKey} direction={direction} onSort={handleSort} /></TableHead>
              <TableHead><SortHeaderButton label="Rank" sortKey="rank" activeSortKey={sortKey} direction={direction} onSort={handleSort} /></TableHead>
              <TableHead><SortHeaderButton label="Name" sortKey="name" activeSortKey={sortKey} direction={direction} onSort={handleSort} /></TableHead>
              {showUnit && <TableHead>Unit</TableHead>}
              <TableHead>Upline</TableHead>
              <TableHead className="text-right"><SortHeaderButton label="Total sales" sortKey="salesTotal" activeSortKey={sortKey} direction={direction} onSort={handleSort} /></TableHead>
              <TableHead className="text-right"><SortHeaderButton label="Total collection" sortKey="collectionTotal" activeSortKey={sortKey} direction={direction} onSort={handleSort} /></TableHead>
              <TableHead className="text-right"><SortHeaderButton label="Total Wasitah" sortKey="wasitahTotal" activeSortKey={sortKey} direction={direction} onSort={handleSort} /></TableHead>
              <TableHead className="text-right"><SortHeaderButton label="Total Pusaka" sortKey="pusakaTotal" activeSortKey={sortKey} direction={direction} onSort={handleSort} /></TableHead>
              <TableHead><SortHeaderButton label="Date licensed" sortKey="dateLicensed" activeSortKey={sortKey} direction={direction} onSort={handleSort} /></TableHead>
              <TableHead><SortHeaderButton label="Date expiry" sortKey="expiry" activeSortKey={sortKey} direction={direction} onSort={handleSort} /></TableHead>
              <TableHead>Report card</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((member, i) => {
              const isActive = isActiveStatus(member);
              const expiry = contractExpiryDate(member);
              const expiryDays = daysUntilExpiry(member);
              const reminderDue = isExpiryReminderDue(member);
              return (
                <TableRow key={member.uid}>
                  <TableCell className="text-xs text-muted-foreground">{(clampedPage - 1) * pageSize + i + 1}</TableCell>
                  <TableCell>
                    <Badge variant={isActive ? "success" : "destructive"}>{isActive ? "Active" : "Non-Active (Expired)"}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{REGION_LABELS[member.region].split(" (")[0]}</TableCell>
                  <TableCell className="font-mono text-xs">{member.daieId}</TableCell>
                  <TableCell><Badge variant="outline">{member.rank}</Badge></TableCell>
                  <TableCell className="font-medium">{member.name}</TableCell>
                  {showUnit && <TableCell>{unitLabel(member.unitId, units)}</TableCell>}
                  <TableCell className="text-xs text-muted-foreground">{uplineName(member)}</TableCell>
                  <TableCell className="text-right">{formatRM(member.salesTotal)}</TableCell>
                  <TableCell className="text-right">{formatRM(member.collectionTotal)}</TableCell>
                  <TableCell className="text-right">{member.wasitahTotal} case(s)</TableCell>
                  <TableCell className="text-right">{formatRM(member.pusakaTotal)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{member.dateLicensed ? formatDate(member.dateLicensed) : "—"}</TableCell>
                  <TableCell className="text-xs">
                    {expiry ? (
                      <span className={reminderDue ? "font-semibold text-red-700" : "text-muted-foreground"}>
                        {formatDate(expiry)}
                        {reminderDue && ` (${expiryDays}d)`}
                      </span>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <Link href={`/report-card/${member.uid}`} target="_blank" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                      <FileText className="h-3.5 w-3.5" /> Print
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <PaginationFooter page={clampedPage} totalPages={totalPages} onPageChange={setPage} />
    </div>
  );
}
