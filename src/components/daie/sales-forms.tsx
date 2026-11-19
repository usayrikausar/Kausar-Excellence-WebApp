"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, doc, serverTimestamp, Timestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductPromoFields, DepositField } from "@/components/daie/sale-detail-fields";
import { cleanProducts, cleanPromotion, WASITAH_PACKAGES, type CaseOption, type WasitahPackage } from "@/lib/sale-details";

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

/**
 * Perancangan box: a new wasiat/hibah case, or a payment received against
 * one. Collections only ever relate to Perancangan, so they're entered here
 * rather than in a box of their own.
 */
export function PerancanganForm({
  uid,
  prospects = [],
  initialMode = "case",
  cases = [],
  onSaved,
}: {
  uid: string;
  prospects?: ProspectOption[];
  initialMode?: "case" | "collection";
  /** The daie's own Perancangan cases, for "Payment received → for which case". */
  cases?: CaseOption[];
  /** Called after a successful save — the quick-add screen uses it to go back. */
  onSaved?: () => void;
}) {
  const [mode, setMode] = useState<"case" | "collection">(initialMode);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Perancangan</CardTitle>
        <CardDescription>
          {mode === "case"
            ? "A new planning case: the total amount, the products in it and any promotion."
            : "A payment received for a Perancangan case, recorded when it comes in."}
        </CardDescription>
        <div role="tablist" aria-label="Perancangan entry type" className="mt-2 flex w-fit gap-1 rounded-lg bg-muted p-1">
          {(["case", "collection"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={
                "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors " +
                (mode === m ? "bg-white text-ink shadow-sm" : "text-muted-foreground hover:text-ink")
              }
            >
              {m === "case" ? "New case" : "Payment received"}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {mode === "case" ? <PerancanganCaseFields uid={uid} prospects={prospects} onSaved={onSaved} /> : <CollectionFields uid={uid} prospects={prospects} cases={cases} onSaved={onSaved} />}
      </CardContent>
    </Card>
  );
}

function PerancanganCaseFields({ uid, prospects, onSaved }: { uid: string; prospects: ProspectOption[]; onSaved?: () => void }) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [products, setProducts] = useState<string[]>([""]);
  const [promotion, setPromotion] = useState("");
  const [deposit, setDeposit] = useState("");
  const [date, setDate] = useState(todayISO());
  const [prospectId, setProspectId] = useState("none");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      // One batch: the case, and its deposit as a collection against it.
      const batch = writeBatch(db);
      const saleRef = doc(collection(db, "sales"));
      const linked = prospectId === "none" ? null : prospectId;
      const when = Timestamp.fromDate(new Date(date));
      batch.set(saleRef, {
        uid,
        category: "perancangan",
        // No Wasiat/Hibah split any more (agreed 2026-11-19): one total, products listed instead.
        subCategory: null,
        amount: Number(amount),
        count: null,
        products: cleanProducts(products),
        promotion: cleanPromotion(promotion),
        date: when,
        createdAt: serverTimestamp(),
        prospectId: linked,
      });
      if (Number(deposit) > 0) {
        batch.set(doc(collection(db, "collections")), {
          uid,
          saleRef: saleRef.id,
          kind: "deposit",
          amountCollected: Number(deposit),
          date: when,
          createdAt: serverTimestamp(),
          prospectId: linked,
          note: "Deposit",
        });
      }
      await batch.commit();
      setAmount("");
      setProducts([""]);
      setPromotion("");
      setDeposit("");
      setProspectId("none");
      setStatus("saved");
      router.refresh();
      onSaved?.();
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="perancangan-amount">Total amount (RM)</Label>
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
      <ProductPromoFields idPrefix="perancangan" products={products} onProductsChange={setProducts} promotion={promotion} onPromotionChange={setPromotion} />
      <DepositField id="perancangan-deposit" value={deposit} onChange={setDeposit} />
      <div className="space-y-2">
        <Label htmlFor="perancangan-date">Date</Label>
        <Input id="perancangan-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <ProspectLinkSelect prospects={prospects} value={prospectId} onChange={setProspectId} idPrefix="perancangan" />
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Add case"}
        </Button>
        <StatusMessage status={status} />
      </div>
    </form>
  );
}

export function PengurusanForm({ uid, prospects = [], onSaved }: { uid: string; prospects?: ProspectOption[]; onSaved?: () => void }) {
  const router = useRouter();
  const [subCategory, setSubCategory] = useState<WasitahPackage>("berlian");
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
      onSaved?.();
    } catch {
      setStatus("error");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pengurusan / Al Wasitah</CardTitle>
        <CardDescription>Pick the package and enter the number of cases.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pengurusan-package">Package</Label>
            <Select value={subCategory} onValueChange={(v) => setSubCategory(v as WasitahPackage)}>
              <SelectTrigger id="pengurusan-package"><SelectValue /></SelectTrigger>
              <SelectContent>
                {WASITAH_PACKAGES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
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

export function KesPusakaForm({ uid, prospects = [], onSaved }: { uid: string; prospects?: ProspectOption[]; onSaved?: () => void }) {
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
      onSaved?.();
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
function CollectionFields({ uid, prospects, cases, onSaved }: { uid: string; prospects: ProspectOption[]; cases: CaseOption[]; onSaved?: () => void }) {
  const router = useRouter();
  const [amountCollected, setAmountCollected] = useState("");
  const [date, setDate] = useState(todayISO());
  const [caseId, setCaseId] = useState("none");
  const [prospectId, setProspectId] = useState("none");
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const picked = cases.find((c) => c.id === caseId) ?? null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      await addDoc(collection(db, "collections"), {
        uid,
        saleRef: picked ? picked.id : null,
        kind: "payment",
        amountCollected: Number(amountCollected),
        date: Timestamp.fromDate(new Date(date)),
        createdAt: serverTimestamp(),
        // A picked case carries its own prospect link.
        prospectId: picked ? picked.prospectId : prospectId === "none" ? null : prospectId,
        note: note.trim().slice(0, 200) || null,
      });
      setAmountCollected("");
      setCaseId("none");
      setProspectId("none");
      setNote("");
      setStatus("saved");
      router.refresh();
      onSaved?.();
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border border-accent/40 bg-accent/10 p-3 text-xs leading-relaxed text-ink">
        <p className="font-semibold">Why record each payment?</p>
        <p className="mt-1">
          Collection helps work out contest qualification. Example: a RM10,000 case with a RM4,000 deposit, the rest paid in 3 instalments. Record each
          instalment when it comes in, say in February, and a January–June contest can count it. The more complete your updates, the more accurate your
          collection figure.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="collection-amount">Amount received (RM)</Label>
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
        <Label htmlFor="collection-date">Date received</Label>
        <Input id="collection-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      {cases.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="collection-case">For which case (optional)</Label>
          <Select value={caseId} onValueChange={setCaseId}>
            <SelectTrigger id="collection-case"><SelectValue placeholder="Not linked" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not linked to a case</SelectItem>
              {cases.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {!picked && <ProspectLinkSelect prospects={prospects} value={prospectId} onChange={setProspectId} idPrefix="collection" />}
      <div className="space-y-2">
        <Label htmlFor="collection-note">Note (optional)</Label>
        <Input id="collection-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 2nd instalment of 3" maxLength={200} />
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Add payment"}
        </Button>
        <StatusMessage status={status} />
      </div>
    </form>
  );
}
