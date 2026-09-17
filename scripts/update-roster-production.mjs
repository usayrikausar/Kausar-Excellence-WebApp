// Updates production's existing `roster` collection with a re-parsed source
// (scripts/roster_import_v2.json) — unlike import-roster-production.mjs
// (first-time only, refuses if the collection is non-empty), this merges
// new/changed fields into each existing roster doc by rosterId, deliberately
// NEVER touching `appAccountUid` so promotion links already established by
// promote-roster-production.mjs survive untouched. New rosterIds not seen
// before are added fresh with appAccountUid: null (not yet promoted).
//
// Built for the dateExpiry/region rollout (2026-09-17): the sheet's real
// Tempoh Tamat field replaced a 24/36-month formula for computing `status`,
// which flips some records from expired -> active and vice versa. This
// script reports that status-change diff so a human can review anyone who
// flips from active to expired (their promoted account, if any, is NOT
// auto-deactivated — subscriptionStatus is a separate, deliberate decision).
//
// Usage:
//   node scripts/update-roster-production.mjs <path to service-account.json>

import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const keyPath = process.argv[2];
if (!keyPath) {
  console.error("Usage: node scripts/update-roster-production.mjs <path to service-account.json>");
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
console.log(`Loaded ${records.length} roster records from the re-parsed source.`);

const existingSnap = await db.collection("roster").get();
const existingById = new Map(existingSnap.docs.map((d) => [d.id, d.data()]));
console.log(`Production roster currently has ${existingById.size} docs.`);

let unchanged = 0, updated = 0, added = 0;
const becameActive = [];
const becameExpired = [];

const BATCH_SIZE = 450;
for (let i = 0; i < records.length; i += BATCH_SIZE) {
  const chunk = records.slice(i, i + BATCH_SIZE);
  const batch = db.batch();
  for (const r of chunk) {
    const prev = existingById.get(r.rosterId);
    const patch = {
      daieId: r.daieId,
      name: r.name,
      email: r.email,
      rank: r.rank,
      unitId: r.unitId,
      uplineRosterId: r.uplineRosterId,
      lineagePath: r.lineagePath,
      dateLicensed: r.dateLicensed,
      dateExpiry: r.dateExpiry,
      region: r.region,
      status: r.status,
      isLdpMember: r.isLdpMember,
      flags: r.flags,
      sourceRow: r.sourceRow,
    };
    // appAccountUid intentionally omitted -- merge: true leaves it as-is.
    batch.set(db.collection("roster").doc(r.rosterId), patch, { merge: true });

    if (!prev) {
      added++;
    } else if (prev.status === r.status && prev.region === r.region && prev.dateExpiry === r.dateExpiry) {
      unchanged++;
    } else {
      updated++;
      if (prev.status === "expired" && r.status === "active") becameActive.push({ daieId: r.daieId, name: r.name, appAccountUid: prev.appAccountUid ?? null });
      if (prev.status === "active" && r.status === "expired") becameExpired.push({ daieId: r.daieId, name: r.name, appAccountUid: prev.appAccountUid ?? null });
    }
  }
  await batch.commit();
  console.log(`  ${Math.min(i + BATCH_SIZE, records.length)}/${records.length}`);
}

console.log(`\nDone. added=${added} updated=${updated} unchanged=${unchanged}`);

console.log(`\nFlipped expired -> active (${becameActive.length}), promoted-already=${becameActive.filter((r) => r.appAccountUid).length}:`);
console.table(becameActive.slice(0, 20).map((r) => ({ daieId: r.daieId, name: r.name, alreadyPromoted: !!r.appAccountUid })));
if (becameActive.length > 20) console.log(`...and ${becameActive.length - 20} more.`);

console.log(`\nFlipped active -> expired (${becameExpired.length}), promoted-already=${becameExpired.filter((r) => r.appAccountUid).length} (NOT auto-deactivated — review manually):`);
console.table(becameExpired.slice(0, 20).map((r) => ({ daieId: r.daieId, name: r.name, alreadyPromoted: !!r.appAccountUid })));
if (becameExpired.length > 20) console.log(`...and ${becameExpired.length - 20} more.`);
