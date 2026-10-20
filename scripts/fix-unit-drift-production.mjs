// Re-aligns users/{uid}.unitId with the roster (Wasiyyah's Perunding Whole
// "Kumpulan", already corrected by parse_perunding_whole.py's overrides).
//
// Found 2026-10-20: 41 accounts were filed under Kausar Wealth although the
// roster says Kausar Aspire / Kausar Intisar. Two causes:
//   1. The group admin's own KDE account (Kausar Aspire, roster 10363) was
//      created with unitId "kausar-wealth", and recomputeLineageOnWrite then
//      cascaded that to their whole Aspire team.
//   2. Kausar Intisar's KDE has a (confirmed, real) Kausar Wealth introducer,
//      and the trigger used to derive every non-root member's unit from their
//      upline — so the Intisar KDE and her team became Kausar Wealth.
// The trigger now treats a KDE's unitId as authoritative even when they have
// an upline (functions/lineage.js) — deploy that BEFORE running this.
//
// KDEs are fixed first (and their custom claims re-synced when they have a
// login); every other drifted member is then written directly. The trigger
// re-validates each write against the upline, so the end state is
// consistent whatever order the writes land in.
//
// Usage (dry run by default):
//   node scripts/fix-unit-drift-production.mjs <service-account.json> [--apply]

import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const [keyPath, flag] = process.argv.slice(2);
if (!keyPath) {
  console.error("Usage: node scripts/fix-unit-drift-production.mjs <service-account.json> [--apply]");
  process.exit(1);
}
const apply = flag === "--apply";
const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
if (serviceAccount.project_id !== "kausar-excellence-web-app") {
  console.error(`Refusing to run: key belongs to project "${serviceAccount.project_id}", expected "kausar-excellence-web-app".`);
  process.exit(1);
}
initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
const db = getFirestore();
const auth = getAuth();

const [usersSnap, rosterSnap] = await Promise.all([db.collection("users").get(), db.collection("roster").get()]);
const rosterUnitByUid = new Map();
rosterSnap.forEach((d) => {
  const r = d.data();
  if (r.appAccountUid) rosterUnitByUid.set(r.appAccountUid, r.unitId);
});

const drifted = [];
usersSnap.forEach((d) => {
  const u = d.data();
  const rosterUnit = rosterUnitByUid.get(d.id);
  if (rosterUnit && rosterUnit !== u.unitId) drifted.push({ uid: d.id, ...u, rosterUnit });
});
drifted.sort((a, b) => (a.rank === "KDE" ? 0 : 1) - (b.rank === "KDE" ? 0 : 1));

console.table(drifted.map((u) => ({ daieId: u.daieId, name: u.name, rank: u.rank, from: u.unitId, to: u.rosterUnit })));
if (!apply) {
  console.log(`Dry run: ${drifted.length} accounts would be re-filed. Re-run with --apply.`);
  process.exit(0);
}

for (const u of drifted) {
  await db.collection("users").doc(u.uid).set({ unitId: u.rosterUnit }, { merge: true });
  if (u.recordOnly !== true) {
    await auth.setCustomUserClaims(u.uid, { rank: u.rank, unitId: u.rosterUnit, isGroupAdmin: u.isGroupAdmin === true });
  }
}
console.log(`Re-filed ${drifted.length} accounts.`);
