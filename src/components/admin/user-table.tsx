"use client";

import { useMemo, useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PaginationFooter } from "@/components/ui/pagination-footer";
import { EditUserDialog } from "@/components/admin/edit-user-dialog";
import { SubscriptionToggle } from "@/components/admin/subscription-toggle";
import { unitLabel } from "@/lib/constants";
import { isActiveStatus } from "@/lib/utils";
import type { CurrentUser } from "@/lib/types";

/** Whole-subtree active/expired counts (every descendant, not just direct reports) for every uid that has one. */
function buildSubtreeCounts(users: CurrentUser[]): Map<string, { active: number; expired: number }> {
  const childrenByParent = new Map<string | null, CurrentUser[]>();
  for (const user of users) {
    const key = user.uplineId;
    if (!childrenByParent.has(key)) childrenByParent.set(key, []);
    childrenByParent.get(key)!.push(user);
  }

  const memo = new Map<string, { active: number; expired: number }>();
  function countBelow(uid: string): { active: number; expired: number } {
    const cached = memo.get(uid);
    if (cached) return cached;
    let active = 0;
    let expired = 0;
    for (const child of childrenByParent.get(uid) ?? []) {
      if (isActiveStatus(child)) active++;
      else expired++;
      const below = countBelow(child.uid);
      active += below.active;
      expired += below.expired;
    }
    const result = { active, expired };
    memo.set(uid, result);
    return result;
  }
  for (const user of users) countBelow(user.uid);
  return memo;
}

type SortKey = "daieId" | "name" | "rank" | "unitId" | "status";

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

export function UserTable({ users, units }: { users: CurrentUser[]; units: Record<string, string> }) {
  const [sortKey, setSortKey] = useState<SortKey>("daieId");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [pageSize, setPageSize] = useState(100);
  const [page, setPage] = useState(1);

  const subtreeCounts = buildSubtreeCounts(users);
  const nameByUid = new Map(users.map((u) => [u.uid, u.name]));

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
    const copy = [...users];
    copy.sort((a, b) => {
      const av = sortKey === "status" ? (isActiveStatus(a) ? 1 : 0) : sortKey === "unitId" ? unitLabel(a.unitId, units) : a[sortKey];
      const bv = sortKey === "status" ? (isActiveStatus(b) ? 1 : 0) : sortKey === "unitId" ? unitLabel(b.unitId, units) : b[sortKey];
      const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
      return direction === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [users, sortKey, direction, units]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  const pageRows = sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

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
              <TableHead><SortHeaderButton label="Daie ID" sortKey="daieId" activeSortKey={sortKey} direction={direction} onSort={handleSort} /></TableHead>
              <TableHead><SortHeaderButton label="Name" sortKey="name" activeSortKey={sortKey} direction={direction} onSort={handleSort} /></TableHead>
              <TableHead><SortHeaderButton label="Rank" sortKey="rank" activeSortKey={sortKey} direction={direction} onSort={handleSort} /></TableHead>
              <TableHead><SortHeaderButton label="Unit" sortKey="unitId" activeSortKey={sortKey} direction={direction} onSort={handleSort} /></TableHead>
              <TableHead>Structure</TableHead>
              <TableHead>Upline</TableHead>
              <TableHead><SortHeaderButton label="Status" sortKey="status" activeSortKey={sortKey} direction={direction} onSort={handleSort} /></TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((user, i) => {
              const counts = subtreeCounts.get(user.uid);
              const hasChildren = !!counts && counts.active + counts.expired > 0;
              const active = isActiveStatus(user);
              return (
                <TableRow key={user.uid}>
                  <TableCell className="text-xs text-muted-foreground">{(clampedPage - 1) * pageSize + i + 1}</TableCell>
                  <TableCell className="font-mono text-xs">{user.daieId}</TableCell>
                  <TableCell className="font-medium">
                    {user.name}
                    {user.isGroupAdmin && (
                      <Badge variant="accent" className="ml-2">Group Admin</Badge>
                    )}
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </TableCell>
                  <TableCell><Badge variant="outline">{user.rank}</Badge></TableCell>
                  <TableCell>{unitLabel(user.unitId, units)}</TableCell>
                  <TableCell>{user.structureType}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {user.uplineId ? (nameByUid.get(user.uplineId) ?? "—") : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={active ? "success" : "destructive"}>{active ? "Active" : "Non-Active (Expired)"}</Badge>
                    {hasChildren && (
                      <div className="mt-1 text-[11px] leading-tight text-muted-foreground">
                        <span className="font-semibold text-success">{counts.active} active</span>
                        {" · "}
                        <span className="font-semibold text-red-700">{counts.expired} expired</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <EditUserDialog user={user} units={units} users={users} />
                      <SubscriptionToggle uid={user.uid} status={user.subscriptionStatus} />
                    </div>
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
