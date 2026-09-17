// Replaces the earlier (incomplete) Perancangan import with the corrected,
// more complete dataset parsed from the 5-tab "KONVENSYEN MONTHLY" sheet
// (see parse-konvensyen-monthly.mjs -> konvensyen_monthly_perancangan.json).
// The original import (82 records, from matched_perancangan.json) is
// deleted first -- it's fully superseded, and every doc from that batch is
// uniquely identifiable via its `source` tag, so this only ever touches
// records this pipeline itself wrote.
//
// Usage:
//   node scripts/reimport-perancangan-production.mjs <path to service-account.json>

import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";

const keyPath = process.argv[2];
if (!keyPath) {
  console.error("Usage: node scripts/reimport-perancangan-production.mjs <path to service-account.json>");
  process.exit(1);
}
const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
if (serviceAccount.project_id !== "kausar-excellence-web-app") {
  console.error(`Refusing to run: key belongs to project "${serviceAccount.project_id}", expected "kausar-excellence-web-app".`);
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
const db = getFirestore();

const SOURCE_TAG = "konvensyen-monthly-import";
const records = JSON.parse(readFileSync("scripts/konvensyen_monthly_perancangan.json", "utf8"));
console.log(`Loaded ${records.length} corrected Perancangan totals.`);

// 1) Delete the previous batch from this same source tag.
const existingSnap = await db.collection("sales").where("source", "==", SOURCE_TAG).get();
console.log(`Deleting ${existingSnap.size} previously-imported docs tagged "${SOURCE_TAG}"...`);
const DELETE_BATCH = 450;
const existingDocs = existingSnap.docs;
for (let i = 0; i < existingDocs.length; i += DELETE_BATCH) {
  const batch = db.batch();
  for (const doc of existingDocs.slice(i, i + DELETE_BATCH)) batch.delete(doc.ref);
  await batch.commit();
}
console.log("Deleted.");

// 2) Re-resolve each record's uid via production's users collection.
const usersSnap = await db.collection("users").get();
const uidByDaieId = new Map();
usersSnap.forEach((doc) => {
  const daieId = doc.data().daieId;
  if (daieId) uidByDaieId.set(String(daieId), doc.id);
});
console.log(`Production has ${uidByDaieId.size} promoted accounts with a daieId to match against.`);

const today = Timestamp.now();
const BATCH_SIZE = 450;
let written = 0;
const skippedNotPromoted = [];

const toWrite = records.filter((r) => {
  if (r.total <= 0) return false;
  const uid = uidByDaieId.get(String(r.daieId));
  if (!uid) { skippedNotPromoted.push(r); return false; }
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
      source: SOURCE_TAG,
      sourceDaieId: String(r.daieId),
    });
    written++;
  }
  await batch.commit();
  console.log(`  ${Math.min(i + BATCH_SIZE, toWrite.length)}/${toWrite.length}`);
}

console.log(`\nDone. ${written} sales records written (corrected dataset).`);
if (skippedNotPromoted.length) {
  console.log(`\nSkipped — daie not yet promoted to a real account (${skippedNotPromoted.length}):`);
  console.table(skippedNotPromoted.slice(0, 20).map((r) => ({ daieId: r.daieId, name: r.name, unit: r.unit, total: r.total })));
  if (skippedNotPromoted.length > 20) console.log(`...and ${skippedNotPromoted.length - 20} more.`);
}
