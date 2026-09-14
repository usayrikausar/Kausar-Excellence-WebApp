// Promotes ONE roster record into a REAL Firebase Auth account + `users`
// doc on the real kausar-excellence-web-app project, using their REAL email
// from the Wasiyyah roster and a randomly generated password (never a
// shared/synthetic one like the local emulator's "password123" — see
// [[kausar-webapp-overview]] on why that must never be replicated here).
//
// Also seeds the 5 `units` docs if missing, since nothing has ever been
// promoted on the real project before this.
//
// Usage:
//   node scripts/promote-daieid-production.mjs <path to service-account.json> <daieId> [--group-admin]

import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const [keyPath, daieId, flag] = process.argv.slice(2);
if (!keyPath || !daieId) {
  console.error("Usage: node scripts/promote-daieid-production.mjs <service-account.json> <daieId> [--group-admin]");
  process.exit(1);
}
const isGroupAdmin = flag === "--group-admin";

const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
if (serviceAccount.project_id !== "kausar-excellence-web-app") {
  console.error(`Refusing to run: key belongs to "${serviceAccount.project_id}", expected "kausar-excellence-web-app".`);
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
const auth = getAuth();
const db = getFirestore();

const UNIT_LABELS = {
  "kausar-wealth": "Kausar Wealth",
  "kausar-global": "Kausar Global",
  "kausar-aspire": "Kausar Aspire",
  "kausar-intisar": "Kausar Intisar",
  "kausar-nusrah": "Kausar Nusrah",
};

const records = JSON.parse(readFileSync(new URL("./roster_import_v2.json", import.meta.url), "utf8"));
const rec = records.find((r) => r.daieId === daieId);
if (!rec) throw new Error(`No roster record found for daieId ${daieId}`);
if (!rec.email) throw new Error(`Roster record for ${daieId} (${rec.name}) has no email on file — can't create a real login without one.`);

// Seed unit docs if this is the first promotion on the real project.
for (const [unitId, name] of Object.entries(UNIT_LABELS)) {
  await db.collection("units").doc(unitId).set({ name }, { merge: true });
}

const password = randomBytes(9).toString("base64url"); // 12 chars, URL-safe

let authUser;
try {
  authUser = await auth.createUser({ email: rec.email, password, displayName: rec.name, emailVerified: false });
} catch (err) {
  if (err.code === "auth/email-already-exists") {
    authUser = await auth.getUserByEmail(rec.email);
    await auth.updateUser(authUser.uid, { password });
  } else {
    throw err;
  }
}

await auth.setCustomUserClaims(authUser.uid, { rank: rec.rank, unitId: rec.unitId, isGroupAdmin });

await db.collection("users").doc(authUser.uid).set({
  daieId: rec.daieId,
  name: rec.name,
  email: rec.email,
  rank: rec.rank,
  unitId: rec.unitId,
  uplineId: null,
  lineagePath: [],
  structureType: "TS",
  subscriptionStatus: "active",
  isGroupAdmin,
  isLdpMember: rec.isLdpMember === true,
  dateLicensed: rec.dateLicensed,
  createdAt: FieldValue.serverTimestamp(),
});

await db.collection("roster").doc(rec.rosterId).update({ appAccountUid: authUser.uid });

console.log("Promoted on the REAL project:");
console.table([{ daieId: rec.daieId, name: rec.name, email: rec.email, rank: rec.rank, unitId: rec.unitId, isGroupAdmin, password }]);
