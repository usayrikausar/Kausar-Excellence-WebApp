// One-off import: writes each matched person's Perancangan grand total (from
// the KONVENSYEN MONTHLY sheet, summed across units for anyone appearing
// more than once — see scripts/match-perancangan.mjs) as a single `sales`
// doc per person. This is a lump-sum historical entry (we don't have the
// sheet's per-transaction detail, only monthly subtotals that already roll
// up to a grand total), dated today, category "perancangan".
//
// Usage (emulators must already be running):
//   node scripts/import-perancangan.mjs scripts/matched_perancangan.json

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.GCLOUD_PROJECT ??= "demo-kausar-group";

import { readFileSync } from "node:fs";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node scripts/import-perancangan.mjs <matched_perancangan.json>");
  process.exit(1);
}

initializeApp({ projectId: "demo-kausar-group" });
const db = getFirestore();

const records = JSON.parse(readFileSync(inputPath, "utf8"));
console.log(`Importing ${records.length} Perancangan totals...`);

const today = Timestamp.now();
const BATCH_SIZE = 450;
let written = 0;

for (let i = 0; i < records.length; i += BATCH_SIZE) {
  const chunk = records.slice(i, i + BATCH_SIZE);
  const batch = db.batch();
  for (const r of chunk) {
    if (r.total <= 0) continue; // nothing to record
    const ref = db.collection("sales").doc();
    batch.set(ref, {
      uid: r.uid,
      category: "perancangan",
      subCategory: null,
      amount: r.total,
      count: null,
      date: today,
      createdAt: FieldValue.serverTimestamp(),
      source: "konvensyen-monthly-import", // flags this as a bulk historical import, not a manual entry
    });
    written++;
  }
  await batch.commit();
  console.log(`  ${Math.min(i + BATCH_SIZE, records.length)}/${records.length}`);
}

console.log(`Done. ${written} sales records written.`);
