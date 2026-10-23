"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadImage, imageSizeNote } from "@/lib/upload-image";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MARKETING_CATEGORY_LABELS, MARKETING_KIND_LABELS } from "@/lib/constants";
import { MARKETING_CATEGORIES, MARKETING_KINDS, type MarketingCategory, type MarketingEntry, type MarketingKind } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Add a Marketing Kit item, or edit one (`existing`). Posters/PDFs upload through /api/upload first. */
export function MarketingForm({ existing }: { existing?: MarketingEntry }) {
  const router = useRouter();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [category, setCategory] = useState<MarketingCategory>(existing?.category ?? "awareness");
  const [kind, setKind] = useState<MarketingKind>(existing?.kind ?? "poster");
  const [caption, setCaption] = useState(existing?.caption ?? "");
  const [videoUrl, setVideoUrl] = useState(existing?.videoUrl ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fileKind = kind === "pdf" ? "pdf" : "image";
  const note = imageSizeNote(file, fileKind);
  // Editing keeps the current file unless a new one is chosen (and the type didn't change).
  const keepsFile = !!existing?.fileUrl && existing.kind === kind && !file;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      let fileUrl: string | null = null;
      let fileName: string | null = null;
      if (kind !== "video") {
        if (file) {
          fileUrl = await uploadImage("marketing", file);
          fileName = file.name;
        } else if (keepsFile) {
          fileUrl = existing!.fileUrl;
          fileName = existing!.fileName;
        } else {
          throw new Error(kind === "pdf" ? "Attach the PDF." : "Attach the poster image.");
        }
      }
      const res = await fetch(existing ? `/api/marketing/${existing.id}` : "/api/marketing", {
        method: existing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, category, kind, caption, videoUrl: kind === "video" ? videoUrl : null, fileUrl, fileName }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `Could not save (error ${res.status}).`);
      router.push("/marketing");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Please try again.");
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{existing ? "Edit marketing material" : "Add marketing material"}</CardTitle>
        <CardDescription>Every daie can see, download and share it once saved.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>What is it?</Label>
            <div role="radiogroup" aria-label="Type" className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
              {MARKETING_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={kind === k}
                  onClick={() => { setKind(k); setFile(null); }}
                  className={cn("rounded-md px-3 py-1.5 text-sm font-semibold", kind === k ? "bg-white text-ink shadow-sm" : "text-muted-foreground hover:text-ink")}
                >
                  {MARKETING_KIND_LABELS[k]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="marketing-title">Title</Label>
            <Input id="marketing-title" required maxLength={150} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Kenapa Wasiat Penting" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="marketing-category">Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as MarketingCategory)}>
              <SelectTrigger id="marketing-category"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MARKETING_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{MARKETING_CATEGORY_LABELS[c]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {kind === "video" ? (
            <div className="space-y-2">
              <Label htmlFor="marketing-video">Video link</Label>
              <Input id="marketing-video" type="url" required value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=… or a TikTok / Instagram / Facebook / Drive link" />
              <p className="text-xs text-muted-foreground">YouTube links play inside the app; other links open the video&rsquo;s own page.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="marketing-file">{kind === "pdf" ? "PDF file" : "Poster / image"}</Label>
              <Input id="marketing-file" type="file" accept={kind === "pdf" ? "application/pdf" : "image/*"} onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-describedby="marketing-file-note" />
              <p id="marketing-file-note" className={note.tooBig ? "text-xs font-medium text-red-600" : "text-xs text-muted-foreground"}>
                {keepsFile && !note.tooBig ? `Current file: ${existing!.fileName ?? "attached"}. Choose a new one to replace it. ` : ""}
                {note.text}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="marketing-caption">Caption to share (optional)</Label>
            <textarea
              id="marketing-caption"
              rows={5}
              maxLength={3000}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="The text daie can copy into WhatsApp, TikTok or Facebook with this material."
              className="flex w-full rounded-md border border-border bg-white px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {error && <p className="text-sm font-medium text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={saving || note.tooBig}>{saving ? "Saving…" : existing ? "Save changes" : "Add to Marketing Kit"}</Button>
            <Button type="button" variant="ghost" disabled={saving} onClick={() => router.push("/marketing")}>Cancel</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
