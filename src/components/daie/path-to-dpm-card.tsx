"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProgressBar } from "@/components/daie/progress-bar";
import { formatRM } from "@/lib/utils";
import type { DpmPromotionStatus } from "@/lib/promotion";

function CriterionStatus({ met }: { met: boolean }) {
  return met ? (
    <Badge variant="success">Met</Badge>
  ) : (
    <Badge variant="outline">Not yet</Badge>
  );
}

export function PathToDpmCard({
  uid,
  status,
  selfWasitah,
}: {
  uid: string;
  status: DpmPromotionStatus;
  selfWasitah: { active: boolean; since: string | null };
}) {
  const router = useRouter();
  const [active, setActive] = useState(selfWasitah.active);
  const [since, setSince] = useState(selfWasitah.since ?? "");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "error">("idle");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaveStatus("saving");
    try {
      await setDoc(
        doc(db, "wasitahSubscription", uid),
        { active, since: active ? since || null : null, updatedAt: serverTimestamp() },
        { merge: true },
      );
      router.refresh();
      setSaveStatus("idle");
    } catch {
      setSaveStatus("error");
    }
  }

  const { jualanPeribadi, lantikanLangsung, tempohAktif, wasitahSubscriptionSelf, fiveDmConditions } = status;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>Path to DPM</CardTitle>
          <Badge variant={status.overallMet ? "success" : "muted"}>
            {status.overallMet ? "Quota met" : "In progress"}
          </Badge>
        </div>
        <CardDescription>{status.regimeEffectiveNote}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">Jualan Peribadi</p>
            <CriterionStatus met={jualanPeribadi.met} />
          </div>
          <ProgressBar label="Al Wasitah cases" value={jualanPeribadi.alWasitahKes} max={jualanPeribadi.alWasitahTarget} accent="success" />
          <ProgressBar label="Perancangan" value={jualanPeribadi.perancangan} max={jualanPeribadi.perancanganTarget} formatValue={formatRM} accent="success" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">Lantikan Langsung DM</p>
            <CriterionStatus met={lantikanLangsung.met} />
          </div>
          <ProgressBar label="DM recruited directly" value={lantikanLangsung.count} max={lantikanLangsung.target} accent="primary" />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">Tempoh Aktif</p>
            <CriterionStatus met={tempohAktif.met} />
          </div>
          <ProgressBar label="Months active" value={tempohAktif.months} max={tempohAktif.target} accent="primary" />
        </div>

        <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">Langganan Al Wasitah (calon)</p>
            <CriterionStatus met={wasitahSubscriptionSelf.met} />
          </div>
          <p className="text-xs text-muted-foreground">{wasitahSubscriptionSelf.detail}</p>
          <form onSubmit={handleSave} className="flex flex-wrap items-end gap-3 pt-1">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-4 w-4 rounded border-border" />
              My Al Wasitah subscription is active
            </label>
            {active && (
              <div className="space-y-1">
                <Label htmlFor="wasitah-since" className="text-xs">Active since</Label>
                <Input id="wasitah-since" type="date" value={since} onChange={(e) => setSince(e.target.value)} className="h-8" />
              </div>
            )}
            <Button type="submit" size="sm" disabled={saveStatus === "saving"}>
              {saveStatus === "saving" ? "Saving…" : "Save"}
            </Button>
            {saveStatus === "error" && <span className="text-xs font-medium text-red-600">Could not save.</span>}
          </form>
        </div>

        {lantikanLangsung.count > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-ink">Syarat 5 DM yang dilantik</p>
              <CriterionStatus met={fiveDmConditions.met} />
            </div>
            <p className="text-xs text-muted-foreground">{fiveDmConditions.detail}</p>
            <div className="space-y-1.5">
              {fiveDmConditions.recruits.map((r) => (
                <div key={r.uid} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-xs">
                  <span className="font-medium text-ink">{r.name}</span>
                  <span className="text-muted-foreground">
                    {formatRM(r.perancangan)} perancangan &middot; Al Wasitah {r.wasitahActive ? `${r.wasitahMonthsActive} bln aktif` : "tidak aktif"}
                  </span>
                  <CriterionStatus met={r.meetsBar} />
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
