"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { CurrentUser, TrainingAttendanceEntry, AttendanceMethod } from "@/lib/types";

const METHOD_LABELS: Record<AttendanceMethod, string> = {
  qr: "QR check-in",
  self_reported: "Self-reported",
  manual: "Marked by admin",
};

export function TrainingAttendancePanel({
  trainingId,
  attendance,
  allUsers,
  adminUid,
}: {
  trainingId: string;
  attendance: TrainingAttendanceEntry[];
  allUsers: CurrentUser[];
  adminUid: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [savingUid, setSavingUid] = useState<string | null>(null);

  const usersByUid = useMemo(() => new Map(allUsers.map((u) => [u.uid, u])), [allUsers]);
  const attendedUids = useMemo(() => new Set(attendance.map((a) => a.uid)), [attendance]);

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    // Real roster data has occasional null name/daieId (dirty rows from the
    // Wasiyyah import) — guard rather than let one bad record crash the search.
    return allUsers
      .filter((u) => !attendedUids.has(u.uid) && ((u.name ?? "").toLowerCase().includes(q) || (u.daieId ?? "").toLowerCase().includes(q)))
      .slice(0, 8);
  }, [search, allUsers, attendedUids]);

  async function markPresent(uid: string) {
    setSavingUid(uid);
    try {
      await setDoc(doc(db, "trainingAttendance", `${trainingId}_${uid}`), {
        trainingId,
        uid,
        method: "manual",
        qrToken: null,
        markedBy: adminUid,
        markedAt: serverTimestamp(),
      });
      setSearch("");
      router.refresh();
    } finally {
      setSavingUid(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Users className="mr-1.5 h-4 w-4" /> {attendance.length} attended</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Attendance</DialogTitle>
          <DialogDescription>{attendance.length} checked in so far. Use the search below for anyone who couldn&rsquo;t scan the QR.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Input placeholder="Search by name or Daie ID to mark present manually…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {searchResults.length > 0 && (
            <div className="space-y-1 rounded-md border border-border p-1">
              {searchResults.map((u) => (
                <button
                  key={u.uid}
                  type="button"
                  onClick={() => markPresent(u.uid)}
                  disabled={savingUid === u.uid}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted disabled:opacity-50"
                >
                  <span>{u.name} <span className="text-xs text-muted-foreground">({u.daieId})</span></span>
                  <span className="text-xs font-medium text-primary">{savingUid === u.uid ? "Marking…" : "Mark present"}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mt-2 space-y-1.5">
          {attendance.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No one has checked in yet.</p>}
          {attendance
            .slice()
            .sort((a, b) => a.markedAt.localeCompare(b.markedAt))
            .map((a) => {
              const u = usersByUid.get(a.uid);
              return (
                <div key={a.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                  <span className="font-medium text-ink">{u?.name ?? a.uid} <span className="text-xs font-normal text-muted-foreground">({u?.daieId ?? "—"})</span></span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant={a.method === "qr" ? "success" : a.method === "manual" ? "outline" : "accent"}>{METHOD_LABELS[a.method]}</Badge>
                    {formatDate(a.markedAt)}
                  </span>
                </div>
              );
            })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
