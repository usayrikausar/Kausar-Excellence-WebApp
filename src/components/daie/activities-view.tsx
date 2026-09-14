"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { PipelineBoard } from "@/components/daie/pipeline-board";
import { ActivitiesCalendar } from "@/components/daie/activities-calendar";
import { cn } from "@/lib/utils";
import type { ProspectWithId } from "@/lib/data";

export function ActivitiesView({ prospects }: { prospects: ProspectWithId[] }) {
  const [view, setView] = useState<"board" | "calendar">("board");

  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        <Button variant={view === "board" ? "outline" : "ghost"} size="sm" className={cn(view === "board" && "bg-muted")} onClick={() => setView("board")}>
          Board
        </Button>
        <Button variant={view === "calendar" ? "outline" : "ghost"} size="sm" className={cn(view === "calendar" && "bg-muted")} onClick={() => setView("calendar")}>
          Calendar
        </Button>
      </div>
      {view === "board" ? <PipelineBoard prospects={prospects} /> : <ActivitiesCalendar prospects={prospects} />}
    </div>
  );
}
