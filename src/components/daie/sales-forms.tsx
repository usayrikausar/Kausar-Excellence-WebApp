"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Plain, minimal prospect shape — avoids importing ProspectWithId from the "server-only" lib/data.ts into these Client Components. */
export interface ProspectOption {
  id: string;
  name: string;
}

/** Optional "link to a prospect" picker, shared by every entry form below — lets a sale/collection entered the normal way still be tied back to a pipeline prospect (see prospect-detail-dialog.tsx's "Close & Record Sale" for the other path). */
function ProspectLinkSelect({ prospects, value, onChange, idPrefix }: { prospects: ProspectOption[]; value: string; onChange: (v: string) => void; idPrefix: string }) {
  if (prospects.length === 0) return null;
  return (
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}-prospect`}>Link to a prospect (optional)</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={`${idPrefix}-prospect`}><SelectValue placeholder="None" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">None</SelectItem>
          {prospects.map((p) => (
            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function StatusMessage({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  if (status === "saved") return <p className="text-sm font-medium text-success">Saved.</p>;
  if (status === "error") return <p className="text-sm font-medium text-red-600">Could not save. Try again.</p>;
  return null;
}

export function PerancanganForm({ uid, prospects = [] }: { uid: string; prospects?: ProspectOption[] }) {
  const router = useRouter();
  const [subCategory, setSubCategory] = useState<"wasiat" | "hibah">("wasiat");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [prospectId, setProspectId] = useState("none");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      await addDoc(collection(db, "sales"), {
        uid,
        category: "perancangan",
        subCategory,
        amount: Number(amount),
        count: null,
        date: Timestamp.fromDate(new Date(date)),
        createdAt: serverTimestamp(),
        prospectId: prospectId === "none" ? null : prospectId,
      });
      setAmount("");
      setProspectId("none");
      setStatus("saved");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Perancangan</CardTitle>
        <CardDescription>Wasiat or hibah planning case — Perancangan totals combine both; picking one here only powers the separate Hibah Round Table tracking.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <RadioGroup value={subCategory} onValueChange={(v) => setSubCategory(v as "wasiat" | "hibah")} className="flex gap-6">
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="wasiat" id="perancangan-wasiat" /> Wasiat</label>
              <label className="flex items-center gap-2 text-sm"><RadioGroupItem value="hibah" id="perancangan-hibah" /> Hibah</label>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="perancangan-amount">Amount (RM)</Label>
            <Input
              id="perancangan-amount"
              type="number"
              min={0}
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="perancangan-date">Date</Label>
            <Input id="perancangan-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <ProspectLinkSelect prospects={prospects} value={prospectId} onChange={setProspectId} idPrefix="perancangan" />
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={status === "saving"}>
              {status === "saving" ? "Saving…" : "Add entry"}
            </Button>
            <StatusMessage status={status} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function PengurusanForm({ uid, prospects = [] }: { uid: string; prospects?: ProspectOption[] }) {
  const router = useRouter();
  const [subCategory, setSubCategory] = useState<"berlian" | "mutiara">("berlian");
  const [count, setCount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [prospectId, setProspectId] = useState("none");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      await addDoc(collection(db, "sales"), {
        uid,
        category: "pengurusan",
        subCategory,
        amount: null,
        count: Number(count),
        date: Timestamp.fromDate(new Date(date)),
        createdAt: serverTimestamp(),
        prospectId: prospectId === "none" ? null : prospectId,
      });
      setCount("");
      setProspectId("none");
      setStatus("saved");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pengurusan / Al Wasitah</CardTitle>
        <CardDescription>Berlian or Mutiara package — enter the number of cases.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Package</Label>
            <RadioGroup
              value={subCategory}
              onValueChange={(v) => setSubCategory(v as "berlian" | "mutiara")}
              className="flex gap-6"
            >
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="berlian" id="pengurusan-berlian" />
                Berlian
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="mutiara" id="pengurusan-mutiara" />
                Mutiara
              </label>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pengurusan-count">Number of cases</Label>
            <Input
              id="pengurusan-count"
              type="number"
              min={1}
              step="1"
              required
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pengurusan-date">Date</Label>
            <Input id="pengurusan-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <ProspectLinkSelect prospects={prospects} value={prospectId} onChange={setProspectId} idPrefix="pengurusan" />
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={status === "saving"}>
              {status === "saving" ? "Saving…" : "Add entry"}
            </Button>
            <StatusMessage status={status} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function KesPusakaForm({ uid, prospects = [] }: { uid: string; prospects?: ProspectOption[] }) {
  const router = useRouter();
  const [subCategory, setSubCategory] = useState<"besar" | "kecil">("besar");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [prospectId, setProspectId] = useState("none");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      await addDoc(collection(db, "sales"), {
        uid,
        category: "kesPusaka",
        subCategory,
        amount: Number(amount),
        count: null,
        date: Timestamp.fromDate(new Date(date)),
        createdAt: serverTimestamp(),
        prospectId: prospectId === "none" ? null : prospectId,
      });
      setAmount("");
      setProspectId("none");
      setStatus("saved");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kes Pusaka</CardTitle>
        <CardDescription>Besar or Kecil estate case — enter the RM amount.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Case size</Label>
            <RadioGroup value={subCategory} onValueChange={(v) => setSubCategory(v as "besar" | "kecil")} className="flex gap-6">
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="besar" id="kespusaka-besar" />
                Besar
              </label>
              <label className="flex items-center gap-2 text-sm">
                <RadioGroupItem value="kecil" id="kespusaka-kecil" />
                Kecil
              </label>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="kespusaka-amount">Amount (RM)</Label>
            <Input
              id="kespusaka-amount"
              type="number"
              min={0}
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="kespusaka-date">Date</Label>
            <Input id="kespusaka-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <ProspectLinkSelect prospects={prospects} value={prospectId} onChange={setProspectId} idPrefix="kespusaka" />
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={status === "saving"}>
              {status === "saving" ? "Saving…" : "Add entry"}
            </Button>
            <StatusMessage status={status} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * There was previously no way to enter a Collection at all — lib/data.ts
 * read from the `collections` collection, but nothing wrote to it. Mirrors
 * the sales-entry forms above: standalone amount + date, with the same
 * optional prospect link (saleRef is left null — no UI here to pick which
 * specific prior sale a payment is against, that's a bigger feature).
 */
export function CollectionForm({ uid, prospects = [] }: { uid: string; prospects?: ProspectOption[] }) {
  const router = useRouter();
  const [amountCollected, setAmountCollected] = useState("");
  const [date, setDate] = useState(todayISO());
  const [prospectId, setProspectId] = useState("none");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      await addDoc(collection(db, "collections"), {
        uid,
        saleRef: null,
        amountCollected: Number(amountCollected),
        date: Timestamp.fromDate(new Date(date)),
        createdAt: serverTimestamp(),
        prospectId: prospectId === "none" ? null : prospectId,
      });
      setAmountCollected("");
      setProspectId("none");
      setStatus("saved");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Collection</CardTitle>
        <CardDescription>Payment received — enter the RM amount collected.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="collection-amount">Amount collected (RM)</Label>
            <Input
              id="collection-amount"
              type="number"
              min={0}
              step="0.01"
              required
              value={amountCollected}
              onChange={(e) => setAmountCollected(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="collection-date">Date</Label>
            <Input id="collection-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <ProspectLinkSelect prospects={prospects} value={prospectId} onChange={setProspectId} idPrefix="collection" />
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={status === "saving"}>
              {status === "saving" ? "Saving…" : "Add entry"}
            </Button>
            <StatusMessage status={status} />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
