"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Download, ExternalLink, FileText, Pencil, PlayCircle, Share2, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PaginationFooter } from "@/components/ui/pagination-footer";
import { MARKETING_CATEGORY_LABELS, MARKETING_KIND_LABELS } from "@/lib/constants";
import { MARKETING_CATEGORIES, type MarketingCategory, type MarketingEntry, type MarketingKind } from "@/lib/types";
import { VIDEO_PLATFORM_LABELS, videoPlatform, youtubeId } from "@/lib/marketing";
import { cn, formatDate } from "@/lib/utils";

const PAGE_SIZE = 12;
const KIND_FILTERS: Array<{ id: MarketingKind | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "poster", label: "Posters" },
  { id: "video", label: "Videos" },
  { id: "pdf", label: "PDFs" },
];

/** The text that goes with a share: the caption, plus the link for videos. */
function shareText(item: MarketingEntry): string {
  return [item.caption ?? item.title, item.kind === "video" ? item.videoUrl : null].filter(Boolean).join("\n\n");
}

async function fileFor(item: MarketingEntry): Promise<File> {
  const res = await fetch(item.fileUrl!);
  if (!res.ok) throw new Error(`download failed (${res.status})`);
  const blob = await res.blob();
  const ext = blob.type === "application/pdf" ? "pdf" : (blob.type.split("/")[1] ?? "jpg");
  const name = item.fileName ?? `${item.title.replace(/[^\w-]+/g, "-").slice(0, 60) || "kausar"}.${ext}`;
  return new File([blob], name, { type: blob.type });
}

/**
 * Phones: posters and PDFs go out as the actual file (with the caption) via
 * the share sheet — WhatsApp included. Anywhere that can't share files gets
 * WhatsApp with the caption and the link instead.
 */
async function share(item: MarketingEntry) {
  if (item.fileUrl && typeof navigator.canShare === "function") {
    try {
      const file = await fileFor(item);
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: shareText(item) });
        return;
      }
    } catch (err) {
      if ((err as { name?: string }).name === "AbortError") return; // closed the share sheet
    }
  }
  const text = item.fileUrl ? `${shareText(item)}\n\n${item.fileUrl}` : shareText(item);
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
}

async function download(item: MarketingEntry) {
  try {
    const file = await fileFor(item);
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  } catch {
    window.open(item.fileUrl!, "_blank", "noopener");
  }
}

function Preview({ item, large = false }: { item: MarketingEntry; large?: boolean }) {
  if (item.kind === "poster" && item.fileUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- Storage download URLs; next/image optimizer isn't configured for them
    return <img src={item.fileUrl} alt={large ? item.title : ""} className={cn("w-full bg-muted object-contain", large ? "max-h-[70vh]" : "aspect-square")} />;
  }
  if (item.kind === "video" && item.videoUrl) {
    const id = youtubeId(item.videoUrl);
    if (id && large) {
      return (
        <div className="aspect-video w-full">
          <iframe
            className="h-full w-full rounded-md"
            src={`https://www.youtube-nocookie.com/embed/${id}`}
            title={item.title}
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }
    return (
      <div className={cn("relative flex w-full items-center justify-center overflow-hidden bg-ink", large ? "aspect-video rounded-md" : "aspect-square")}>
        {id && (
          // eslint-disable-next-line @next/next/no-img-element -- YouTube's public thumbnail
          <img src={`https://img.youtube.com/vi/${id}/hqdefault.jpg`} alt="" className="absolute inset-0 h-full w-full object-cover opacity-80" />
        )}
        <div className="relative flex flex-col items-center gap-1 text-white">
          <PlayCircle className="h-12 w-12" />
          <span className="text-xs font-semibold">{VIDEO_PLATFORM_LABELS[videoPlatform(item.videoUrl)]}</span>
        </div>
      </div>
    );
  }
  return (
    <div className={cn("flex w-full flex-col items-center justify-center gap-2 bg-muted text-primary", large ? "rounded-md py-10" : "aspect-square")}>
      <FileText className="h-12 w-12" />
      <span className="max-w-[90%] truncate text-xs font-semibold">{item.fileName ?? "PDF"}</span>
    </div>
  );
}

function ActionButtons({ item, onCopied }: { item: MarketingEntry; onCopied: (what: string) => void }) {
  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      onCopied(what);
    } catch {
      onCopied("Couldn't copy. Select the text instead.");
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => share(item)}>
        <Share2 className="mr-1.5 h-4 w-4" /> Share
      </Button>
      {item.fileUrl ? (
        <Button size="sm" variant="outline" onClick={() => download(item)}>
          <Download className="mr-1.5 h-4 w-4" /> Download
        </Button>
      ) : (
        <Button size="sm" variant="outline" asChild>
          <a href={item.videoUrl!} target="_blank" rel="noreferrer">
            <ExternalLink className="mr-1.5 h-4 w-4" /> Open video
          </a>
        </Button>
      )}
      {item.caption && (
        <Button size="sm" variant="outline" onClick={() => copy(item.caption!, "Caption copied")}>
          <Copy className="mr-1.5 h-4 w-4" /> Copy caption
        </Button>
      )}
      {item.videoUrl && (
        <Button size="sm" variant="ghost" onClick={() => copy(item.videoUrl!, "Link copied")}>
          <Copy className="mr-1.5 h-4 w-4" /> Copy link
        </Button>
      )}
    </div>
  );
}

