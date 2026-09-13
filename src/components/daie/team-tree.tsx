"use client";

import { useMemo, useState } from "react";
import { ChevronRight, ChevronDown, Download } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { unitLabel } from "@/lib/constants";
import type { CurrentUser } from "@/lib/types";
import { cn, contractExpiryDate, formatDate, formatRM, isActiveStatus } from "@/lib/utils";
import { downloadCsv } from "@/lib/csv";

// Defined locally (mirrors lib/data.ts's TeamMember) rather than imported
// from lib/data.ts — that file starts with "server-only" and pulls in the
// Admin SDK, which must never reach a Client Component's bundle even via a
// type-only import (Turbopack's client/server module graph still creates a
// dependency edge for it in practice).
type TeamMember = CurrentUser & {
  salesTotal: number;
  collectionTotal: number;
  wasitahTotal: number;
  pusakaTotal: number;
};

function StatusBadge({ member }: { member: TeamMember }) {
  const isActive = isActiveStatus(member);
  return <Badge variant={isActive ? "success" : "destructive"}>{isActive ? "Active" : "Non-Active (Expired)"}</Badge>;
}

/**
 * Renders the downline as an expand/collapse tree rather than a flat table —
 * real hierarchy data shows DPM chains recurse to arbitrary depth (a DPM can
 * sponsor another DPM, who sponsors another, before reaching DM leaves), so
 * this groups by each member's direct `uplineId` rather than assuming a
 * fixed KDE→DPM→DM shape. `rootUid: null` means "root nodes are whoever has
 * no upline in this list" (the Group Admin cross-unit view, where each
 * unit's KDE is itself a root); otherwise root nodes are the viewer's own
 * direct reports.
 */
