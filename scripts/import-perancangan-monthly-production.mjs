// Replaces the earlier lump-sum Perancangan import (one doc per daie,
// their whole-year total dated "today") with proper month-by-month
// records (see parse_konvensyen_monthly_v2.py -> konvensyen_monthly_by_month.json).
//
// The lump-sum approach broke two things: Reports' month filter had nothing
// to filter (every record sat in whichever month the import happened to
// run), and that same month showed an inflated total (a whole year of
// production compressed into one month) while every other month showed
// nothing.
//
// Deletes every doc tagged source == SOURCE_TAG first (this pipeline is the
// only writer of that tag), then writes one doc per (daie, month) with a
// date inside that actual month.
//
// Usage:
//   node scripts/import-perancangan-monthly-production.mjs <path to service-account.json>

import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";

const keyPath = process.argv[2];
if (!keyPath) {
  console.error("Usage: node scripts/import-perancangan-monthly-production.mjs <path to service-account.json>");
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
const records = JSON.parse(readFileSync("scripts/konvensyen_monthly_by_month.json", "utf8"));
console.log(`Loaded ${records.length} (daie, month) records.`);

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

const usersSnap = await db.collection("users").get();
const uidByDaieId = new Map();
usersSnap.forEach((doc) => {
  const daieId = doc.data().daieId;
  if (daieId) uidByDaieId.set(String(daieId), doc.id);
});
console.log(`Production has ${uidByDaieId.size} promoted accounts with a daieId to match against.`);

const BATCH_SIZE = 450;
let written = 0;
const skippedNotPromoted = new Map(); // daieId -> { name, unit, total }

const toWrite = records.filter((r) => {
  if (r.amount <= 0) return false;
  const uid = uidByDaieId.get(String(r.daieId));
  if (!uid) {
    const prev = skippedNotPromoted.get(r.daieId) ?? { name: r.name, unit: r.unit, total: 0 };
    prev.total += r.amount;
    skippedNotPromoted.set(r.daieId, prev);
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
      amount: r.amount,
      count: null,
      date: Timestamp.fromDate(new Date(`${r.monthKey}-15T00:00:00.000Z`)),
      createdAt: FieldValue.serverTimestamp(),
      source: SOURCE_TAG,
      sourceDaieId: String(r.daieId),
      sourceMonth: r.monthKey,
    });
    written++;
  }
  await batch.commit();
  console.log(`  ${Math.min(i + BATCH_SIZE, toWrite.length)}/${toWrite.length}`);
}

console.log(`\nDone. ${written} monthly sales records written (${new Set(toWrite.map((r) => r.daieId)).size} unique daie).`);
if (skippedNotPromoted.size) {
  const rows = [...skippedNotPromoted.entries()].map(([daieId, v]) => ({ daieId, ...v }));
  console.log(`\nSkipped — daie not yet promoted to a real account (${rows.length} people, ${rows.reduce((s, r) => s + r.total, 0).toFixed(2)} total RM across all their months):`);
  console.table(rows.slice(0, 20));
  if (rows.length > 20) console.log(`...and ${rows.length - 20} more.`);
}
