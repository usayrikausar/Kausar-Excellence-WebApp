"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { OnboardingRequirement } from "@/lib/onboarding";

export function OnboardingChecklist({ requirements, uid }: { requirements: OnboardingRequirement[]; uid: string }) {
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

  if (requirements.length === 0) {
    return <p className="text-sm text-muted-foreground">No onboarding requirements posted yet — check back once your admin sets them up.</p>;
  }

  return (
    <div className="space-y-3">
      {requirements.map((r, i) => (
        <div key={r.title} className="flex items-start gap-3 rounded-lg border border-border bg-white p-4">
          {r.completed ? (
            <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-success" />
          ) : (
            <Circle className="mt-0.5 h-6 w-6 shrink-0 text-muted-foreground" />
          )}
          <div className="flex-1">
            <p className="font-semibold text-ink">{i + 1}. {r.title}</p>

            {r.completed ? (
              <p className="text-xs font-medium text-success">Completed — attended {r.completedDate ? formatDate(r.completedDate) : ""}</p>
            ) : r.upcomingSession ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="text-xs text-muted-foreground">
                  Next session: {formatDate(r.upcomingSession.date)} &middot; {r.upcomingSession.cpdHours} hr{r.upcomingSession.cpdHours === 1 ? "" : "s"}
                  {r.upcomingSession.location ? ` · ${r.upcomingSession.location}` : ""}
                </p>
                {r.upcomingSession.provider === "wasiyyah" ? (
                  <Button size="sm" onClick={() => markAttended(r.upcomingSession!.id)} disabled={savingId === r.upcomingSession.id}>
                    {savingId === r.upcomingSession.id ? "Saving…" : "Mark as attended"}
                  </Button>
                ) : (
                  <span className="text-xs font-medium text-primary">Scan the QR at the venue to check in</span>
                )}
              </div>
            ) : r.missedSession ? (
              <p className="text-xs text-red-600">You missed the session on {formatDate(r.missedSession.date)} — waiting for the next one to be scheduled.</p>
            ) : (
              <p className="text-xs text-muted-foreground">No session scheduled yet.</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
