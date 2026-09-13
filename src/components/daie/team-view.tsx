"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { TeamTree } from "@/components/daie/team-tree";
import { TeamTable } from "@/components/daie/team-table";
import { cn } from "@/lib/utils";
import type { CurrentUser } from "@/lib/types";

type TeamMember = CurrentUser & {
  salesTotal: number;
  collectionTotal: number;
  wasitahTotal: number;
  pusakaTotal: number;
};

/** Toggles between the hierarchy tree (structure browsing) and a flat, numbered, sortable, paginated list (easy scroll-tracking for large teams). */
export function TeamView(props: { team: TeamMember[]; rootUid: string | null; viewerName: string; showUnit: boolean; units: Record<string, string> }) {
  const [view, setView] = useState<"tree" | "list">("tree");

  return (
    <div>
      <div className="flex justify-end gap-1 border-b border-border p-3">
        <Button variant={view === "tree" ? "outline" : "ghost"} size="sm" className={cn(view === "tree" && "bg-muted")} onClick={() => setView("tree")}>
          Tree view
        </Button>
        <Button variant={view === "list" ? "outline" : "ghost"} size="sm" className={cn(view === "list" && "bg-muted")} onClick={() => setView("list")}>
          List view
        </Button>
      </div>
      {view === "tree" ? <TeamTree {...props} /> : <TeamTable {...props} />}
    </div>
  );
}
