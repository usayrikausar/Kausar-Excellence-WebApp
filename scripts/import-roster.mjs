// Imports the real Kausar Group hierarchy (2,701 people, parsed from the
// "kausar group Hierarchy.xlsx" org chart) into a separate `roster`
// Firestore collection — deliberately NOT into `users` and NOT tied to any
// Firebase Auth account. This is historical/organizational data (who
// reports to whom, active vs expired, LDP membership), not app login
// accounts. Creating 2,701 fabricated logins for real people who never
// asked for one would be wrong; instead an admin later "promotes" a roster
// entry into a real app account when that daie actually onboards (ties into
// the Phase-1 admin enable/disable-for-payment flow).
//
// Records with a `flags` entry (duplicate_id / missing_id / unresolved_unit)
// are imported as-is but marked for admin review — see the flags array on
// each doc. Nothing here touches the `users` collection or existing seed
// data from scripts/seed-emulator.mjs.
//
// Usage (emulators must already be running):
//   node scripts/import-roster.mjs path/to/roster_import.json

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.GCLOUD_PROJECT ??= "demo-kausar-group";

import { readFileSync } from "node:fs";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node scripts/import-roster.mjs <roster_import.json>");
  process.exit(1);
}

initializeApp({ projectId: "demo-kausar-group" });
const db = getFirestore();

const records = JSON.parse(readFileSync(inputPath, "utf8"));
console.log(`Importing ${records.length} roster records...`);

const BATCH_SIZE = 450; // stay under Firestore's 500-write batch limit
let written = 0;

for (let i = 0; i < records.length; i += BATCH_SIZE) {
  const chunk = records.slice(i, i + BATCH_SIZE);
  const batch = db.batch();
  for (const r of chunk) {
    const ref = db.collection("roster").doc(r.rosterId);
    batch.set(ref, {
      daieId: r.daieId,
      name: r.name,
      rank: r.rank,
      unitId: r.unitId,
      uplineRosterId: r.uplineRosterId,
      lineagePath: r.lineagePath,
      status: r.status,
      isLdpMember: r.isLdpMember,
      flags: r.flags,
      sourceRow: r.sourceRow,
      appAccountUid: null, // set once an admin promotes this roster entry to a real login
    });
  }
  await batch.commit();
  written += chunk.length;
  console.log(`  ${written}/${records.length}`);
}

const flagged = records.filter((r) => r.flags.length > 0).length;
const active = records.filter((r) => r.status === "active").length;
console.log(`Done. ${written} written, ${active} active, ${flagged} flagged for review.`);
