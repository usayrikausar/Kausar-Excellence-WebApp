"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Maximize2, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type { BulletinEntry } from "@/lib/types";

/**
 * Bulletin card: the image shown whole (not cropped), a short preview of the
 * text, and a PDF chip when a memo is attached. Tapping opens the full post —
 * full text, full-size image (tap again to open it on its own), the PDF —
 * and, for Group Admins, Delete.
 */
export function BulletinCard({ bulletin, canDelete = false }: { bulletin: BulletinEntry; canDelete?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/bulletins/${bulletin.id}`, { method: "DELETE" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `Could not delete (error ${res.status}).`);
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete.");
      setDeleting(false);
    }
  }

  return (
    <>
      <Card
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="cursor-pointer overflow-hidden transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {bulletin.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- Storage download URLs; next/image optimizer isn't configured for them
          <img src={bulletin.imageUrl} alt="" className="max-h-80 w-full bg-muted object-contain" />
        )}
        <CardHeader>
          <CardTitle className="text-base">{bulletin.title}</CardTitle>
          <p className="text-xs text-muted-foreground">{formatDate(bulletin.publishAt)}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="line-clamp-3 whitespace-pre-line text-sm text-foreground/80">{bulletin.body}</p>
          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-primary">
            {bulletin.attachmentUrl && (
              <span className="inline-flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" /> {bulletin.attachmentName ?? "PDF attached"}
              </span>
            )}
            <span>Read more</span>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setConfirming(false);
            setError("");
          }
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{bulletin.title}</DialogTitle>
            <DialogDescription>{formatDate(bulletin.publishAt)}</DialogDescription>
          </DialogHeader>

          {bulletin.imageUrl && (
            <a href={bulletin.imageUrl} target="_blank" rel="noreferrer" className="group relative block" title="Open the image full size">
              {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
              <img src={bulletin.imageUrl} alt={bulletin.title} className="w-full rounded-md bg-muted object-contain" />
              <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-md bg-ink/70 px-2 py-1 text-xs font-medium text-white">
                <Maximize2 className="h-3.5 w-3.5" /> Full size
              </span>
            </a>
          )}

          <p className="whitespace-pre-line text-sm text-foreground/90">{bulletin.body}</p>

          {bulletin.attachmentUrl && (
            <a
              href={bulletin.attachmentUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-fit items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold text-primary hover:bg-muted"
            >
              <FileText className="h-4 w-4" /> Open PDF{bulletin.attachmentName ? ` — ${bulletin.attachmentName}` : ""}
            </a>
          )}

          {canDelete && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              {!confirming ? (
                <Button variant="outline" size="sm" onClick={() => setConfirming(true)} className="text-red-700">
                  <Trash2 className="mr-1.5 h-4 w-4" /> Delete post
                </Button>
              ) : (
                <>
                  <span className="text-sm text-ink">Delete this post for everyone? This can&rsquo;t be undone.</span>
                  <Button variant="destructive" size="sm" disabled={deleting} onClick={handleDelete}>
                    {deleting ? "Deleting…" : "Yes, delete"}
                  </Button>
                  <Button variant="ghost" size="sm" disabled={deleting} onClick={() => setConfirming(false)}>
                    Cancel
                  </Button>
                </>
              )}
              {error && <span className="text-sm font-medium text-red-600">{error}</span>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
