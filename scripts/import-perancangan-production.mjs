// Production counterpart to import-perancangan.mjs. The source file
// (matched_perancangan.json) carries a `uid` field resolved against the
// LOCAL EMULATOR's promoted accounts during an earlier matching pass — those
// UIDs don't exist in the real project (Firebase Auth UIDs aren't
// deterministic across projects, even for the same person/email). This
// re-resolves each record by the stable `daieId` field against production's
// own `users` collection instead, and only writes a sales doc for someone
// who has actually been promoted there (see promote-roster-production.mjs) —
// anyone not yet promoted is skipped and reported, not guessed at.
//
// Usage:
//   node scripts/import-perancangan-production.mjs <path to service-account.json> <matched_perancangan.json>

import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";

const keyPath = process.argv[2];
const inputPath = process.argv[3];
if (!keyPath || !inputPath) {
  console.error("Usage: node scripts/import-perancangan-production.mjs <path to service-account.json> <matched_perancangan.json>");
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
if (serviceAccount.project_id !== "kausar-excellence-web-app") {
  console.error(`Refusing to run: key belongs to project "${serviceAccount.project_id}", expected "kausar-excellence-web-app".`);
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
const db = getFirestore();

const records = JSON.parse(readFileSync(inputPath, "utf8"));
console.log(`Loaded ${records.length} Perancangan totals from ${inputPath}.`);

const usersSnap = await db.collection("users").get();
const uidByDaieId = new Map();
usersSnap.forEach((doc) => {
  const daieId = doc.data().daieId;
  if (daieId) uidByDaieId.set(String(daieId), doc.id);
});
console.log(`Production has ${uidByDaieId.size} promoted accounts with a daieId to match against.`);

// Guard against double-importing if this is re-run after a partial failure —
// this collection is only ever written by this script (tagged `source`
// below), so any doc with a matching source + daieId means "already done".
const existingSnap = await db.collection("sales").where("source", "==", "konvensyen-monthly-import").get();
const alreadyImportedDaieIds = new Set(existingSnap.docs.map((d) => d.data().sourceDaieId).filter(Boolean));
if (alreadyImportedDaieIds.size) console.log(`${alreadyImportedDaieIds.size} already imported in a prior run — skipping those.`);

const today = Timestamp.now();
const BATCH_SIZE = 450;
let written = 0;
const skippedNotPromoted = [];

const toWrite = records.filter((r) => {
  if (r.total <= 0) return false;
  if (alreadyImportedDaieIds.has(String(r.daieId))) return false;
  const uid = uidByDaieId.get(String(r.daieId));
  if (!uid) {
    skippedNotPromoted.push(r);
    return false;
  }
  return true;
});

for (let i = 0; i < toWrite.length; i += BATCH_SIZE) {
  const chunk = toWrite.slice(i, i + BATCH_SIZE);
  const batch = db.batch();
  for (const r of chunk) {
    const uid = uidByDaieId.get(String(r.daieId));
    const ref = db.collection("sales").doc();
    batch.set(ref, {
      uid,
      category: "perancangan",
      subCategory: null,
      amount: r.total,
      count: null,
      date: today,
      createdAt: FieldValue.serverTimestamp(),
      source: "konvensyen-monthly-import",
      sourceDaieId: String(r.daieId), // lets a re-run detect "already imported" without relying on uid
    });
    written++;
  }
  await batch.commit();
  console.log(`  ${Math.min(i + BATCH_SIZE, toWrite.length)}/${toWrite.length}`);
}

console.log(`\nDone. ${written} sales records written.`);
if (skippedNotPromoted.length) {
  console.log(`\nSkipped — daie not yet promoted to a real account (${skippedNotPromoted.length}):`);
  console.table(skippedNotPromoted.slice(0, 20).map((r) => ({ daieId: r.daieId, name: r.name, unitId: r.unitId, total: r.total })));
  if (skippedNotPromoted.length > 20) console.log(`...and ${skippedNotPromoted.length - 20} more.`);
}
