"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CurrentUser, Rank, StructureType, Region } from "@/lib/types";
import { REGIONS } from "@/lib/types";
import { REGION_LABELS } from "@/lib/constants";

interface CreateUserResult {
  uid: string;
  daieId: string;
  email: string;
  password: string;
}

export function CreateUserForm({ units, users }: { units: Record<string, string>; users: CurrentUser[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [rank, setRank] = useState<Rank>("DM");
  const [unitId, setUnitId] = useState(Object.keys(units)[0] ?? "");
  const [uplineId, setUplineId] = useState("");
  const [structureType, setStructureType] = useState<StructureType>("TS");
  const [region, setRegion] = useState<Region>("central");
  const [isGroupAdmin, setIsGroupAdmin] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateUserResult | null>(null);

  // Any rank can sponsor any other rank in real hierarchy data (a DPM can
  // recruit another DPM, a DM can recruit another DM) — only "same unit"
  // is a real constraint. See the matching fix in edit-user-dialog.tsx.
  const eligibleUplines = useMemo(() => {
    if (rank === "KDE") return [];
    return users.filter((u) => u.unitId === unitId);
  }, [users, rank, unitId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    setResult(null);
    try {
      const createUser = httpsCallable<
        { name: string; email: string; rank: Rank; unitId: string; uplineId: string | null; structureType: StructureType; region: Region; isGroupAdmin: boolean },
        CreateUserResult
      >(functions, "createUser");
      const response = await createUser({
        name,
        email,
        rank,
        unitId,
        uplineId: rank === "KDE" ? null : uplineId || null,
        structureType,
        region,
        isGroupAdmin,
      });
      setResult(response.data);
      setName("");
      setEmail("");
      setUplineId("");
      setIsGroupAdmin(false);
      setStatus("idle");
      router.refresh();
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Could not create user.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create daie</CardTitle>
        <CardDescription>Creates the Firebase Auth account, Daie ID, and Firestore profile together.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="create-name">Name</Label>
              <Input id="create-name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">Email</Label>
              <Input id="create-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
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
            <div className="space-y-2">
              <Label>Structure</Label>
              <RadioGroup value={structureType} onValueChange={(v) => setStructureType(v as StructureType)} className="flex h-10 items-center gap-4">
                <label className="flex items-center gap-1.5 text-sm">
                  <RadioGroupItem value="TS" id="create-ts" /> TS
                </label>
                <label className="flex items-center gap-1.5 text-sm">
                  <RadioGroupItem value="OS" id="create-os" /> OS
                </label>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label>Region</Label>
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

          {rank !== "KDE" && (
            <div className="space-y-2">
              <Label>Upline ({rank === "DPM" ? "KDE" : "DPM"} in this unit)</Label>
              <Select value={uplineId} onValueChange={setUplineId}>
                <SelectTrigger><SelectValue placeholder="Select upline" /></SelectTrigger>
                <SelectContent>
                  {eligibleUplines.map((u) => (
                    <SelectItem key={u.uid} value={u.uid}>{u.name} ({u.daieId})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {eligibleUplines.length === 0 && (
                <p className="text-xs text-muted-foreground">No eligible upline in this unit yet — create one first.</p>
              )}
            </div>
          )}

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isGroupAdmin} onChange={(e) => setIsGroupAdmin(e.target.checked)} className="h-4 w-4 rounded border-border" />
            Group Admin (sees across all 5 units)
          </label>

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}

          <Button type="submit" disabled={status === "saving" || (rank !== "KDE" && !uplineId)}>
            {status === "saving" ? "Creating…" : "Create daie"}
          </Button>
        </form>

        {result && (
          <div className="mt-4 rounded-lg border border-success/30 bg-success/10 p-4 text-sm">
            <p className="font-semibold text-ink">Account created.</p>
            <p className="mt-1">
              Daie ID: <span className="font-mono">{result.daieId}</span>
            </p>
            <p>
              Login: <span className="font-mono">{result.email}</span> / <span className="font-mono">{result.password}</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
