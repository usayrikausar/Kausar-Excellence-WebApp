import { MARKETING_CATEGORIES, MARKETING_KINDS, type MarketingCategory, type MarketingKind } from "@/lib/types";

/** Where a video link points — drives the card's label and whether it can play inside the app. */
export type VideoPlatform = "youtube" | "tiktok" | "instagram" | "facebook" | "drive" | "other";

export const VIDEO_PLATFORM_LABELS: Record<VideoPlatform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  drive: "Google Drive",
  other: "Video link",
};

export function videoPlatform(url: string): VideoPlatform {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\.|^m\./, "");
  } catch {
    return "other";
  }
  if (host === "youtube.com" || host === "youtu.be" || host.endsWith(".youtube.com")) return "youtube";
  if (host.endsWith("tiktok.com")) return "tiktok";
  if (host.endsWith("instagram.com")) return "instagram";
  if (host.endsWith("facebook.com") || host === "fb.watch") return "facebook";
  if (host === "drive.google.com") return "drive";
  return "other";
}

/** The YouTube video id in a watch / short / youtu.be / shorts link, if any. */
export function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (host.endsWith("youtube.com")) {
      if (u.searchParams.get("v")) return u.searchParams.get("v");
      const m = u.pathname.match(/^\/(?:shorts|embed|live)\/([^/?]+)/);
      return m ? m[1] : null;
    }
  } catch {
    // not a URL
  }
  return null;
}

export interface MarketingInput {
  title: string;
  category: MarketingCategory;
  kind: MarketingKind;
  caption: string | null;
  fileUrl: string | null;
  fileName: string | null;
  videoUrl: string | null;
}

/** Validates a create/edit request body; returns the clean fields or a message for the user. */
export function parseMarketingInput(body: unknown): { ok: true; value: MarketingInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
  const title = str(b.title, 150);
  const category = b.category as MarketingCategory;
  const kind = b.kind as MarketingKind;
  const caption = str(b.caption, 3000) || null;
  if (!title) return { ok: false, error: "Give it a title." };
  if (!MARKETING_CATEGORIES.includes(category)) return { ok: false, error: "Choose a category." };
  if (!MARKETING_KINDS.includes(kind)) return { ok: false, error: "Choose what kind of material this is." };

  if (kind === "video") {
    const videoUrl = str(b.videoUrl, 1000);
    if (!/^https?:\/\/\S+$/i.test(videoUrl)) return { ok: false, error: "Paste the full video link, starting with https://" };
    return { ok: true, value: { title, category, kind, caption, fileUrl: null, fileName: null, videoUrl } };
  }
  const fileUrl = str(b.fileUrl, 2000);
  // Only files uploaded through /api/upload (our Storage bucket's download links).
  if (!fileUrl.startsWith("https://firebasestorage.googleapis.com/")) return { ok: false, error: kind === "pdf" ? "Attach the PDF." : "Attach the poster image." };
  return { ok: true, value: { title, category, kind, caption, fileUrl, fileName: str(b.fileName, 200) || null, videoUrl: null } };
}
