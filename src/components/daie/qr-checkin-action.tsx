"use client";

import { useState } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";

export function QrCheckinAction({
  trainingId,
  qrToken,
  uid,
  alreadyCheckedIn,
}: {
  trainingId: string;
  qrToken: string;
  uid: string;
  alreadyCheckedIn: boolean;
}) {
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">(alreadyCheckedIn ? "done" : "idle");

  async function handleCheckIn() {
    setStatus("saving");
    try {
      await setDoc(doc(db, "trainingAttendance", `${trainingId}_${uid}`), {
        trainingId,
        uid,
        method: "qr",
        qrToken,
        markedBy: uid,
        markedAt: serverTimestamp(),
      });
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="flex flex-col items-center gap-2 text-success">
        <CheckCircle2 className="h-12 w-12" />
        <p className="text-lg font-bold text-ink">You&rsquo;re marked present</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <Button size="lg" onClick={handleCheckIn} disabled={status === "saving"} className="w-full">
        {status === "saving" ? "Checking in…" : "Check in"}
      </Button>
      {status === "error" && <p className="text-sm font-medium text-red-600">Could not check in — try again.</p>}
    </div>
  );
}
