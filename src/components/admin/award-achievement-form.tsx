"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CurrentUser } from "@/lib/types";

export function AwardAchievementForm({ users, awardedBy }: { users: CurrentUser[]; awardedBy: string }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [uid, setUid] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [dateAwarded, setDateAwarded] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users.slice(0, 50);
    return users
      .filter((u) => u.name.toLowerCase().includes(q) || (u.daieId ?? "").toLowerCase().includes(q))
      .slice(0, 50);
  }, [users, search]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!uid) return;
    setStatus("saving");
    try {
      await addDoc(collection(db, "achievements"), {
        uid,
        title,
        category,
        description,
        dateAwarded,
        awardedBy,
        createdAt: serverTimestamp(),
      });
      setTitle("");
      setCategory("");
      setDescription("");
      router.refresh();
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Award a badge</CardTitle>
        <CardDescription>Shows up on that daie&rsquo;s Wall of Fame.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="achievement-search">Find daie</Label>
            <Input id="achievement-search" placeholder="Search by name or Daie ID" value={search} onChange={(e) => setSearch(e.target.value)} />
            <Select value={uid} onValueChange={setUid}>
              <SelectTrigger><SelectValue placeholder="Select daie" /></SelectTrigger>
              <SelectContent>
                {filteredUsers.map((u) => (
                  <SelectItem key={u.uid} value={u.uid}>{u.name} ({u.daieId})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="achievement-title">Title</Label>
              <Input id="achievement-title" required placeholder="e.g. Top Category — August 2026" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="achievement-category">Category</Label>
              <Input id="achievement-category" required placeholder="e.g. Trip Target, OSAK Pin" value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="achievement-description">Description</Label>
            <Input id="achievement-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="achievement-date">Date awarded</Label>
            <Input id="achievement-date" type="date" required value={dateAwarded} onChange={(e) => setDateAwarded(e.target.value)} className="max-w-xs" />
          </div>

          {status === "error" && <p className="text-sm font-medium text-red-600">Could not award badge. Please try again.</p>}

          <Button type="submit" disabled={status === "saving" || !uid}>
            {status === "saving" ? "Awarding…" : "Award badge"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
