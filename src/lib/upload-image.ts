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
