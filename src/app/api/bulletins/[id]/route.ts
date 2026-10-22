import { getCurrentUser } from "@/lib/auth/session";
import { adminBucket, adminDb } from "@/lib/firebase/admin";

/** The Storage path inside a Firebase download URL (…/o/<encoded path>?alt=media&token=…), if it points at our bucket. */
function storagePathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/\/b\/([^/]+)\/o\/([^?]+)/);
  if (!match || match[1] !== adminBucket.name) return null;
  return decodeURIComponent(match[2]);
}

// Deletes a bulletin post and its image / PDF files. Group Admins only —
// done on the server so the files go with the post (the browser can't
// delete Storage files since uploads moved to /api/upload).
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  if (!user.isGroupAdmin) return Response.json({ error: "Only a Group Admin can delete bulletins." }, { status: 403 });

  const { id } = await params;
  const ref = adminDb.collection("bulletins").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return Response.json({ ok: true }); // already gone

  const data = snap.data()!;
  for (const path of [storagePathFromUrl(data.imageUrl), storagePathFromUrl(data.attachmentUrl)]) {
    if (path) await adminBucket.file(path).delete({ ignoreNotFound: true });
  }
  await ref.delete();
  return Response.json({ ok: true });
}
