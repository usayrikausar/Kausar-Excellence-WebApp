// Backfills `region` and `dateExpiry` onto every ALREADY-promoted user
// (the 822 promoted before these fields existed on the roster), by looking
// up each user's roster record via appAccountUid. Merge-only patch of
// exactly these two fields -- never touches rank/unitId/subscriptionStatus/
// isGroupAdmin/structureType/anything else an admin may have since changed.
//
// Usage:
//   node scripts/sync-region-expiry-production.mjs <path to service-account.json>

import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const keyPath = process.argv[2];
if (!keyPath) {
  console.error("Usage: node scripts/sync-region-expiry-production.mjs <path to service-account.json>");
  process.exit(1);
}
const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
if (serviceAccount.project_id !== "kausar-excellence-web-app") {
  console.error(`Refusing to run: key belongs to project "${serviceAccount.project_id}", expected "kausar-excellence-web-app".`);
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
const db = getFirestore();

const rosterSnap = await db.collection("roster").where("appAccountUid", "!=", null).get();
console.log(`Found ${rosterSnap.size} roster records linked to a promoted account.`);

let updated = 0;
const BATCH_SIZE = 450;
const docs = rosterSnap.docs;
for (let i = 0; i < docs.length; i += BATCH_SIZE) {
  const chunk = docs.slice(i, i + BATCH_SIZE);
  const batch = db.batch();
  for (const doc of chunk) {
    const r = doc.data();
    batch.set(
      db.collection("users").doc(r.appAccountUid),
      { region: r.region ?? "central", dateExpiry: r.dateExpiry ?? null },
      { merge: true },
    );
    updated++;
  }
  await batch.commit();
  console.log(`  ${Math.min(i + BATCH_SIZE, docs.length)}/${docs.length}`);
}

console.log(`\nDone. Synced region/dateExpiry onto ${updated} promoted user docs.`);
