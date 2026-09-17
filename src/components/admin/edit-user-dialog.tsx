"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Input } from "@/components/ui/input";
import type { CurrentUser, Rank, StructureType, Region } from "@/lib/types";
import { REGION_LABELS } from "@/lib/constants";
import { REGIONS } from "@/lib/types";

export function EditUserDialog({ user, units, users }: { user: CurrentUser; units: Record<string, string>; users: CurrentUser[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rank, setRank] = useState<Rank>(user.rank);
  const [unitId, setUnitId] = useState(user.unitId);
  const [uplineId, setUplineId] = useState(user.uplineId ?? "");
  const [structureType, setStructureType] = useState<StructureType>(user.structureType);
  const [isGroupAdmin, setIsGroupAdmin] = useState(user.isGroupAdmin);
  const [isLdpMember, setIsLdpMember] = useState(user.isLdpMember);
  const [region, setRegion] = useState<Region>(user.region);
  const [dateLicensed, setDateLicensed] = useState(user.dateLicensed ?? "");
  const [dateExpiry, setDateExpiry] = useState(user.dateExpiry ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  // Real hierarchy data shows a daie of any rank can sponsor any other rank
  // (a DPM can recruit another DPM, a DM can recruit another DM) — so the
  // only real constraints are "same unit" and "not yourself." An earlier
  // version of this filter assumed a rigid KDE→DPM→DM shape and would have
  // hidden valid uplines.
  const eligibleUplines = useMemo(() => {
    if (rank === "KDE") return [];
    return users.filter((u) => u.unitId === unitId && u.uid !== user.uid);
  }, [users, rank, unitId, user.uid]);

  async function handleSave() {
    setStatus("saving");
    setError(null);
    try {
      const updateUser = httpsCallable(functions, "updateUser");
      await updateUser({
        uid: user.uid,
        rank,
        unitId,
        uplineId: rank === "KDE" ? null : uplineId || null,
        structureType,
        isGroupAdmin,
        isLdpMember,
        region,
        dateLicensed: dateLicensed || null,
        dateExpiry: dateExpiry || null,
      });
      setOpen(false);
      router.refresh();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not save changes.");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Edit</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {user.name}</DialogTitle>
          <DialogDescription>{user.daieId} · {user.email}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Rank</Label>
              <Select value={rank} onValueChange={(v) => { setRank(v as Rank); setUplineId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="KDE">KDE</SelectItem>
                  <SelectItem value="DPM">DPM</SelectItem>
                  <SelectItem value="DM">DM</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={unitId} onValueChange={(v) => { setUnitId(v); setUplineId(""); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(units).map(([id, label]) => (
                    <SelectItem key={id} value={id}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {rank !== "KDE" && (
            <div className="space-y-2">
              <Label>Upline</Label>
              <Select value={uplineId} onValueChange={setUplineId}>
                <SelectTrigger><SelectValue placeholder="Select upline" /></SelectTrigger>
                <SelectContent>
                  {eligibleUplines.map((u) => (
                    <SelectItem key={u.uid} value={u.uid}>{u.name} ({u.daieId})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Structure</Label>
              <RadioGroup value={structureType} onValueChange={(v) => setStructureType(v as StructureType)} className="flex gap-6 pt-2">
                <label className="flex items-center gap-1.5 text-sm">
                  <RadioGroupItem value="TS" id={`edit-ts-${user.uid}`} /> TS
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <RadioGroupItem value="OS" id={`edit-os-${user.uid}`} /> OS
                </label>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label>Region <span className="font-normal text-muted-foreground">(Konvensyen award)</span></Label>
              <Select value={region} onValueChange={(v) => setRegion(v as Region)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>{REGION_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`edit-date-licensed-${user.uid}`}>
              Date licensed <span className="font-normal text-muted-foreground">(set after onboarding is complete)</span>
            </Label>
            <Input
              id={`edit-date-licensed-${user.uid}`}
              type="date"
              value={dateLicensed}
              onChange={(e) => setDateLicensed(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`edit-date-expiry-${user.uid}`}>
              Date expiry <span className="font-normal text-muted-foreground">(update whenever the contract renews)</span>
            </Label>
            <Input
              id={`edit-date-expiry-${user.uid}`}
              type="date"
              value={dateExpiry}
              onChange={(e) => setDateExpiry(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              The real Wasiyyah contract end date — drives &ldquo;Active/Expired&rdquo; status and the expiry reminders on My Team.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isGroupAdmin} onChange={(e) => setIsGroupAdmin(e.target.checked)} className="h-4 w-4 rounded border-border" />
            Group Admin
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isLdpMember} onChange={(e) => setIsLdpMember(e.target.checked)} className="h-4 w-4 rounded border-border" />
            LDP member (Kausar Leadership Programme)
          </label>

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}

          <Button onClick={handleSave} disabled={status === "saving"} className="w-full">
            {status === "saving" ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
