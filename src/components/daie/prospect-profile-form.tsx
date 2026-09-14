"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROFESSION_LABELS, GOVERNMENT_TAHAP_LABELS, INCOME_BRACKET_LABELS } from "@/lib/constants";
import { PROFESSION_TYPES, GOVERNMENT_TAHAP, INCOME_BRACKETS, type ProfessionType, type GovernmentTahap, type IncomeBracket } from "@/lib/types";
import type { ProspectWithId } from "@/lib/data";

const NONE = "__none__";

/**
 * Client-profile fields, edited over time as a daie learns more about a
 * prospect — deliberately separate from the quick "New prospect" add flow
 * (new-prospect-dialog.tsx) so capturing a lead at a booth stays fast. Feeds
 * future per-daie prospect/client analytics (income/profession segmentation
 * etc.) — this screen is data collection only, no analytics view yet.
 */
export function ProspectProfileForm({ prospect, onDone }: { prospect: ProspectWithId; onDone: () => void }) {
  const router = useRouter();
  const [age, setAge] = useState(prospect.age != null ? String(prospect.age) : "");
  const [birthdate, setBirthdate] = useState(prospect.birthdate ?? "");
  const [email, setEmail] = useState(prospect.email ?? "");
  const [profession, setProfession] = useState<ProfessionType | typeof NONE>(prospect.profession ?? NONE);
  const [professionOther, setProfessionOther] = useState(prospect.professionOther ?? "");
  const [governmentTahap, setGovernmentTahap] = useState<GovernmentTahap | typeof NONE>(prospect.governmentTahap ?? NONE);
  const [organizationName, setOrganizationName] = useState(prospect.organizationName ?? "");
  const [incomeBracket, setIncomeBracket] = useState<IncomeBracket | typeof NONE>(prospect.incomeBracket ?? NONE);
  const [importantDate, setImportantDate] = useState(prospect.importantDate ?? "");
  const [importantDateLabel, setImportantDateLabel] = useState(prospect.importantDateLabel ?? "");
  const [faraidNotes, setFaraidNotes] = useState(prospect.faraidNotes ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      await updateDoc(doc(db, "prospects", prospect.id), {
        age: age ? Number(age) : null,
        birthdate: birthdate || null,
        email: email || null,
        profession: profession === NONE ? null : profession,
        professionOther: profession === "others" ? professionOther || null : null,
        governmentTahap: governmentTahap === NONE ? null : governmentTahap,
        organizationName: organizationName || null,
        incomeBracket: incomeBracket === NONE ? null : incomeBracket,
        importantDate: importantDate || null,
        importantDateLabel: importantDate ? importantDateLabel || null : null,
        faraidNotes: faraidNotes || null,
        updatedAt: serverTimestamp(),
      });
      router.refresh();
      onDone();
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm font-semibold text-ink">Client profile</p>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="profile-age">Age</Label>
          <Input id="profile-age" type="number" min={0} max={120} value={age} onChange={(e) => setAge(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-birthdate">Birthdate</Label>
          <Input id="profile-birthdate" type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-email">Email</Label>
        <Input id="profile-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Work / profession</Label>
        <Select value={profession} onValueChange={(v) => setProfession(v as ProfessionType)}>
          <SelectTrigger><SelectValue placeholder="Not specified" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Not specified</SelectItem>
            {PROFESSION_TYPES.map((p) => (
              <SelectItem key={p} value={p}>{PROFESSION_LABELS[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {profession === "others" && (
          <Input
            placeholder="Please specify"
            value={professionOther}
            onChange={(e) => setProfessionOther(e.target.value)}
          />
        )}
      </div>

      <div className="space-y-2">
        <Label>Government service group (if applicable)</Label>
        <Select value={governmentTahap} onValueChange={(v) => setGovernmentTahap(v as GovernmentTahap)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {GOVERNMENT_TAHAP.map((g) => (
              <SelectItem key={g} value={g}>{GOVERNMENT_TAHAP_LABELS[g]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-org">Organization / company / jabatan</Label>
        <Input id="profile-org" value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label>Income bracket</Label>
        <Select value={incomeBracket} onValueChange={(v) => setIncomeBracket(v as IncomeBracket)}>
          <SelectTrigger><SelectValue placeholder="Not specified" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Not specified</SelectItem>
            {INCOME_BRACKETS.map((b) => (
              <SelectItem key={b} value={b}>{INCOME_BRACKET_LABELS[b]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="profile-important-date">Important date</Label>
          <Input id="profile-important-date" type="date" value={importantDate} onChange={(e) => setImportantDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-important-label">What&rsquo;s this date?</Label>
          <Input id="profile-important-label" placeholder="e.g. Anniversary" value={importantDateLabel} onChange={(e) => setImportantDateLabel(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-faraid">Faraid heirs (catatan)</Label>
        <textarea
          id="profile-faraid"
          rows={4}
          value={faraidNotes}
          onChange={(e) => setFaraidNotes(e.target.value)}
          placeholder="Record who the faraid heirs are, relationships, anything worth remembering"
          className="flex w-full rounded-md border border-border bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {status === "error" && <p className="text-sm font-medium text-red-600">Could not save. Try again.</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={status === "saving"}>
          {status === "saving" ? "Saving…" : "Save profile"}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          Back
        </Button>
      </div>
    </form>
  );
}
