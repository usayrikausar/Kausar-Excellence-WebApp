import "server-only";
import { adminBucket } from "@/lib/firebase/admin";

/** The Storage path inside a Firebase download URL (…/o/<encoded path>?alt=media&token=…), if it points at our bucket. */
export function storagePathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/\/b\/([^/]+)\/o\/([^?]+)/);
  if (!match || match[1] !== adminBucket.name) return null;
  return decodeURIComponent(match[2]);
}

/** Deletes the Storage files behind these download URLs (ignores links that aren't ours or are already gone). */
export async function deleteStorageFiles(urls: Array<string | null | undefined>) {
  for (const path of urls.map(storagePathFromUrl)) {
    if (path) await adminBucket.file(path).delete({ ignoreNotFound: true });
  }
}
