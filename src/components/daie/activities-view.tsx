"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PipelineBoard } from "@/components/daie/pipeline-board";
import { ActivitiesCalendar } from "@/components/daie/activities-calendar";
import { ProspectListTable, ClientListTable, isClient } from "@/components/daie/prospect-tables";
import { cn } from "@/lib/utils";
import type { ProspectWithId } from "@/lib/data";
import type { SaleEntry } from "@/lib/types";

type View = "board" | "prospects" | "clients" | "calendar";

export function ActivitiesView({ prospects, sales }: { prospects: ProspectWithId[]; sales: SaleEntry[] }) {
  const [view, setView] = useState<View>("board");
  const clientCount = prospects.filter(isClient).length;
  const tabs: Array<{ id: View; label: string }> = [
    { id: "board", label: "Board" },
    { id: "prospects", label: `Prospects (${prospects.length - clientCount})` },
    { id: "clients", label: `Clients (${clientCount})` },
    { id: "calendar", label: "Calendar" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {tabs.map((t) => (
          <Button key={t.id} variant={view === t.id ? "outline" : "ghost"} size="sm" className={cn(view === t.id && "bg-muted")} onClick={() => setView(t.id)}>
            {t.label}
          </Button>
        ))}
      </div>
      {view === "board" && <PipelineBoard prospects={prospects} />}
      {view === "prospects" && <ProspectListTable prospects={prospects} />}
      {view === "clients" && <ClientListTable prospects={prospects} sales={sales} />}
      {view === "calendar" && <ActivitiesCalendar prospects={prospects} />}
    </div>
  );
}
