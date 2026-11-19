"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Next follow-up: a date, and an optional time that turns it into a timed appointment in the phone calendar. */
export function FollowUpInputs({
  idPrefix,
  label = "Next follow-up (optional)",
  date,
  time,
  onDateChange,
  onTimeChange,
}: {
  idPrefix: string;
  label?: string;
  date: string;
  time: string;
  onDateChange: (v: string) => void;
  onTimeChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-date`}>{label}</Label>
      <div className="grid grid-cols-[minmax(0,1fr)_8.5rem] gap-2">
        <Input
          id={`${idPrefix}-date`}
          type="date"
          value={date}
          onChange={(e) => {
            onDateChange(e.target.value);
            if (!e.target.value) onTimeChange("");
          }}
        />
        <Input id={`${idPrefix}-time`} type="time" aria-label="Time (optional)" value={time} disabled={!date} onChange={(e) => onTimeChange(e.target.value)} />
      </div>
      <p className="text-xs text-muted-foreground">Add a time to get it as an appointment, with a reminder, in your phone calendar.</p>
    </div>
  );
}
