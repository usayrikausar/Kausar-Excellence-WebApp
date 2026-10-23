import { getCurrentUser } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { parseMarketingInput } from "@/lib/marketing";
import { deleteStorageFiles } from "@/lib/storage-path";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  if (!user.isGroupAdmin) return Response.json({ error: "Only a Group Admin can change marketing materials." }, { status: 403 });
  return null;
}

// Edits a Marketing Kit item. A replaced poster/PDF has its old file removed.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const ref = adminDb.collection("marketing").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return Response.json({ error: "This item no longer exists." }, { status: 404 });

  const parsed = parseMarketingInput(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const oldFile = snap.get("fileUrl") as string | null;
  await ref.update({ ...parsed.value });
  if (oldFile && oldFile !== parsed.value.fileUrl) await deleteStorageFiles([oldFile]);
  return Response.json({ ok: true });
}

// Deletes a Marketing Kit item and its uploaded file.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const ref = adminDb.collection("marketing").doc(id);
  const snap = await ref.get();
  if (!snap.exists) return Response.json({ ok: true }); // already gone

  await deleteStorageFiles([snap.get("fileUrl")]);
  await ref.delete();
  return Response.json({ ok: true });
}
