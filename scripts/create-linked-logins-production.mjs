// Creates "linked logins": extra emails that open an EXISTING daie account
// (2026-10-20, Ketua Agensi kausargroup.com addresses). Each gets its own
// Firebase Auth user — Firebase allows one email per Auth user — plus:
//   - loginLinks/{authUid} = { profileUid, email }  (read by lib/auth/session.ts)
//   - custom claims { rank, unitId, isGroupAdmin, profileUid } so
//     firestore.rules' myUid() treats the login as that account.
// No password is set: each person uses "Forgot password?" on the login page.
// The account's own login (if any) keeps working unchanged.
//
// Kausar Wealth has no personal KDE account — its two heads share the
// company ID (10026, a record-only profile), so both links point there.
//
// Usage (dry run by default):
//   node scripts/create-linked-logins-production.mjs <service-account.json> [--apply]

import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const LINKS = [
  { email: "intanyasin@kausargroup.com", daieId: "11353" },
  { email: "kham.hashim@kausargroup.com", daieId: "10026" },
  { email: "usayri@kausargroup.com", daieId: "KDE-0001" },
  { email: "noorashiqien@kausargroup.com", daieId: "10307" },
  { email: "suzana@kausargroup.com", daieId: "10026" },
  { email: "umi@kausargroup.com", daieId: "10077" },
];

const [keyPath, flag] = process.argv.slice(2);
if (!keyPath) {
  console.error("Usage: node scripts/create-linked-logins-production.mjs <service-account.json> [--apply]");
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

const plan = [];
for (const { email, daieId } of LINKS) {
  const profiles = await db.collection("users").where("daieId", "==", daieId).get();
  if (profiles.size !== 1) throw new Error(`${email}: expected exactly 1 account with daieId ${daieId}, found ${profiles.size}`);
  const profile = profiles.docs[0];
  let existing = null;
  try {
    existing = await auth.getUserByEmail(email);
  } catch (err) {
    if (err.code !== "auth/user-not-found") throw err;
  }
  if (existing) {
    // Never hijack someone's real account: the existing login must not
    // already BE a daie account of its own.
    const own = await db.collection("users").doc(existing.uid).get();
    if (own.exists) throw new Error(`${email} is already a full account (${existing.uid}) — not linking.`);
  }
  plan.push({ email, profile, existing });
}

console.table(plan.map(({ email, profile, existing }) => ({
  email,
  opens: `${profile.get("daieId")} ${profile.get("name")}`,
  unit: profile.get("unitId"),
  rank: profile.get("rank"),
  groupAdmin: profile.get("isGroupAdmin") === true,
  login: existing ? `reuse ${existing.uid}${existing.disabled ? " (disabled!)" : ""}` : "create",
})));
if (!apply) {
  console.log("Dry run. Re-run with --apply to create the links.");
  process.exit(0);
}

for (const { email, profile, existing } of plan) {
  const data = profile.data();
  const authUser = existing ?? (await auth.createUser({ email, displayName: data.name }));
  await auth.setCustomUserClaims(authUser.uid, {
    rank: data.rank,
    unitId: data.unitId,
    isGroupAdmin: data.isGroupAdmin === true,
    profileUid: profile.id,
  });
  await db.collection("loginLinks").doc(authUser.uid).set({ profileUid: profile.id, email, createdAt: FieldValue.serverTimestamp() });
  console.log(`linked ${email} -> ${data.daieId} ${data.name}`);
}
console.log("Done. Each person sets a password via 'Forgot password?' on the login page.");
