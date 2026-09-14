"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SOURCE_LABELS } from "@/lib/constants";
import type { ProspectSource } from "@/lib/types";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function LogActivityForm({ uid }: { uid: string }) {
  const router = useRouter();
  const [type, setType] = useState<ProspectSource>("booth");
  const [reachCount, setReachCount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  const isTraining = type === "training";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      await addDoc(collection(db, "activities"), {
        uid,
        type,
        reachCount: isTraining ? 0 : Number(reachCount) || 0,
        note: note || null,
        date,
        createdAt: serverTimestamp(),
      });
      setReachCount("");
      setNote("");
      router.refresh();
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log an activity</CardTitle>
        <CardDescription>Booth, live TikTok, Project 200 calls, training attended — whatever you did today.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ProspectSource)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!isTraining && (
            <div className="space-y-2">
              <Label htmlFor="activity-reach">People reached</Label>
              <Input id="activity-reach" type="number" min={0} step="1" value={reachCount} onChange={(e) => setReachCount(e.target.value)} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="activity-date">Date</Label>
            <Input id="activity-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="space-y-2 lg:col-span-2">
            <Label htmlFor="activity-note">Note (optional)</Label>
            <Input id="activity-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Booth at Mall X, good response" />
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={status === "saving"}>
              {status === "saving" ? "Saving…" : "Log activity"}
            </Button>
            {status === "error" && <span className="text-sm font-medium text-red-600">Could not save.</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
