"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SOURCE_LABELS, STAGE_LABELS } from "@/lib/constants";
import { PIPPPAS_STAGES, type PipppasStage, type ProspectSource } from "@/lib/types";

export function NewProspectDialog({ uid }: { uid: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [details, setDetails] = useState("");
  const [source, setSource] = useState<ProspectSource>("direct_approach");
  const [stage, setStage] = useState<PipppasStage>("prospecting");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      const prospectRef = doc(collection(db, "prospects"));
      const updateRef = doc(collection(db, "prospects", prospectRef.id, "updates"));
      const batch = writeBatch(db);

      batch.set(prospectRef, {
        uid,
        name,
        phone: phone || null,
        details: details || null,
        source,
        stage,
        status: "active",
        nextFollowUpDate: null,
        linkedSaleId: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      batch.set(updateRef, {
        uid,
        stage,
        note: `Added as a new prospect at ${STAGE_LABELS[stage]}.`,
        nextFollowUpDate: null,
        createdAt: serverTimestamp(),
      });
      await batch.commit();

      setName("");
      setPhone("");
      setDetails("");
      setOpen(false);
      router.refresh();
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>+ New prospect</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New prospect</DialogTitle>
          <DialogDescription>
            Start them at Prospecting, or pick a later stage if you&rsquo;ve already met/presented to them before adding them here.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prospect-name">Name</Label>
            <Input id="prospect-name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prospect-phone">Phone (optional)</Label>
            <Input id="prospect-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prospect-details">Details (optional)</Label>
            <Input id="prospect-details" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Any context worth remembering" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Source</Label>
              <Select value={source} onValueChange={(v) => setSource(v as ProspectSource)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SOURCE_LABELS)
                    .filter(([value]) => value !== "training" && value !== "prosper_invite") // activity-only types, not a "how did you meet this prospect" source — see SOURCE_LABELS' comment
                    .map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Starting stage</Label>
              <Select value={stage} onValueChange={(v) => setStage(v as PipppasStage)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PIPPPAS_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {status === "error" && <p className="text-sm font-medium text-red-600">Could not save. Try again.</p>}

          <Button type="submit" disabled={status === "saving"} className="w-full">
            {status === "saving" ? "Adding…" : "Add prospect"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
