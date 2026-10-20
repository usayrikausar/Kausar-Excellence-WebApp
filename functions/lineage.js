// Keeps users/{uid}.lineagePath AND .unitId correct whenever a user is
// created or their uplineId changes, and cascades both down to every
// existing descendant.
//
// unitId flows down from upline, same as lineagePath: a DM/DPM's unit is
// always their upline's unit (you belong to whoever recruited/leads you), so
// correcting an introducer — e.g. an admin discovers a daie was actually
// brought in under Kausar Aspire, not Kausar Wealth — must also fix that
// daie's own unitId and ripple it through their entire downline, not just
// the lineage chain. A KDE sits at the top of their own unit, so a KDE's
// unitId is always authoritative (set directly by the admin), never derived —
// even when the KDE has an uplineId. That happens with a confirmed
// cross-unit sponsorship: Kausar Intisar's KDE was introduced by a Kausar
// Wealth DPM, so she stays in his lineage (he still sees her as downline),
// but she and her whole team remain Kausar Intisar. Deriving a KDE's unit
// from their upline once silently re-filed that entire unit under Kausar
// Wealth.
//
// Kept deliberately simple over clever (max 3 ranks deep in this org):
// on every write to a user doc, recompute what lineagePath/unitId SHOULD be
// from the upline doc's own lineagePath/unitId. If either differs from what
// is stored, write the correction. Writing it retriggers this same function
// for that doc (harmless — the second pass is a no-op since it's now
// correct), and — crucially — we also push the correction onto every DIRECT
// child (uplineId == uid) as its own write. Each of those child writes
// retriggers this function for the child, which repeats the same "fix mine,
// push to my children" step one level down — so a single introducer
// correction naturally cascades through DPM to DM without any recursive
// helper function or extra query.

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
  let correctUnitId = data.unitId; // KDE: unitId is authoritative, keep as-is.
  if (data.uplineId) {
    const uplineSnap = await db.collection('users').doc(data.uplineId).get();
    if (uplineSnap.exists) {
      const uplineData = uplineSnap.data();
      correctLineage = [...(uplineData.lineagePath ?? []), data.uplineId];
      if (data.rank !== 'KDE') correctUnitId = uplineData.unitId;
    }
  }

  const currentLineage = data.lineagePath ?? [];
  const lineageOk = arraysEqual(currentLineage, correctLineage);
  const unitOk = data.unitId === correctUnitId;
  if (lineageOk && unitOk) {
    return; // already correct — stop here so we don't loop forever
  }

  await db.collection('users').doc(uid).set(
    { lineagePath: correctLineage, unitId: correctUnitId },
    { merge: true },
  );

  // Cascade to direct children — each of their writes retriggers this
  // function, continuing the cascade further down the tree. A KDE child
  // keeps their own unit (see above), so only their lineage is pushed.
  const children = await db.collection('users').where('uplineId', '==', uid).get();
  await Promise.all(
    children.docs.map((childDoc) =>
      db.collection('users').doc(childDoc.id).set(
        childDoc.data().rank === 'KDE'
          ? { lineagePath: [...correctLineage, uid] }
          : { lineagePath: [...correctLineage, uid], unitId: correctUnitId },
        { merge: true },
      ),
    ),
  );
});
