"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function BulletinForm({ createdBy }: { createdBy: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);
    try {
      let imageUrl: string | null = null;
      if (image) {
        const storageRef = ref(storage, `bulletins/${Date.now()}-${image.name}`);
        await uploadBytes(storageRef, image);
        imageUrl = await getDownloadURL(storageRef);
      }

      await addDoc(collection(db, "bulletins"), {
        title,
        body,
        imageUrl,
        publishAt: serverTimestamp(),
        createdBy,
      });

      router.push("/bulletin");
      router.refresh();
    } catch {
      setStatus("error");
      setError("Could not publish. Please try again.");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New bulletin post</CardTitle>
        <CardDescription>Visible to every signed-in daie once published.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bulletin-title">Title</Label>
            <Input id="bulletin-title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bulletin-body">Body</Label>
            <textarea
              id="bulletin-body"
              required
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="flex w-full rounded-md border border-border bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bulletin-image">Image (optional)</Label>
            <Input
              id="bulletin-image"
              type="file"
              accept="image/*"
              onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            />
          </div>
          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <Button type="submit" disabled={status === "saving"}>
            {status === "saving" ? "Publishing…" : "Publish"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
