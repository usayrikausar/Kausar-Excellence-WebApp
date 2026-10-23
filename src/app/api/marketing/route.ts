import { FieldValue } from "firebase-admin/firestore";
import { getCurrentUser } from "@/lib/auth/session";
import { adminDb } from "@/lib/firebase/admin";
import { parseMarketingInput } from "@/lib/marketing";

// Adds a Marketing Kit item. Group Admins only (agreed 2026-10-23); files
// are uploaded first through /api/upload (folder "marketing").
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  if (!user.isGroupAdmin) return Response.json({ error: "Only a Group Admin can add marketing materials." }, { status: 403 });

  const parsed = parseMarketingInput(await request.json().catch(() => null));
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const ref = await adminDb.collection("marketing").add({ ...parsed.value, createdBy: user.uid, createdAt: FieldValue.serverTimestamp() });
  return Response.json({ id: ref.id });
}