export function TeamTree({
  team,
  rootUid,
  viewerName,
  showUnit,
  units,
}: {
  team: TeamMember[];
  rootUid: string | null;
  /** The signed-in viewer's own name — used to label "Upline" for their direct reports (who aren't in `team`, since getDownline excludes self). */
  viewerName: string;
  showUnit: boolean;
  units: Record<string, string>;
}) {
  const childrenByParent = useMemo(() => {
    const map = new Map<string | null, TeamMember[]>();
    for (const member of team) {
      const key = member.uplineId;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(member);
    }
    return map;
  }, [team]);

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

  function exportCsv() {
    const headers = [
      "Status",
      "Daie ID",
      "Rank",
      "Name",
      ...(showUnit ? ["Unit"] : []),
      "Upline",
      "Total Sales (Perancangan)",
      "Total Collection",
      "Total Wasitah (Al Wasitah)",
      "Total Pusaka",
      "Date Licensed",
      "Date Expiry",
    ];
    const rows = team.map((member) => {
      const isActive = isActiveStatus(member);
      const expiry = member.dateLicensed ? contractExpiryDate(member.dateLicensed, member.rank) : null;
      return [
        isActive ? "Active" : "Non-Active (Expired)",
        member.daieId,
        member.rank,
        member.name,
        ...(showUnit ? [unitLabel(member.unitId, units)] : []),
        uplineName(member),
        formatRM(member.salesTotal),
        formatRM(member.collectionTotal),
        `${member.wasitahTotal} case(s)`,
        formatRM(member.pusakaTotal),
        member.dateLicensed ? formatDate(member.dateLicensed) : "",
        expiry ? formatDate(expiry) : "",
      ];
    });
    const today = new Date().toISOString().slice(0, 10);
    downloadCsv(`kausar-team-${today}.csv`, headers, rows);
  }

  const roots = childrenByParent.get(rootUid) ?? [];
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  // Whole-subtree active/expired counts (every descendant, not just direct
  // reports) — memoized post-order so each uid's descendants are only summed
  // once regardless of how many ancestors ask for them.
  const subtreeCounts = useMemo(() => {
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
    for (const member of team) countBelow(member.uid);
    return memo;
  }, [team, childrenByParent]);

  function toggle(uid: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  }

  function renderRows(members: TeamMember[], depth: number): React.ReactNode[] {
    return members.flatMap((member) => {
      const children = childrenByParent.get(member.uid) ?? [];
      const hasChildren = children.length > 0;
      const isOpen = expanded.has(member.uid);
      const expiry = member.dateLicensed ? contractExpiryDate(member.dateLicensed, member.rank) : null;
      const counts = subtreeCounts.get(member.uid);

      // Expanded parent rows get a strong yellow tint (so it's obvious which
      // row you just opened); their visible children get a strong blue tint
      // (so nested rows are easy to spot at a glance, distinct from
      // top-level roots) — bumped up from a subtle /5-/15 tint to /35-/45
      // after feedback that the first pass was "too light, almost
      // unrecognizable."
      const row = (
        <TableRow
          key={member.uid}
          className={cn(isOpen && hasChildren ? "bg-accent/45" : depth > 0 && "bg-primary/20")}
        >
          <TableCell>
            <StatusBadge member={member} />
            {hasChildren && counts && (
              <div className="mt-1 text-[11px] leading-tight text-muted-foreground">
                <span className="font-semibold text-success">{counts.active} active</span>
                {" · "}
                <span className="font-semibold text-red-700">{counts.expired} expired</span>
              </div>
            )}
          </TableCell>
          <TableCell className="font-mono text-xs">
            <div className="flex items-center gap-1" style={{ paddingLeft: depth * 20 }}>
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => toggle(member.uid)}
                  aria-label={isOpen ? "Collapse" : "Expand"}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded hover:bg-muted"
                >
                  {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              ) : (
                <span className="w-5 shrink-0" />
              )}
              {member.daieId}
            </div>
          </TableCell>
          <TableCell>
            <Badge variant="outline">{member.rank}</Badge>
          </TableCell>
          <TableCell className="font-medium">{member.name}</TableCell>
          {showUnit && <TableCell>{unitLabel(member.unitId, units)}</TableCell>}
          <TableCell className="text-xs text-muted-foreground">{uplineName(member)}</TableCell>
          <TableCell className="text-right">{formatRM(member.salesTotal)}</TableCell>
          <TableCell className="text-right">{formatRM(member.collectionTotal)}</TableCell>
          <TableCell className="text-right">{member.wasitahTotal} case(s)</TableCell>
          <TableCell className="text-right">{formatRM(member.pusakaTotal)}</TableCell>
          <TableCell className="text-xs text-muted-foreground">
            {member.dateLicensed ? formatDate(member.dateLicensed) : "—"}
          </TableCell>
          <TableCell className="text-xs text-muted-foreground">{expiry ? formatDate(expiry) : "—"}</TableCell>
        </TableRow>
      );

      return isOpen ? [row, ...renderRows(children, depth + 1)] : [row];
    });
  }

  if (roots.length === 0) {
    return <p className="p-6 text-sm text-muted-foreground">No downline yet.</p>;
  }

  return (
    <div>
      <div className="flex justify-end border-b border-border p-3">
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="mr-1.5 h-4 w-4" />
          Export CSV
        </Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Status</TableHead>
              <TableHead>Daie ID</TableHead>
              <TableHead>Rank</TableHead>
              <TableHead>Name</TableHead>
              {showUnit && <TableHead>Unit</TableHead>}
              <TableHead>Upline</TableHead>
              <TableHead className="text-right">Total sales</TableHead>
              <TableHead className="text-right">Total collection</TableHead>
              <TableHead className="text-right">Total Wasitah</TableHead>
              <TableHead className="text-right">Total Pusaka</TableHead>
              <TableHead>Date licensed</TableHead>
              <TableHead>Date expiry</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>{renderRows(roots, 0)}</TableBody>
        </Table>
      </div>
    </div>
  );
}
