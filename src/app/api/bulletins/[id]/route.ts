import { getCurrentUser } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { deleteStorageFiles } from "@/lib/storage-path";

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
  await deleteStorageFiles([data.imageUrl, data.attachmentUrl]);
  await ref.delete();
  return Response.json({ ok: true });
}
