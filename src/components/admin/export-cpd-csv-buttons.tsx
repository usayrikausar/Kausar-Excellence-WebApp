"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv } from "@/lib/csv";
import type { CurrentUser, TrainingWithId, TrainingAttendanceEntry } from "@/lib/types";

export function ExportCpdCsvButtons({
  trainings,
  attendance,
  users,
}: {
  trainings: TrainingWithId[];
  attendance: TrainingAttendanceEntry[];
  users: CurrentUser[];
}) {
  const trainingsById = new Map(trainings.map((t) => [t.id, t]));
  const usersByUid = new Map(users.map((u) => [u.uid, u]));

  function exportDetail() {
    const headers = ["Daie ID", "Name", "Training", "Provider", "Training Date", "CPD Hours", "Method", "Marked At"];
    const rows = attendance.map((a) => {
      const t = trainingsById.get(a.trainingId);
      const u = usersByUid.get(a.uid);
      return [
        u?.daieId ?? "",
        u?.name ?? a.uid,
        t?.title ?? "",
        t?.provider === "kausar" ? "Kausar Group" : "Wasiyyah",
        t?.date ?? "",
        t ? String(t.cpdHours) : "",
        a.method,
        a.markedAt.slice(0, 10),
      ];
    });
    downloadCsv(`kausar-cpd-attendance-detail-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  }

  function exportSummary() {
    const totals = new Map<string, { kausar: number; wasiyyah: number; count: number }>();
    for (const a of attendance) {
      const t = trainingsById.get(a.trainingId);
      if (!t) continue;
      const cur = totals.get(a.uid) ?? { kausar: 0, wasiyyah: 0, count: 0 };
      if (t.provider === "kausar") cur.kausar += t.cpdHours;
      else cur.wasiyyah += t.cpdHours;
      cur.count += 1;
      totals.set(a.uid, cur);
    }
    const headers = ["Daie ID", "Name", "Rank", "Total CPD Hours", "Kausar Hours", "Wasiyyah Hours", "Trainings Attended"];
    const rows = [...totals.entries()].map(([uid, t]) => {
      const u = usersByUid.get(uid);
      return [u?.daieId ?? "", u?.name ?? uid, u?.rank ?? "", String(t.kausar + t.wasiyyah), String(t.kausar), String(t.wasiyyah), String(t.count)];
    });
    downloadCsv(`kausar-cpd-summary-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" onClick={exportDetail}><Download className="mr-1.5 h-4 w-4" /> Export attendance detail</Button>
      <Button variant="outline" size="sm" onClick={exportSummary}><Download className="mr-1.5 h-4 w-4" /> Export CPD summary</Button>
    </div>
  );
}
