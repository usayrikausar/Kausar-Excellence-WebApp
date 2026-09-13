"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ContestTargetRows } from "@/components/admin/contest-target-rows";
import type { ContestDoc, ContestTarget } from "@/lib/types";

export function EditContestDialog({ contest }: { contest: ContestDoc & { id: string } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(contest.title);
  const [startDate, setStartDate] = useState(contest.startDate);
  const [endDate, setEndDate] = useState(contest.endDate);
  const [requirements, setRequirements] = useState(contest.requirements);
  const [targets, setTargets] = useState<ContestTarget[]>(contest.targets);
  const [rewardDescription, setRewardDescription] = useState(contest.rewardDescription);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  async function handleSave() {
    setStatus("saving");
    try {
      await updateDoc(doc(db, "contests", contest.id), {
        title,
        startDate,
        endDate,
        requirements,
        targets: targets.filter((t) => t.label.trim() !== ""),
        rewardDescription,
      });
      setOpen(false);
      router.refresh();
    } catch {
      setStatus("error");
    } finally {
      setStatus("idle");
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${contest.title}"? This can't be undone.`)) return;
    await deleteDoc(doc(db, "contests", contest.id));
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Edit</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit contest</DialogTitle>
          <DialogDescription>{contest.section === "wasiyyah" ? "Wasiyyah contest" : "Kausar Group contest"}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>End date (deadline)</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Terma & Syarat (requirements)</Label>
            <textarea
              rows={5}
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              className="flex w-full rounded-md border border-border bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <ContestTargetRows targets={targets} onChange={setTargets} />

          <div className="space-y-2">
            <Label>Reward description</Label>
            <Input value={rewardDescription} onChange={(e) => setRewardDescription(e.target.value)} />
          </div>

          {status === "error" && <p className="text-sm font-medium text-red-600">Could not save changes.</p>}

          <div className="flex justify-between gap-2">
            <Button variant="destructive" onClick={handleDelete}>
              Delete contest
            </Button>
            <Button onClick={handleSave} disabled={status === "saving"}>
              {status === "saving" ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
