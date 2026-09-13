"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ContestTargetRows } from "@/components/admin/contest-target-rows";
import type { ContestSection, ContestTarget } from "@/lib/types";

export function CreateContestForm({ createdBy }: { createdBy: string }) {
  const router = useRouter();
  const [section, setSection] = useState<ContestSection>("wasiyyah");
  const [title, setTitle] = useState("");
  const [poster, setPoster] = useState<File | null>(null);
  const [requirements, setRequirements] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [targets, setTargets] = useState<ContestTarget[]>([{ label: "", amount: 0 }]);
  const [rewardDescription, setRewardDescription] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [open, setOpen] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      let posterUrl: string | null = null;
      if (poster) {
        const storageRef = ref(storage, `contests/${Date.now()}-${poster.name}`);
        await uploadBytes(storageRef, poster);
        posterUrl = await getDownloadURL(storageRef);
      }

      await addDoc(collection(db, "contests"), {
        section,
        title,
        posterUrl,
        requirements,
        startDate,
        endDate,
        targets: targets.filter((t) => t.label.trim() !== ""),
        rewardDescription,
        createdBy,
        createdAt: serverTimestamp(),
      });

      setTitle("");
      setPoster(null);
      setRequirements("");
      setStartDate("");
      setEndDate("");
      setTargets([{ label: "", amount: 0 }]);
      setRewardDescription("");
      setOpen(false);
      router.refresh();
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)}>
        + New contest
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New contest</CardTitle>
        <CardDescription>Visible to every signed-in daie once created.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Section</Label>
            <RadioGroup value={section} onValueChange={(v) => setSection(v as ContestSection)} className="flex gap-6">
              <label className="flex items-center gap-1.5 text-sm">
                <RadioGroupItem value="wasiyyah" id="section-wasiyyah" /> Wasiyyah contest
              </label>
              <label className="flex items-center gap-1.5 text-sm">
                <RadioGroupItem value="kausar" id="section-kausar" /> Kausar Group contest
              </label>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contest-title">Title</Label>
            <Input id="contest-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="contest-start">Start date</Label>
              <Input id="contest-start" type="date" required value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contest-end">End date (deadline)</Label>
              <Input id="contest-end" type="date" required value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contest-poster">Poster image</Label>
            <Input id="contest-poster" type="file" accept="image/*" onChange={(e) => setPoster(e.target.files?.[0] ?? null)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contest-requirements">Terma & Syarat (requirements)</Label>
            <textarea
              id="contest-requirements"
              required
              rows={5}
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              className="flex w-full rounded-md border border-border bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <ContestTargetRows targets={targets} onChange={setTargets} />

          <div className="space-y-2">
            <Label htmlFor="contest-reward">Reward description</Label>
            <Input
              id="contest-reward"
              required
              placeholder="e.g. 4 tickets to Phu Quoc, Vietnam"
              value={rewardDescription}
              onChange={(e) => setRewardDescription(e.target.value)}
            />
          </div>

          {status === "error" && <p className="text-sm font-medium text-red-600">Could not create contest. Please try again.</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={status === "saving"}>
              {status === "saving" ? "Creating…" : "Create contest"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
