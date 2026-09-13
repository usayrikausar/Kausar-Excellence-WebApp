"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * Self-report form for one contest's progress — the app has no way to
 * compute a daie's sales/collection figure scoped to an arbitrary contest
 * date window, and Kausar's activity-based contests (prospecting calls,
 * presentations) aren't tracked anywhere at all, so each daie types in their
 * own current running total. See ContestProgressDoc in lib/types.ts.
 */
export function ContestProgressForm({ contestId, uid, currentAmount }: { contestId: string; uid: string; currentAmount: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(currentAmount || ""));
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = Number(amount);
    if (Number.isNaN(parsed) || parsed < 0) return;
    setStatus("saving");
    try {
      await setDoc(doc(db, "contestProgress", `${contestId}_${uid}`), {
        contestId,
        uid,
        amount: parsed,
        updatedAt: serverTimestamp(),
      });
      router.refresh();
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        type="number"
        min={0}
        step="0.01"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Update my progress"
        className="h-8 max-w-[160px] text-sm"
      />
      <Button type="submit" size="sm" variant="outline" disabled={status === "saving"}>
        {status === "saving" ? "Saving…" : "Update"}
      </Button>
      {status === "error" && <span className="text-xs font-medium text-red-600">Failed — try again.</span>}
    </form>
  );
}
