"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { TrainingProvider } from "@/lib/types";

function randomToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID().replace(/-/g, "");
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export function CreateTrainingForm({ createdBy }: { createdBy: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [provider, setProvider] = useState<TrainingProvider>("kausar");
  const [cpdHours, setCpdHours] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [requiredForOnboarding, setRequiredForOnboarding] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      const ref = doc(collection(db, "trainings"));
      await setDoc(ref, {
        title,
        description: description || null,
        provider,
        cpdHours: Number(cpdHours),
        date,
        location: location || null,
        qrToken: provider === "kausar" ? randomToken() : null,
        requiredForOnboarding,
        createdBy,
        createdAt: serverTimestamp(),
      });
      setTitle("");
      setDescription("");
      setCpdHours("");
      setDate("");
      setLocation("");
      setRequiredForOnboarding(false);
      router.refresh();
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a training</CardTitle>
        <CardDescription>Kausar sessions get a QR self-check-in code; Wasiyyah sessions rely on each daie self-reporting attendance.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="training-title">Title</Label>
            <Input id="training-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="training-desc">Description (optional)</Label>
            <Input id="training-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <RadioGroup value={provider} onValueChange={(v) => setProvider(v as TrainingProvider)} className="flex gap-4 pt-2">
                <label className="flex items-center gap-1.5 text-sm"><RadioGroupItem value="kausar" id="prov-kausar" /> Kausar Group</label>
                <label className="flex items-center gap-1.5 text-sm"><RadioGroupItem value="wasiyyah" id="prov-wasiyyah" /> Wasiyyah</label>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="training-hours">CPD hours</Label>
              <Input id="training-hours" type="number" min={0} step="0.5" required value={cpdHours} onChange={(e) => setCpdHours(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="training-date">Date</Label>
              <Input id="training-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="training-location">Location (optional)</Label>
              <Input id="training-location" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={requiredForOnboarding} onChange={(e) => setRequiredForOnboarding(e.target.checked)} className="h-4 w-4 rounded border-border" />
            Required for onboarding — new daie must attend (appears on My Onboarding; name recurring sessions the same to have any one instance count)
          </label>
          {status === "error" && <p className="text-sm font-medium text-red-600">Could not save. Try again.</p>}
          <Button type="submit" disabled={status === "saving"}>{status === "saving" ? "Creating…" : "Create training"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
