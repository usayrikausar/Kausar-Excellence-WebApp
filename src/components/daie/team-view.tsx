"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TeamTree } from "@/components/daie/team-tree";
import { TeamTable, TEAM_STATUS_FILTERS, STATUS_FILTER_LABELS, matchesStatus, type TeamStatusFilter } from "@/components/daie/team-table";
import { cn } from "@/lib/utils";
import type { CurrentUser } from "@/lib/types";

type TeamMember = CurrentUser & {
  salesTotal: number;
  collectionTotal: number;
  wasitahTotal: number;
  pusakaTotal: number;
};

/**
 * Toggles between the hierarchy tree (structure browsing) and a flat, numbered, sortable, paginated list (easy scroll-tracking for large teams).
 * The Status filter sits up here beside Tree / List so it's always in sight; the tree can't filter, so picking a status opens the list.
 */
export function TeamView(props: {
  team: TeamMember[];
  rootUid: string | null;
  viewerName: string;
  outsideNames?: Record<string, string>;
  showUnit: boolean;
  units: Record<string, string>;
  /** Open in List view with this status filter — e.g. from Home's renewal reminder. */
  initialStatus?: TeamStatusFilter;
}) {
  const { initialStatus = "all", ...treeProps } = props;
  const [status, setStatus] = useState<TeamStatusFilter>(initialStatus);
  const [view, setView] = useState<"tree" | "list">(initialStatus !== "all" ? "list" : "tree");
  const counts = useMemo(
    () => Object.fromEntries(TEAM_STATUS_FILTERS.map((f) => [f, props.team.filter((m) => matchesStatus(m, f)).length])) as Record<TeamStatusFilter, number>,
    [props.team],
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">Status</span>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v as TeamStatusFilter);
              if (v !== "all") setView("list");
            }}
          >
            <SelectTrigger id="team-status-filter" className="h-8 w-60" aria-label="Filter by status"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TEAM_STATUS_FILTERS.map((f) => (
                <SelectItem key={f} value={f}>{STATUS_FILTER_LABELS[f]} ({counts[f]})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-1">
          <Button
            variant={view === "tree" ? "outline" : "ghost"}
            size="sm"
            className={cn(view === "tree" && "bg-muted")}
            onClick={() => {
              setView("tree");
              setStatus("all");
            }}
          >
            Tree view
          </Button>
          <Button variant={view === "list" ? "outline" : "ghost"} size="sm" className={cn(view === "list" && "bg-muted")} onClick={() => setView("list")}>
            List view
          </Button>
        </div>
      </div>
      {view === "tree" ? (
        <TeamTree {...treeProps} />
      ) : (
        // Remounted per status so the list re-applies that status's default sort (soonest expiry first for "expiring").
        <TeamTable key={status} {...treeProps} initialStatus={status} hideStatusFilter />
      )}
    </div>
  );
}
