"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/daie/progress-bar";
import { formatRM } from "@/lib/utils";

export function GoalForm({
  uid,
  salesGoal,
  incomeGoal,
  personalSalesTotal,
}: {
  uid: string;
  salesGoal: number | null;
  incomeGoal: number | null;
  personalSalesTotal: number;
}) {
  const router = useRouter();
  const [salesGoalInput, setSalesGoalInput] = useState(salesGoal != null ? String(salesGoal) : "");
  const [incomeGoalInput, setIncomeGoalInput] = useState(incomeGoal != null ? String(incomeGoal) : "");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      await setDoc(
        doc(db, "goals", uid),
        {
          salesGoal: salesGoalInput ? Number(salesGoalInput) : null,
          incomeGoal: incomeGoalInput ? Number(incomeGoalInput) : null,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
      router.refresh();
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>My Sales & Income Goal</CardTitle>
        <CardDescription>Set your own target — your sales goal&rsquo;s progress tracks against your real sales total automatically.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {salesGoal != null && salesGoal > 0 && (
          <ProgressBar label="Sales goal progress" value={personalSalesTotal} max={salesGoal} formatValue={formatRM} accent="success" />
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="sales-goal">Sales goal (RM)</Label>
            <Input id="sales-goal" type="number" min={0} step="0.01" value={salesGoalInput} onChange={(e) => setSalesGoalInput(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="income-goal">Income goal (RM)</Label>
            <Input id="income-goal" type="number" min={0} step="0.01" value={incomeGoalInput} onChange={(e) => setIncomeGoalInput(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={status === "saving"}>
              {status === "saving" ? "Saving…" : "Save my goal"}
            </Button>
            {status === "error" && <span className="ml-3 text-sm font-medium text-red-600">Could not save — try again.</span>}
          </div>
        </form>
        {incomeGoal != null && incomeGoal > 0 && (
          <p className="text-xs text-muted-foreground">
            Income goal: <span className="font-semibold text-ink">{formatRM(incomeGoal)}</span> — the app doesn&rsquo;t track commission/income yet, so this is a stated target only.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
