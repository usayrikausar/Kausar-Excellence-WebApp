// Creates office-staff Group Admin accounts (2026-10-22: Nadzirah Kamal and
// Atiqah, HQ staff). Staff are users of the app, not daie: isStaff: true,
// no Kod/sales/upline, left out of every daie list and head count (see
// UserDoc.isStaff and lib/data.ts getDownline / getScopeMembers), with full
// Group Admin powers (isGroupAdmin: true + custom claim).
//
// No password is set: each person uses "Forgot password?" on the login page.
//
// Usage (dry run by default):
//   node scripts/create-staff-admins-production.mjs <service-account.json> [--apply]

import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const STAFF = [
  { email: "nadzirahkamal@kausargroup.com", name: "Nadzirah Kamal", daieId: "STAFF-01" },
  { email: "atiqah@kausargroup.com", name: "Atiqah", daieId: "STAFF-02" },
];
// Not one of the 5 units — staff sit above them. Kept out of UNIT_LABELS on
// purpose so it never appears as a unit in tables, charts or the switcher.
const STAFF_UNIT = "kausar-group-hq";

const [keyPath, flag] = process.argv.slice(2);
if (!keyPath) {
  console.error("Usage: node scripts/create-staff-admins-production.mjs <service-account.json> [--apply]");
  process.exit(1);
}
const apply = flag === "--apply";
const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
if (serviceAccount.project_id !== "kausar-excellence-web-app") {
  console.error(`Refusing to run: key belongs to project "${serviceAccount.project_id}", expected "kausar-excellence-web-app".`);
  process.exit(1);
}
initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
const auth = getAuth();
const db = getFirestore();

for (const s of STAFF) {
  let existing = null;
  try {
    existing = await auth.getUserByEmail(s.email);
  } catch (err) {
    if (err.code !== "auth/user-not-found") throw err;
  }
  if (existing && (await db.collection("users").doc(existing.uid).get()).exists) {
    console.log(`${s.email}: already has an account (${existing.uid}) — skipped.`);
    continue;
  }
  const taken = await db.collection("users").where("daieId", "==", s.daieId).get();
  if (!taken.empty) throw new Error(`${s.daieId} is already used.`);
  console.log(`${apply ? "Creating" : "Would create"} ${s.email} (${s.name}, ${s.daieId}) as staff Group Admin${existing ? `, reusing login ${existing.uid}` : ""}.`);
  if (!apply) continue;

  const user = existing ?? (await auth.createUser({ email: s.email, displayName: s.name }));
  await auth.setCustomUserClaims(user.uid, { rank: "KDE", unitId: STAFF_UNIT, isGroupAdmin: true });
  await db.collection("users").doc(user.uid).set({
    daieId: s.daieId,
    name: s.name,
    email: s.email,
    rank: "KDE",
    unitId: STAFF_UNIT,
    uplineId: null,
    lineagePath: [],
    structureType: "TS",
    subscriptionStatus: "active",
    isGroupAdmin: true,
    isStaff: true,
    isLdpMember: false,
    region: "central",
    dateLicensed: null,
    dateExpiry: null,
    createdAt: FieldValue.serverTimestamp(),
  });
}
if (!apply) console.log("Dry run. Re-run with --apply.");
