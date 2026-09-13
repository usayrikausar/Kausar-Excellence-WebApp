// Imports the authoritative Wasiyyah roster (scripts/roster_import_v2.json,
// same data used for the emulator's `roster` collection) into the REAL
// kausar-excellence-web-app Firestore project. Data only — no Firebase Auth
// accounts, no `users` docs, no logins. `appAccountUid` is written as null
// for every record; nobody can sign in from this import alone.
//
// Deliberately does not touch Auth at all, unlike promote-roster-subtree.mjs
// / promote-daieids.mjs (emulator-only) — creating real login accounts on
// the live project is a separate, explicitly-gated decision, not a side
// effect of getting the org chart into the real database.
//
// Usage:
//   node scripts/import-roster-production.mjs <path to service-account.json>

import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const keyPath = process.argv[2];
if (!keyPath) {
  console.error("Usage: node scripts/import-roster-production.mjs <path to service-account.json>");
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
if (serviceAccount.project_id !== "kausar-excellence-web-app") {
  console.error(`Refusing to run: key belongs to project "${serviceAccount.project_id}", expected "kausar-excellence-web-app".`);
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
const db = getFirestore();

const records = JSON.parse(readFileSync(new URL("./roster_import_v2.json", import.meta.url), "utf8"));
console.log(`Loaded ${records.length} roster records for ${serviceAccount.project_id}.`);

const existing = await db.collection("roster").listDocuments();
if (existing.length > 0) {
  console.error(
    `Refusing to run: the real project's roster collection already has ${existing.length} doc(s). ` +
      `This script only handles a first-time import — delete/reconcile manually if you intend to replace it.`,
  );
  process.exit(1);
}

console.log("Writing roster docs...");
for (let i = 0; i < records.length; i += 450) {
  const chunk = records.slice(i, i + 450);
  const batch = db.batch();
  for (const r of chunk) {
    batch.set(db.collection("roster").doc(r.rosterId), {
      daieId: r.daieId,
      name: r.name,
      email: r.email,
      rank: r.rank,
      unitId: r.unitId,
      uplineRosterId: r.uplineRosterId,
      lineagePath: r.lineagePath,
      dateLicensed: r.dateLicensed,
      status: r.status,
      isLdpMember: r.isLdpMember,
      flags: r.flags,
      sourceRow: r.sourceRow,
      appAccountUid: null,
    });
  }
  await batch.commit();
  console.log(`  ${Math.min(i + 450, records.length)}/${records.length}`);
}

const byUnit = {};
for (const r of records) byUnit[r.unitId] = (byUnit[r.unitId] ?? 0) + 1;
console.log(`\nDone. Wrote ${records.length} roster docs to ${serviceAccount.project_id}. No Auth accounts created.`);
console.table(byUnit);
