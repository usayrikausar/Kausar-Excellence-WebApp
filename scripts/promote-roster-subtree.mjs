// One-off demo helper: promotes every ACTIVE roster record in a given unit
// into a real Firebase Auth account + `users` doc, so you can actually log
// into the app as a real person from the imported hierarchy instead of only
// querying the `roster` collection directly.
//
// This is deliberately narrow (one unit, active-only) — it's for seeing real
// data in the real UI, not the general "admin promotes one daie" flow that
// still needs to be built. Local emulator only.
//
// Effective upline: if a person's real roster upline is expired (no login
// account), we walk further up until we find an active ancestor, so the
// promoted lineage stays connected instead of fragmenting at every expired
// node. Root-level people (or those whose whole upline chain is expired)
// become top-level KDEs/roots in the promoted tree.
//
// Usage (emulators must already be running):
//   node scripts/promote-roster-subtree.mjs kausar-aspire

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
process.env.GCLOUD_PROJECT ??= "demo-kausar-group";

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const unitId = process.argv[2];
if (!unitId) {
  console.error("Usage: node scripts/promote-roster-subtree.mjs <unitId>");
  process.exit(1);
}

initializeApp({ projectId: "demo-kausar-group" });
const auth = getAuth();
const db = getFirestore();
const PASSWORD = "password123";

async function main() {
  const unitName = unitId
    .replace("kausar-", "")
    .replace(/^\w/, (c) => c.toUpperCase());
  await db.collection("units").doc(unitId).set({ name: `Kausar ${unitName}` }, { merge: true });

  const snap = await db.collection("roster").where("unitId", "==", unitId).where("status", "==", "active").get();
  const byRosterId = new Map(snap.docs.map((d) => [d.id, { rosterId: d.id, ...d.data() }]));
  console.log(`Promoting ${byRosterId.size} active roster records in ${unitId}...`);

  // Build effective-upline map by walking the full roster (including
  // expired) so we can skip over expired ancestors correctly.
  const allRosterSnap = await db.collection("roster").get();
  const allById = new Map(allRosterSnap.docs.map((d) => [d.id, { rosterId: d.id, ...d.data() }]));

  function resolveEffectiveUpline(rosterId) {
    let cur = allById.get(rosterId)?.uplineRosterId ?? null;
    while (cur) {
      if (byRosterId.has(cur)) return cur;
      cur = allById.get(cur)?.uplineRosterId ?? null;
    }
    return null;
  }

  // Process in dependency order: repeatedly promote anyone whose effective
  // upline is either null (root) or already promoted.
  const promoted = new Map(); // rosterId -> { uid, lineagePath }
  const pending = new Map(byRosterId);
  const table = [];
  const usedEmails = new Set();
  let guard = 0;

  while (pending.size > 0) {
    if (++guard > 10000) throw new Error("Dependency resolution stuck — possible cycle in roster data.");
    let progressed = false;

    for (const [rosterId, rec] of pending) {
      const effUpRosterId = resolveEffectiveUpline(rosterId);
      const upResolved = effUpRosterId === null || promoted.has(effUpRosterId);
      if (!upResolved) continue;

      const up = effUpRosterId ? promoted.get(effUpRosterId) : null;
      const uplineId = up ? up.uid : null;
      const lineagePath = up ? [...up.lineagePath, up.uid] : [];

      // A few real daieId numbers collide across two different people (the
      // duplicate-ID pairs flagged during import, e.g. 37659) — since email
      // must be unique, disambiguate rather than crash. This doesn't decide
      // which record is "correct"; that's still an open question for you.
      let email = `d${rec.daieId ?? rosterId}@kausar.test`;
      if (usedEmails.has(email)) email = `d${rec.daieId ?? rosterId}-${rosterId}@kausar.test`;
      usedEmails.add(email);

      // Idempotent: a prior run may have already created this account (e.g.
      // it crashed partway through on a duplicate-ID collision) — reuse it
      // instead of failing.
      let authUser;
      try {
        authUser = await auth.createUser({ email, password: PASSWORD, displayName: rec.name });
      } catch (err) {
        if (err.code === "auth/email-already-exists") {
          authUser = await auth.getUserByEmail(email);
        } else {
          throw err;
        }
      }
      await auth.setCustomUserClaims(authUser.uid, { rank: rec.rank, unitId: rec.unitId, isGroupAdmin: false });

      await db.collection("users").doc(authUser.uid).set({
        daieId: rec.daieId,
        name: rec.name,
        email,
        rank: rec.rank,
        unitId: rec.unitId,
        uplineId,
        lineagePath,
        structureType: "TS", // not present in the source hierarchy sheet — defaulting until real data is available
        subscriptionStatus: "active",
        isGroupAdmin: false,
        isLdpMember: rec.isLdpMember === true,
        createdAt: FieldValue.serverTimestamp(),
      });
      await db.collection("roster").doc(rosterId).update({ appAccountUid: authUser.uid });

      promoted.set(rosterId, { uid: authUser.uid, lineagePath });
      table.push({ daieId: rec.daieId, name: rec.name, email, rank: rec.rank });
      pending.delete(rosterId);
      progressed = true;
    }

    if (!progressed) throw new Error(`Stuck: ${pending.size} records have an unresolved upline chain.`);
  }

  console.log(`\nPromoted ${table.length} accounts. Password for all: ${PASSWORD}\n`);
  console.table(table);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
