"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import type { TrainingWithId } from "@/lib/types";

export function AvailableTrainingsList({ trainings, uid, attendedTrainingIds }: { trainings: TrainingWithId[]; uid: string; attendedTrainingIds: Set<string> }) {
  const router = useRouter();
  const [savingId, setSavingId] = useState<string | null>(null);

  async function markAttended(trainingId: string) {
    setSavingId(trainingId);
    try {
      await setDoc(doc(db, "trainingAttendance", `${trainingId}_${uid}`), {
        trainingId,
        uid,
        method: "self_reported",
        qrToken: null,
        markedBy: uid,
        markedAt: serverTimestamp(),
      });
      router.refresh();
    } finally {
      setSavingId(null);
    }
  }

  if (trainings.length === 0) {
    return <p className="text-sm text-muted-foreground">No trainings posted yet.</p>;
  }

  return (
    <div className="space-y-2">
      {trainings.map((t) => {
        const attended = attendedTrainingIds.has(t.id);
        return (
          <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3">
            <div>
              <p className="font-medium text-ink">{t.title}</p>
              <p className="text-xs text-muted-foreground">
                {t.provider === "kausar" ? "Kausar Group" : "Wasiyyah"} &middot; {formatDate(t.date)} &middot; {t.cpdHours} CPD hr{t.cpdHours === 1 ? "" : "s"}
                {t.location ? ` · ${t.location}` : ""}
              </p>
            </div>
            {attended ? (
              <Badge variant="success">Attended</Badge>
            ) : t.provider === "wasiyyah" ? (
              <Button size="sm" onClick={() => markAttended(t.id)} disabled={savingId === t.id}>
                {savingId === t.id ? "Saving…" : "Mark as attended"}
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">Scan the QR at the venue to check in</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
