// Keeps users/{uid}.lineagePath correct whenever a user is created or their
// uplineId changes, and cascades that fix down to every existing descendant.
//
// Kept deliberately simple over clever (max 3 ranks deep in this org):
// on every write to a user doc, recompute what lineagePath SHOULD be from the
// upline doc's own lineagePath + the upline's uid. If that differs from what
// is stored, write it. Writing it retriggers this same function for that doc
// (harmless — the second pass is a no-op since it's now correct), and —
// crucially — we also push the corrected lineagePath onto every DIRECT child
// (uplineId == uid) as its own write. Each of those child writes retriggers
// this function for the child, which repeats the same "fix mine, push to my
// children" step one level down — so a KDE's upline change naturally cascades
// through DPM to DM without any recursive helper function or extra query.

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';

function arraysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

export const recomputeLineageOnWrite = onDocumentWritten('users/{uid}', async (event) => {
  const after = event.data?.after;
  if (!after || !after.exists) return; // deleted — nothing to cascade

  const uid = event.params.uid;
  const data = after.data();
  const db = getFirestore();

  let correctLineage = [];
  if (data.uplineId) {
    const uplineSnap = await db.collection('users').doc(data.uplineId).get();
    if (uplineSnap.exists) {
      const uplineData = uplineSnap.data();
      correctLineage = [...(uplineData.lineagePath ?? []), data.uplineId];
    }
  }
  // KDE (no uplineId) always has an empty lineagePath.

  const currentLineage = data.lineagePath ?? [];
  if (arraysEqual(currentLineage, correctLineage)) {
    return; // already correct — stop here so we don't loop forever
  }

  await db.collection('users').doc(uid).set({ lineagePath: correctLineage }, { merge: true });

  // Cascade to direct children — each of their writes retriggers this
  // function, continuing the cascade further down the tree.
  const children = await db.collection('users').where('uplineId', '==', uid).get();
  await Promise.all(
    children.docs.map((childDoc) =>
      db.collection('users').doc(childDoc.id).set(
        { lineagePath: [...correctLineage, uid] },
        { merge: true },
      ),
    ),
  );
});
