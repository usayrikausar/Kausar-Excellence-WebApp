"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { STAGE_LABELS, SOURCE_LABELS, PROFESSION_LABELS, INCOME_BRACKET_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { PIPPPAS_STAGES, type PipppasStage, type SalesCategory } from "@/lib/types";
import type { ProspectWithId } from "@/lib/data";
import { ProspectProfileForm } from "@/components/daie/prospect-profile-form";

interface HistoryItem {
  id: string;
  stage: PipppasStage;
  note: string;
  nextFollowUpDate: string | null;
  createdAt: string;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const CLOSEABLE_STAGES: PipppasStage[] = ["administration", "signing_akad", "safekeeping"];

export function ProspectDetailDialog({ prospect, open, onOpenChange }: { prospect: ProspectWithId; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [history, setHistory] = useState<HistoryItem[] | null>(null);
  const [mode, setMode] = useState<"history" | "close" | "profile">("history");

  // Add-update form — this component is always mounted fresh per-prospect
  // (see pipeline-board.tsx's `key={prospect.id}`), so plain useState
  // initializers are enough; no reset-on-prop-change effect needed.
  const [newStage, setNewStage] = useState<PipppasStage>(prospect.stage);
  const [note, setNote] = useState("");
  const [nextFollowUpDate, setNextFollowUpDate] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  // Close & Record Sale form
  const [saleCategory, setSaleCategory] = useState<SalesCategory>("perancangan");
  const [saleSubCategory, setSaleSubCategory] = useState<"wasiat" | "hibah" | "berlian" | "mutiara" | "besar" | "kecil">("wasiat");
  const [saleAmount, setSaleAmount] = useState("");
  const [saleDate, setSaleDate] = useState(todayISO());
  const [recordCollection, setRecordCollection] = useState(true);
  const [collectionAmount, setCollectionAmount] = useState("");

  useEffect(() => {
    getDocs(query(collection(db, "prospects", prospect.id, "updates"), orderBy("createdAt", "asc"))).then((snap) => {
      setHistory(
        snap.docs.map((d) => {
          const data = d.data();
          const createdAt = data.createdAt as Timestamp | null;
          return {
            id: d.id,
            stage: data.stage,
            note: data.note,
            nextFollowUpDate: data.nextFollowUpDate ?? null,
            createdAt: createdAt ? createdAt.toDate().toISOString() : new Date().toISOString(),
          };
        }),
      );
    });
  }, [prospect.id]);

  async function handleAddUpdate(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      const batch = writeBatch(db);
      const updateRef = doc(collection(db, "prospects", prospect.id, "updates"));
      batch.set(updateRef, {
        uid: prospect.uid,
        stage: newStage,
        note,
        nextFollowUpDate: nextFollowUpDate || null,
        createdAt: serverTimestamp(),
      });
      batch.update(doc(db, "prospects", prospect.id), {
        stage: newStage,
        nextFollowUpDate: nextFollowUpDate || null,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
      router.refresh();
      onOpenChange(false);
    } catch {
      setStatus("error");
    }
  }

  async function handleMarkLost() {
    if (!confirm(`Mark ${prospect.name} as a lost case? You can still see them, just out of the active pipeline.`)) return;
    setStatus("saving");
    try {
      await writeBatch(db)
        .update(doc(db, "prospects", prospect.id), { status: "closed_lost", updatedAt: serverTimestamp() })
        .commit();
      router.refresh();
      onOpenChange(false);
    } catch {
      setStatus("error");
    }
  }

  async function handleCloseAndRecordSale(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      const isRm = saleCategory === "perancangan" || saleCategory === "kesPusaka";
      const batch = writeBatch(db);
      const saleRef = doc(collection(db, "sales"));
      batch.set(saleRef, {
        uid: prospect.uid,
        category: saleCategory,
        subCategory: saleSubCategory,
        amount: isRm ? Number(saleAmount) : null,
        count: saleCategory === "pengurusan" ? Number(saleAmount) : null,
        date: Timestamp.fromDate(new Date(saleDate)),
        createdAt: serverTimestamp(),
        prospectId: prospect.id,
      });

      if (recordCollection && collectionAmount) {
        const collectionRef = doc(collection(db, "collections"));
        batch.set(collectionRef, {
          uid: prospect.uid,
          saleRef: saleRef.id,
          amountCollected: Number(collectionAmount),
          date: Timestamp.fromDate(new Date(saleDate)),
          createdAt: serverTimestamp(),
          prospectId: prospect.id,
        });
      }

      batch.update(doc(db, "prospects", prospect.id), {
        status: "closed_won",
        linkedSaleId: saleRef.id,
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
      router.refresh();
      onOpenChange(false);
    } catch {
      setStatus("error");
    }
  }

  const canClose = CLOSEABLE_STAGES.includes(prospect.stage) && prospect.status === "active";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{prospect.name}</DialogTitle>
          <DialogDescription>{SOURCE_LABELS[prospect.source]}{prospect.phone ? ` · ${prospect.phone}` : ""}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto">
          {prospect.details && <p className="rounded-md bg-muted/50 p-3 text-sm text-foreground/80">{prospect.details}</p>}

          {mode === "history" && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted/50 p-3 text-sm">
                <div className="space-y-0.5 text-foreground/80">
                  {prospect.age || prospect.profession || prospect.organizationName || prospect.incomeBracket ? (
                    <p>
                      {[
                        prospect.age ? `${prospect.age} y/o` : null,
                        prospect.profession ? (prospect.profession === "others" ? prospect.professionOther || "Other" : PROFESSION_LABELS[prospect.profession]) : null,
                        prospect.organizationName,
                        prospect.incomeBracket ? INCOME_BRACKET_LABELS[prospect.incomeBracket] : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  ) : (
                    <p className="text-muted-foreground">No client profile yet.</p>
                  )}
                  {prospect.importantDate && (
                    <p className="text-xs text-muted-foreground">
                      {prospect.importantDateLabel || "Important date"}: {formatDate(prospect.importantDate)}
                    </p>
                  )}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setMode("profile")}>
                  Edit profile
                </Button>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">History</p>
                {history === null ? (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                ) : (
                  <ul className="space-y-2 border-l-2 border-border pl-4">
                    {history.map((h) => (
                      <li key={h.id} className="text-sm">
                        <p className="font-semibold text-ink">
                          {STAGE_LABELS[h.stage]} <span className="font-normal text-muted-foreground">— {formatDate(h.createdAt)}</span>
                        </p>
                        <p className="text-foreground/80">{h.note}</p>
                        {h.nextFollowUpDate && (
                          <p className="text-xs text-muted-foreground">Next follow-up: {formatDate(h.nextFollowUpDate)}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <form onSubmit={handleAddUpdate} className="space-y-3 border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Add an update</p>
                <div className="space-y-2">
                  <Label>Stage</Label>
                  <Select value={newStage} onValueChange={(v) => setNewStage(v as PipppasStage)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PIPPPAS_STAGES.map((s) => (
                        <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="update-note">What happened?</Label>
                  <Input id="update-note" required value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Follow up call, client agreed to meet 16/9" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="update-next">Next follow-up date (optional)</Label>
                  <Input id="update-next" type="date" value={nextFollowUpDate} onChange={(e) => setNextFollowUpDate(e.target.value)} />
                </div>
                {status === "error" && <p className="text-sm font-medium text-red-600">Could not save. Try again.</p>}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={status === "saving"}>
                    {status === "saving" ? "Saving…" : "Save update"}
                  </Button>
                  {canClose && (
                    <Button type="button" variant="success" onClick={() => setMode("close")}>
                      Close & Record Sale
                    </Button>
                  )}
                  {prospect.status === "active" && (
                    <Button type="button" variant="destructive" onClick={handleMarkLost} disabled={status === "saving"}>
                      Mark lost
                    </Button>
                  )}
                </div>
              </form>
            </>
          )}

          {mode === "profile" && <ProspectProfileForm prospect={prospect} onDone={() => setMode("history")} />}

          {mode === "close" && (
            <form onSubmit={handleCloseAndRecordSale} className="space-y-4">
              <p className="text-sm font-semibold text-ink">Record the sale that closed this prospect</p>
              <div className="space-y-2">
                <Label>Category</Label>
                <RadioGroup
                  value={saleCategory}
                  onValueChange={(v) => {
                    setSaleCategory(v as SalesCategory);
                    setSaleSubCategory(v === "perancangan" ? "wasiat" : v === "kesPusaka" ? "besar" : "berlian");
                  }}
                  className="flex flex-wrap gap-4"
                >
                  <label className="flex items-center gap-1.5 text-sm">
                    <RadioGroupItem value="perancangan" id="close-perancangan" /> Perancangan
                  </label>
                  <label className="flex items-center gap-1.5 text-sm">
                    <RadioGroupItem value="pengurusan" id="close-pengurusan" /> Pengurusan
                  </label>
                  <label className="flex items-center gap-1.5 text-sm">
                    <RadioGroupItem value="kesPusaka" id="close-kespusaka" /> Kes Pusaka
                  </label>
                </RadioGroup>
              </div>

              {saleCategory === "perancangan" && (
                <div className="space-y-2">
                  <Label>Type</Label>
                  <RadioGroup value={saleSubCategory} onValueChange={(v) => setSaleSubCategory(v as "wasiat" | "hibah")} className="flex gap-6">
                    <label className="flex items-center gap-1.5 text-sm"><RadioGroupItem value="wasiat" id="close-wasiat" /> Wasiat</label>
                    <label className="flex items-center gap-1.5 text-sm"><RadioGroupItem value="hibah" id="close-hibah" /> Hibah</label>
                  </RadioGroup>
                </div>
              )}
              {saleCategory === "pengurusan" && (
                <div className="space-y-2">
                  <Label>Package</Label>
                  <RadioGroup value={saleSubCategory} onValueChange={(v) => setSaleSubCategory(v as "berlian" | "mutiara")} className="flex gap-6">
                    <label className="flex items-center gap-1.5 text-sm"><RadioGroupItem value="berlian" id="close-berlian" /> Berlian</label>
                    <label className="flex items-center gap-1.5 text-sm"><RadioGroupItem value="mutiara" id="close-mutiara" /> Mutiara</label>
                  </RadioGroup>
                </div>
              )}
              {saleCategory === "kesPusaka" && (
                <div className="space-y-2">
                  <Label>Case size</Label>
                  <RadioGroup value={saleSubCategory} onValueChange={(v) => setSaleSubCategory(v as "besar" | "kecil")} className="flex gap-6">
                    <label className="flex items-center gap-1.5 text-sm"><RadioGroupItem value="besar" id="close-besar" /> Besar</label>
                    <label className="flex items-center gap-1.5 text-sm"><RadioGroupItem value="kecil" id="close-kecil" /> Kecil</label>
                  </RadioGroup>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="close-amount">{saleCategory === "pengurusan" ? "Number of cases" : "Amount (RM)"}</Label>
                <Input id="close-amount" type="number" min={0} step={saleCategory === "pengurusan" ? "1" : "0.01"} required value={saleAmount} onChange={(e) => setSaleAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="close-date">Date</Label>
                <Input id="close-date" type="date" required value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={recordCollection} onChange={(e) => setRecordCollection(e.target.checked)} className="h-4 w-4 rounded border-border" />
                Also record a collection for this
              </label>
              {recordCollection && (
                <div className="space-y-2">
                  <Label htmlFor="close-collection">Collection amount (RM)</Label>
                  <Input id="close-collection" type="number" min={0} step="0.01" value={collectionAmount} onChange={(e) => setCollectionAmount(e.target.value)} />
                </div>
              )}

              {status === "error" && <p className="text-sm font-medium text-red-600">Could not save. Try again.</p>}

              <div className="flex gap-2">
                <Button type="submit" variant="success" disabled={status === "saving"}>
                  {status === "saving" ? "Saving…" : "Close & record"}
                </Button>
                <Button type="button" variant="outline" onClick={() => setMode("history")}>
                  Back
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
