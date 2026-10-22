/** Largest image /api/upload accepts — keep in step with MAX_BYTES there. */
export const MAX_IMAGE_MB = 15;

/** A reminder line for under an image field, or a size warning once a too-big file is picked. */
export function imageSizeNote(file: File | null): { text: string; tooBig: boolean } {
  if (file && file.size > MAX_IMAGE_MB * 1024 * 1024) {
    return { text: `This image is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_IMAGE_MB} MB. Choose a smaller one.`, tooBig: true };
  }
  return { text: `JPG or PNG, up to ${MAX_IMAGE_MB} MB.`, tooBig: false };
}

/**
 * Uploads an image through /api/upload (see that route for why it isn't a
 * direct browser-to-Storage upload) and returns its download URL. Throws an
 * Error whose message is safe to show the user.
 */
export async function uploadImage(folder: "bulletins" | "contests", file: File): Promise<string> {
  const body = new FormData();
  body.set("folder", folder);
  body.set("file", file);
  let res: Response;
  try {
    res = await fetch("/api/upload", { method: "POST", body });
  } catch {
    throw new Error("No connection — check your internet and try again.");
  }
  const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !json.url) throw new Error(json.error ?? `Image upload failed (error ${res.status}).`);
  return json.url;
}