export function MarketingKit({ items, canManage }: { items: MarketingEntry[]; canManage: boolean }) {
  const router = useRouter();
  const [category, setCategory] = useState<MarketingCategory | "all">("all");
  const [kind, setKind] = useState<MarketingKind | "all">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (i) =>
        (category === "all" || i.category === category) &&
        (kind === "all" || i.kind === kind) &&
        (!q || i.title.toLowerCase().includes(q) || (i.caption ?? "").toLowerCase().includes(q)),
    );
  }, [items, category, kind, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageItems = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const open = openId ? (items.find((i) => i.id === openId) ?? null) : null;

  function flash(text: string) {
    setNotice(text);
    setTimeout(() => setNotice(""), 2500);
  }

  async function handleDelete(item: MarketingEntry) {
    setDeleting(true);
    const res = await fetch(`/api/marketing/${item.id}`, { method: "DELETE" });
    const json = (await res.json().catch(() => ({}))) as { error?: string };
    setDeleting(false);
    if (!res.ok) return flash(json.error ?? `Could not delete (error ${res.status}).`);
    setOpenId(null);
    setConfirming(false);
    router.refresh();
  }

  const chip = (active: boolean) =>
    cn("rounded-full border px-3 py-1 text-sm font-medium transition-colors", active ? "border-primary bg-primary text-white" : "border-border bg-white text-ink hover:bg-muted");

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Category">
          <button type="button" className={chip(category === "all")} onClick={() => { setCategory("all"); setPage(1); }}>All</button>
          {MARKETING_CATEGORIES.map((c) => (
            <button key={c} type="button" className={chip(category === c)} onClick={() => { setCategory(c); setPage(1); }}>
              {MARKETING_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Type" className="flex gap-1 rounded-lg bg-muted p-1">
            {KIND_FILTERS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => { setKind(k.id); setPage(1); }}
                className={cn("rounded-md px-3 py-1 text-sm font-semibold", kind === k.id ? "bg-white text-ink shadow-sm" : "text-muted-foreground hover:text-ink")}
              >
                {k.label}
              </button>
            ))}
          </div>
          <Input id="marketing-search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search title or caption" aria-label="Search title or caption" className="h-9 w-full sm:w-64" />
          <span className="text-sm text-muted-foreground">{filtered.length} item{filtered.length === 1 ? "" : "s"}</span>
        </div>
      </div>

      {notice && <p className="rounded-md bg-success/10 px-3 py-2 text-sm font-medium text-success">{notice}</p>}

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {items.length === 0 ? "No marketing materials yet." : "Nothing matches these filters."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {pageItems.map((item) => (
            <Card key={item.id} className="flex flex-col overflow-hidden">
              <button type="button" onClick={() => setOpenId(item.id)} className="block text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Open ${item.title}`}>
                <Preview item={item} />
              </button>
              <CardContent className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">{MARKETING_CATEGORY_LABELS[item.category]}</Badge>
                  <Badge variant="muted">{MARKETING_KIND_LABELS[item.kind]}</Badge>
                </div>
                <button type="button" onClick={() => setOpenId(item.id)} className="text-left font-semibold text-ink hover:text-primary">
                  {item.title}
                </button>
                {item.caption && <p className="line-clamp-2 whitespace-pre-line text-sm text-muted-foreground">{item.caption}</p>}
                <div className="mt-auto">
                  <ActionButtons item={item} onCopied={flash} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <PaginationFooter page={current} totalPages={totalPages} onPageChange={setPage} />

      <Dialog open={!!open} onOpenChange={(o) => { if (!o) { setOpenId(null); setConfirming(false); } }}>
        {open && (
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{open.title}</DialogTitle>
              <DialogDescription>
                {MARKETING_CATEGORY_LABELS[open.category]} · {MARKETING_KIND_LABELS[open.kind]} · added {formatDate(open.createdAt)}
              </DialogDescription>
            </DialogHeader>
            <Preview item={open} large />
            {open.caption && <p className="whitespace-pre-line rounded-md bg-muted p-3 text-sm text-foreground/90">{open.caption}</p>}
            <ActionButtons item={open} onCopied={flash} />
            {notice && <p className="text-sm font-medium text-success">{notice}</p>}
            {canManage && (
              <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/marketing/${open.id}/edit`}><Pencil className="mr-1.5 h-4 w-4" /> Edit</Link>
                </Button>
                {!confirming ? (
                  <Button variant="outline" size="sm" className="text-red-700" onClick={() => setConfirming(true)}>
                    <Trash2 className="mr-1.5 h-4 w-4" /> Delete
                  </Button>
                ) : (
                  <>
                    <span className="text-sm text-ink">Delete this for everyone? This can&rsquo;t be undone.</span>
                    <Button variant="destructive" size="sm" disabled={deleting} onClick={() => handleDelete(open)}>
                      {deleting ? "Deleting…" : "Yes, delete"}
                    </Button>
                    <Button variant="ghost" size="sm" disabled={deleting} onClick={() => setConfirming(false)}>Cancel</Button>
                  </>
                )}
              </div>
            )}
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
