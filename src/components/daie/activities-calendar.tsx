"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ProspectWithId } from "@/lib/data";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ActivitiesCalendar({ prospects }: { prospects: ProspectWithId[] }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() }; // month is 0-indexed
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const byDate = useMemo(() => {
    const map = new Map<string, ProspectWithId[]>();
    for (const p of prospects) {
      if (!p.nextFollowUpDate) continue;
      if (!map.has(p.nextFollowUpDate)) map.set(p.nextFollowUpDate, []);
      map.get(p.nextFollowUpDate)!.push(p);
    }
    return map;
  }, [prospects]);

  const firstOfMonth = new Date(cursor.year, cursor.month, 1);
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const startWeekday = firstOfMonth.getDay();
  const monthLabel = firstOfMonth.toLocaleDateString("en-MY", { month: "long", year: "numeric" });

  const cells: Array<{ day: number; iso: string } | null> = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const iso = `${cursor.year}-${String(cursor.month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    cells.push({ day, iso });
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const selectedItems = selectedDate ? (byDate.get(selectedDate) ?? []) : [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-[family-name:var(--font-display)] text-base font-bold text-ink">{monthLabel}</h3>
        <div className="flex gap-1">
          <Button variant="outline" size="icon" onClick={() => setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase text-muted-foreground">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (!cell) return <div key={`empty-${i}`} />;
          const followUps = byDate.get(cell.iso) ?? [];
          return (
            <button
              key={cell.iso}
              type="button"
              onClick={() => setSelectedDate(cell.iso)}
              className={cn(
                "flex h-16 flex-col items-center justify-start rounded-md border border-border p-1 text-sm hover:bg-muted",
                cell.iso === todayIso && "border-primary",
                cell.iso === selectedDate && "bg-accent/45",
              )}
            >
              <span className={cn("font-medium", cell.iso === todayIso && "text-primary")}>{cell.day}</span>
              {followUps.length > 0 && (
                <span className="mt-1 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">{followUps.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {selectedDate && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="text-sm font-semibold text-ink">Follow-ups on {selectedDate}</p>
            {selectedItems.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {selectedItems.map((p) => (
                  <li key={p.id} className="flex items-center justify-between">
                    <span>{p.name}</span>
                    <span className="text-xs text-muted-foreground">{p.stage.replace(/_/g, " ")}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
