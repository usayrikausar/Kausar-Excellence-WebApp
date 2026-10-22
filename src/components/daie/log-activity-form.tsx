"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, doc, serverTimestamp, Timestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SOURCE_LABELS, STAGE_LABELS } from "@/lib/constants";
import { FINAL_STAGE, PIPPPAS_STAGES, type PipppasStage, type ProspectSource } from "@/lib/types";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** How a daie went prospecting — the Prospecting step's options. */
const PROSPECTING_METHODS: ProspectSource[] = ["booth", "live_tiktok", "social_media", "direct_approach", "referral", "talk", "project200", "prosper_invite", "other"];
/** Stages logged against a prospect that already exists (everything after Initial Contact). */
const LATER_STAGES = PIPPPAS_STAGES.filter((s) => s !== "prospecting" && s !== "initial_contact");

type Step = PipppasStage | "training" | "jfw";

export interface ActivityProspectOption {
  id: string;
  name: string;
  stage: PipppasStage;
  phone: string | null;
}
export interface TeamMemberOption {
  uid: string;
  name: string;
  daieId: string;
}

type Service = "perancangan" | "pengurusan" | "kesPusaka";
const SERVICE_SUBS: Record<Service, Array<{ value: string; label: string }>> = {
  perancangan: [{ value: "wasiat", label: "Wasiat" }, { value: "hibah", label: "Hibah" }],
  pengurusan: [{ value: "berlian", label: "Berlian" }, { value: "mutiara", label: "Mutiara" }],
  kesPusaka: [{ value: "besar", label: "Besar" }, { value: "kecil", label: "Kecil" }],
};

/**
 * One form for everything a daie does, organised by PIPPPAS: pick the step
 * first, then only that step's fields appear.
 * - Prospecting: method + people reached (feeds the traffic light's Reach).
 * - Initial Contact: the person's details — creates the prospect.
 * - Every later stage: pick an existing prospect and move them there (any
 *   later stage; skipping is allowed). Present Solution is where the client
 *   picks a service, so the sale can be recorded there. The last stage
 *   completes the case.
 * - Other: Training attended, JFW (joint field work) with a team member.
 */
