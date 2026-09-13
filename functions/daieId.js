// Sequential Daie ID allocation, e.g. KDE-0001, DPM-0002, DM-0003.
// Same running-counter-in-a-transaction pattern as beana-home-quran's
// functions/index.js (nextLoginId/nextSeq), keyed per rank so each rank has
// its own 4-digit sequence.

import { getFirestore } from 'firebase-admin/firestore';

const RANK_COUNTER_FIELD = {
  KDE: 'kdeSeq',
  DPM: 'dpmSeq',
  DM: 'dmSeq',
};

export async function nextDaieId(rank) {
  const db = getFirestore();
  const counterField = RANK_COUNTER_FIELD[rank];
  if (!counterField) throw new Error(`Unknown rank: ${rank}`);

  const counterRef = db.collection('meta').doc('daieCounters');
  const seq = await db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const next = (snap.data()?.[counterField] ?? 0) + 1;
    tx.set(counterRef, { [counterField]: next }, { merge: true });
    return next;
  });

  return `${rank}-${String(seq).padStart(4, '0')}`;
}
