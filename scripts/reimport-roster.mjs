// Replaces the `roster` collection with the authoritative data parsed from
// Wasiyyah's "Perunding Whole.xlsx" (see parse_perunding_whole.py ->
// roster_import_v2.json), superseding the original reverse-engineered
// color-coded-Excel import (import-roster.mjs / roster_import.json).
//
// Unlike a plain re-import, this also refreshes anyone ALREADY promoted to a
// real (emulator) login account: their rank/unitId/uplineId/lineagePath/
// dateLicensed are updated to match the new source, matched by daieId (Kod).
// Matching is skipped for any daieId that's ambiguous in either the OLD
// `users` collection or the NEW roster data (duplicate-id rows) rather than
// guessing which record is "correct" — same caution as
// promote-roster-subtree.mjs's duplicate-id handling.
//
// Deliberately does NOT touch a promoted user's email/Auth credentials,
// subscriptionStatus, isGroupAdmin, or structureType (none of those exist in
// the source sheet, and email in particular must stay the synthetic
// d{daieId}@kausar.test login address, not the real Wasiyyah email now
// stored on the roster doc).
//
// Usage (emulators must already be running):
//   node scripts/reimport-roster.mjs

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.GCLOUD_PROJECT ??= "demo-kausar-group";

import { readFileSync } from "node:fs";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

initializeApp({ projectId: "demo-kausar-group" });
const db = getFirestore();

const records = JSON.parse(readFileSync(new URL("./roster_import_v2.json", import.meta.url), "utf8"));
const byRosterId = new Map(records.map((r) => [r.rosterId, r]));

console.log(`Loaded ${records.length} new roster records.`);

// --- Step 1: find already-promoted users, keyed by daieId -----------------
const usersSnap = await db.collection("users").get();
const usersByDaieId = new Map();
const ambiguousUserDaieIds = new Set();
usersSnap.forEach((doc) => {
  const daieId = doc.data().daieId;
  if (!daieId) return;
  if (usersByDaieId.has(daieId)) ambiguousUserDaieIds.add(daieId);
  usersByDaieId.set(daieId, { uid: doc.id, ...doc.data() });
});
console.log(`Found ${usersByDaieId.size} promoted user(s) with a daieId, ${ambiguousUserDaieIds.size} ambiguous.`);

const newDaieIdCounts = new Map();
for (const r of records) {
  if (!r.daieId) continue;
  newDaieIdCounts.set(r.daieId, (newDaieIdCounts.get(r.daieId) ?? 0) + 1);
}

// --- Step 2: link roster records to promoted accounts (unambiguous only) --
let linked = 0;
for (const r of records) {
  r.appAccountUid = null;
  if (!r.daieId) continue;
  if (ambiguousUserDaieIds.has(r.daieId)) continue;
  if ((newDaieIdCounts.get(r.daieId) ?? 0) > 1) continue; // duplicate_id in new data
  const user = usersByDaieId.get(r.daieId);
  if (user) {
    r.appAccountUid = user.uid;
    linked++;
  }
}
console.log(`Linked ${linked} roster record(s) to existing promoted accounts.`);

// --- Step 3: wipe and rewrite the `roster` collection ----------------------
const existing = await db.collection("roster").listDocuments();
console.log(`Deleting ${existing.length} existing roster doc(s)...`);
for (let i = 0; i < existing.length; i += 450) {
  const batch = db.batch();
  for (const ref of existing.slice(i, i + 450)) batch.delete(ref);
  await batch.commit();
}

console.log("Writing new roster docs...");
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
      appAccountUid: r.appAccountUid,
    });
  }
  await batch.commit();
  console.log(`  ${Math.min(i + 450, records.length)}/${records.length}`);
}

// --- Step 4: refresh already-promoted users' hierarchy/contract fields ----
// Effective upline: walk up uplineRosterId until we hit a roster record
// that's itself linked to a promoted account (skipping over any ancestor
// that isn't promoted), exactly like promote-roster-subtree.mjs does when
// creating new accounts — so refreshed accounts nest under the same
// promoted ancestors they always did, even if the raw hierarchy has
// unpromoted people in between.
function resolveEffectiveUpline(rosterId) {
  let cur = byRosterId.get(rosterId)?.uplineRosterId ?? null;
  while (cur) {
    const rec = byRosterId.get(cur);
    if (!rec) return null;
    if (rec.appAccountUid) return rec;
    cur = rec.uplineRosterId;
  }
  return null;
}

const lineageCache = new Map();
function computeLineagePath(rosterId) {
  if (lineageCache.has(rosterId)) return lineageCache.get(rosterId);
  const effUp = resolveEffectiveUpline(rosterId);
  const result = effUp ? [...computeLineagePath(effUp.rosterId), effUp.appAccountUid] : [];
  lineageCache.set(rosterId, result);
  return result;
}

let refreshed = 0;
const refreshTable = [];
for (const r of records) {
  if (!r.appAccountUid) continue;
  const effUp = resolveEffectiveUpline(r.rosterId);
  const uplineId = effUp ? effUp.appAccountUid : null;
  const lineagePath = computeLineagePath(r.rosterId);
  await db.collection("users").doc(r.appAccountUid).update({
    rank: r.rank,
    unitId: r.unitId,
    uplineId,
    lineagePath,
    dateLicensed: r.dateLicensed,
    isLdpMember: r.isLdpMember,
  });
  refreshed++;
  refreshTable.push({ daieId: r.daieId, name: r.name, rank: r.rank, unitId: r.unitId, dateLicensed: r.dateLicensed });
}

console.log(`\nDone. Wrote ${records.length} roster docs, refreshed ${refreshed} promoted user account(s).`);
console.table(refreshTable);