export function LogActivityForm({
  uid,
  prospects,
  team,
}: {
  uid: string;
  prospects: ActivityProspectOption[];
  team: TeamMemberOption[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("prospecting");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorText, setErrorText] = useState("");

  // Prospecting
  const [method, setMethod] = useState<ProspectSource>("booth");
  const [reachCount, setReachCount] = useState("");
  // Initial Contact
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState<ProspectSource>("direct_approach");
  // Later stages
  const [prospectId, setProspectId] = useState("");
  const [nextFollowUpDate, setNextFollowUpDate] = useState("");
  const [recordSale, setRecordSale] = useState(false);
  const [service, setService] = useState<Service>("perancangan");
  const [serviceSub, setServiceSub] = useState("wasiat");
  const [saleValue, setSaleValue] = useState("");
  // JFW
  const [withUid, setWithUid] = useState("");

  const isLater = (LATER_STAGES as readonly string[]).includes(step);
  const reachless = method === "prosper_invite";
  const selectedProspect = prospects.find((p) => p.id === prospectId) ?? null;

  function resetFields() {
    setNote("");
    setReachCount("");
    setName("");
    setPhone("");
    setEmail("");
    setProspectId("");
    setNextFollowUpDate("");
    setRecordSale(false);
    setSaleValue("");
    setWithUid("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setErrorText("");
    try {
      if (step === "prospecting") {
        await addDoc(collection(db, "activities"), {
          uid,
          type: method,
          reachCount: reachless ? 0 : Number(reachCount) || 0,
          note: note || null,
          date,
          createdAt: serverTimestamp(),
        });
      } else if (step === "training" || step === "jfw") {
        const partner = team.find((m) => m.uid === withUid) ?? null;
        await addDoc(collection(db, "activities"), {
          uid,
          type: step,
          reachCount: 0,
          note: note || null,
          date,
          ...(step === "jfw" ? { withUid: partner?.uid ?? null, withName: partner?.name ?? null } : {}),
          createdAt: serverTimestamp(),
        });
      } else if (step === "initial_contact") {
        const prospectRef = doc(collection(db, "prospects"));
        const batch = writeBatch(db);
        batch.set(prospectRef, {
          uid,
          name,
          phone: phone || null,
          email: email || null,
          details: note || null,
          source,
          stage: "initial_contact",
          status: "active",
          nextFollowUpDate: nextFollowUpDate || null,
          linkedSaleId: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        batch.set(doc(collection(db, "prospects", prospectRef.id, "updates")), {
          uid,
          stage: "initial_contact",
          note: note || `First contact (${SOURCE_LABELS[source]}).`,
          nextFollowUpDate: nextFollowUpDate || null,
          date,
          createdAt: serverTimestamp(),
        });
        await batch.commit();
      } else {
        if (!selectedProspect) throw new Error("Choose the prospect first.");
        const stage = step as PipppasStage;
        const batch = writeBatch(db);
        const prospectPatch: Record<string, unknown> = {
          stage,
          nextFollowUpDate: nextFollowUpDate || null,
          updatedAt: serverTimestamp(),
        };
        if (stage === FINAL_STAGE) prospectPatch.status = "closed_won";
        if (stage === "present_solution" && recordSale) {
          const value = Number(saleValue);
          if (!value || value <= 0) throw new Error(service === "pengurusan" ? "Enter the number of cases." : "Enter the amount.");
          const saleRef = doc(collection(db, "sales"));
          batch.set(saleRef, {
            uid,
            category: service,
            subCategory: serviceSub,
            amount: service === "pengurusan" ? null : value,
            count: service === "pengurusan" ? value : null,
            date: Timestamp.fromDate(new Date(date)),
            createdAt: serverTimestamp(),
            prospectId: selectedProspect.id,
          });
          prospectPatch.linkedSaleId = saleRef.id;
        }
        batch.set(doc(collection(db, "prospects", selectedProspect.id, "updates")), {
          uid,
          stage,
          note: note || null,
          nextFollowUpDate: nextFollowUpDate || null,
          date,
          createdAt: serverTimestamp(),
        });
        batch.update(doc(db, "prospects", selectedProspect.id), prospectPatch);
        await batch.commit();
      }
      resetFields();
      setStatus("saved");
      router.refresh();
    } catch (err) {
      const code = (err as { code?: string }).code;
      setErrorText(code ? `Could not save (${code}).` : err instanceof Error ? err.message : "Could not save.");
      setStatus("error");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log an activity</CardTitle>
        <CardDescription>Pick the PIPPPAS step you did, or Training / JFW. Only that step&rsquo;s fields appear.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="activity-step">What did you do?</Label>
              <Select
                value={step}
                onValueChange={(v) => {
                  setStep(v as Step);
                  setStatus("idle");
                }}
              >
                <SelectTrigger id="activity-step"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>PIPPPAS</SelectLabel>
                    {PIPPPAS_STAGES.map((s) => (
                      <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>Other</SelectLabel>
                    <SelectItem value="training">Training (attended)</SelectItem>
                    <SelectItem value="jfw">JFW (joint field work with team)</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity-date">Date</Label>
              <Input id="activity-date" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          {step === "prospecting" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="activity-method">How</Label>
                <Select value={method} onValueChange={(v) => setMethod(v as ProspectSource)}>
                  <SelectTrigger id="activity-method"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROSPECTING_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{SOURCE_LABELS[m]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!reachless && (
                <div className="space-y-2">
                  <Label htmlFor="activity-reach">People reached</Label>
                  <Input id="activity-reach" type="number" min={0} step="1" required value={reachCount} onChange={(e) => setReachCount(e.target.value)} />
                </div>
              )}
            </div>
          )}

          {step === "initial_contact" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contact-name">Name</Label>
                <Input id="contact-name" required value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-phone">Phone</Label>
                <Input id="contact-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. 012-345 6789" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-email">Email (optional)</Label>
                <Input id="contact-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-source">How you met</Label>
                <Select value={source} onValueChange={(v) => setSource(v as ProspectSource)}>
                  <SelectTrigger id="contact-source"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROSPECTING_METHODS.filter((m) => m !== "prosper_invite").map((m) => (
                      <SelectItem key={m} value={m}>{SOURCE_LABELS[m]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {isLater && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="activity-prospect">Prospect</Label>
                {prospects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No prospects yet — log an Initial Contact first.</p>
                ) : (
                  <Select value={prospectId} onValueChange={setProspectId}>
                    <SelectTrigger id="activity-prospect"><SelectValue placeholder="Choose a prospect" /></SelectTrigger>
                    <SelectContent>
                      {prospects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} — now at {STAGE_LABELS[p.stage]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {step === "present_solution" && (
                <div className="space-y-3 rounded-md border border-border p-3">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" checked={recordSale} onChange={(e) => setRecordSale(e.target.checked)} />
                    Client chose a service — record the sale
                  </label>
                  {recordSale && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="space-y-2">
                        <Label htmlFor="sale-service">Service</Label>
                        <Select
                          value={service}
                          onValueChange={(v) => {
                            setService(v as Service);
                            setServiceSub(SERVICE_SUBS[v as Service][0].value);
                          }}
                        >
                          <SelectTrigger id="sale-service"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="perancangan">Perancangan</SelectItem>
                            <SelectItem value="pengurusan">Pengurusan (Al Wasitah)</SelectItem>
                            <SelectItem value="kesPusaka">Kes Pusaka</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sale-sub">Type</Label>
                        <Select value={serviceSub} onValueChange={setServiceSub}>
                          <SelectTrigger id="sale-sub"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {SERVICE_SUBS[service].map((o) => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sale-value">{service === "pengurusan" ? "Number of cases" : "Amount (RM)"}</Label>
                        <Input id="sale-value" type="number" min={0} step={service === "pengurusan" ? "1" : "0.01"} value={saleValue} onChange={(e) => setSaleValue(e.target.value)} />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === FINAL_STAGE && (
                <p className="text-sm text-muted-foreground">This is the last step — the case will be marked complete.</p>
              )}
            </div>
          )}

          {step === "jfw" && (
            <div className="space-y-2">
              <Label htmlFor="jfw-with">With</Label>
              {team.length === 0 ? (
                <p className="text-sm text-muted-foreground">No team members to choose from — add a note instead.</p>
              ) : (
                <Select value={withUid} onValueChange={setWithUid}>
                  <SelectTrigger id="jfw-with"><SelectValue placeholder="Choose a team member" /></SelectTrigger>
                  <SelectContent>
                    {team.map((m) => (
                      <SelectItem key={m.uid} value={m.uid}>{m.name} ({m.daieId})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="activity-note">
                {step === "initial_contact" ? "Details (optional)" : step === "training" ? "Which training (optional)" : "Note (optional)"}
              </Label>
              <Input
                id="activity-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={step === "prospecting" ? "e.g. Booth at Mall X, good response" : step === "jfw" ? "e.g. Booth together at Shah Alam" : ""}
              />
            </div>
            {(step === "initial_contact" || isLater) && step !== FINAL_STAGE && (
              <div className="space-y-2">
                <Label htmlFor="activity-followup">Next follow-up (optional)</Label>
                <Input id="activity-followup" type="date" value={nextFollowUpDate} onChange={(e) => setNextFollowUpDate(e.target.value)} />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={status === "saving" || (isLater && !prospectId)}>
              {status === "saving" ? "Saving…" : step === "initial_contact" ? "Add prospect" : "Log it"}
            </Button>
            {status === "saved" && <span className="text-sm font-medium text-success">Saved.</span>}
            {status === "error" && <span className="text-sm font-medium text-red-600">{errorText}</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
