import { randomUUID } from "node:crypto";
import { getCurrentUser } from "@/lib/auth/session";
import { adminBucket } from "@/lib/firebase/admin";

// Image uploads (bulletin images, contest posters) go through the server
// rather than straight from the browser to Firebase Storage: the browser
// upload depended on the phone's own Firebase login reaching Storage, and
// failed silently on the live site ("Could not publish") with nothing ever
// saved. Here the signed-in session is checked once on the server and the
// file is written with the Admin SDK.
//
// Group Admins only — the same people firestore.rules / storage.rules let
// write bulletins and contests.

const FOLDERS = new Set(["bulletins", "contests"]);
const MAX_BYTES = 15 * 1024 * 1024; // keep in step with MAX_IMAGE_MB in lib/upload-image.ts

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Your session has expired. Sign in again." }, { status: 401 });
  if (!user.isGroupAdmin) return Response.json({ error: "Only a Group Admin can upload images." }, { status: 403 });

  const form = await request.formData();
  const folder = String(form.get("folder") ?? "");
  const file = form.get("file");
  if (!FOLDERS.has(folder)) return Response.json({ error: "Unknown upload folder." }, { status: 400 });
  if (!(file instanceof File) || file.size === 0) return Response.json({ error: "No image was attached." }, { status: 400 });
  if (!file.type.startsWith("image/")) return Response.json({ error: "Only image files can be uploaded." }, { status: 400 });
  if (file.size > MAX_BYTES) return Response.json({ error: "The image is larger than 15 MB. Choose a smaller one." }, { status: 413 });

  const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, "_").slice(-80) || "image";
  const path = `${folder}/${Date.now()}-${safeName}`;
  // Same kind of link the client SDK's getDownloadURL() returns: readable by
  // anyone holding it, nobody can list the bucket.
  const token = randomUUID();
  try {
    await adminBucket.file(path).save(Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
      metadata: { metadata: { firebaseStorageDownloadTokens: token, uploadedBy: user.uid } },
      resumable: false,
    });
  } catch (err) {
    console.error("upload failed", err);
    return Response.json({ error: "The image couldn't be saved. Try again in a moment." }, { status: 500 });
  }

  const url = `https://firebasestorage.googleapis.com/v0/b/${adminBucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
  return Response.json({ url });
}
