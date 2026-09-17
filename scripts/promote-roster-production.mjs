// Promotes every ACTIVE roster record across all 5 units into a real
// Firebase Auth account + `users` doc on the live project — the production
// counterpart to promote-roster-subtree.mjs (which is emulator-only and uses
// a shared hardcoded password).
//
// Differences from the emulator version, both deliberate for a real rollout:
//  - Uses each person's REAL email from the roster (not a synthetic
//    d{daieId}@kausar.test address) — required for the self-serve
//    "set your password" flow below to reach them.
//  - Creates the Auth account with NO password at all. There is nothing to
//    distribute or leak. The daie's first sign-in is via the login page's
//    "Forgot password?" link (src/components/marketing/login-form.tsx),
//    which calls Firebase's sendPasswordResetEmail — that works for an
//    account that has no password yet, and doubles as first-time setup and
//    a genuine forgot-password flow with no separate code path needed.
//  - Records with a missing/malformed email, or a real email already used
//    by another active record (rare — a handful of families sharing one
//    inbox in the source sheet), are skipped rather than guessed at; both
//    print in a follow-up table at the end for manual resolution.
//
// Usage:
//   node scripts/promote-roster-production.mjs <path to service-account.json>

import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const keyPath = process.argv[2];
if (!keyPath) {
  console.error("Usage: node scripts/promote-roster-production.mjs <path to service-account.json>");
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
if (serviceAccount.project_id !== "kausar-excellence-web-app") {
  console.error(`Refusing to run: key belongs to project "${serviceAccount.project_id}", expected "kausar-excellence-web-app".`);
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
const auth = getAuth();
const db = getFirestore();

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function main() {
  const allRosterSnap = await db.collection("roster").get();
  const allById = new Map(allRosterSnap.docs.map((d) => [d.id, { rosterId: d.id, ...d.data() }]));
  const activeRecords = [...allById.values()].filter((r) => r.status === "active");
  console.log(`Loaded ${allById.size} roster records (${activeRecords.length} active) from production.`);

  const byRosterId = new Map(activeRecords.map((r) => [r.rosterId, r]));

  function resolveEffectiveUpline(rosterId) {
    let cur = allById.get(rosterId)?.uplineRosterId ?? null;
    while (cur) {
      if (byRosterId.has(cur)) return cur;
      cur = allById.get(cur)?.uplineRosterId ?? null;
    }
    return null;
  }

  // Pre-flight: partition into promotable vs skipped (bad/duplicate email)
  // BEFORE touching Auth, so the dependency walk below only ever sees
  // records that will actually get promoted (an upline skipped for a bad
  // email must not silently disappear from a downline's lineage - anyone
  // under a skipped record falls back to the next active ancestor, exactly
  // like an expired upline already does).
  const usedEmails = new Set();
  const skippedNoEmail = [];
  const skippedDuplicate = [];
  for (const rec of activeRecords) {
    const email = (rec.email ?? "").trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email)) {
      skippedNoEmail.push(rec);
      byRosterId.delete(rec.rosterId);
      continue;
    }
    if (usedEmails.has(email)) {
      skippedDuplicate.push(rec);
      byRosterId.delete(rec.rosterId);
      continue;
    }
    usedEmails.add(email);
  }
  console.log(`Promotable: ${byRosterId.size} | skipped (no/bad email): ${skippedNoEmail.length} | skipped (duplicate email): ${skippedDuplicate.length}`);

  const promoted = new Map(); // rosterId -> { uid, lineagePath }
  const pending = new Map(byRosterId);
  const table = [];
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
      const email = rec.email.trim().toLowerCase();

      // Idempotent: a prior partial run may have already created this
      // account — reuse it instead of failing. Firebase's own email
      // validation is stricter than our regex pre-check (e.g. consecutive
      // dots) — treat a rejection from Firebase itself the same as a
      // pre-flight bad email: skip and report, don't crash the whole batch.
      let authUser;
      try {
        authUser = await auth.createUser({ email, displayName: rec.name });
      } catch (err) {
        if (err.code === "auth/email-already-exists") {
          authUser = await auth.getUserByEmail(email);
        } else if (err.code === "auth/invalid-email") {
          skippedNoEmail.push(rec);
          pending.delete(rosterId);
          byRosterId.delete(rosterId); // so any downline's upline walk skips past this one, same as a pre-flight skip
          progressed = true;
          continue;
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
        dateLicensed: rec.dateLicensed ?? null,
        createdAt: FieldValue.serverTimestamp(),
      });
      await db.collection("roster").doc(rosterId).update({ appAccountUid: authUser.uid });

      promoted.set(rosterId, { uid: authUser.uid, lineagePath });
      table.push({ daieId: rec.daieId, name: rec.name, email, rank: rec.rank, unitId: rec.unitId });
      pending.delete(rosterId);
      progressed = true;
    }

    if (!progressed) throw new Error(`Stuck: ${pending.size} records have an unresolved upline chain.`);
  }

  console.log(`\nPromoted ${table.length} accounts — no password set. Each daie sets their own via "Forgot password?" on the login page.\n`);
  console.table(table.slice(0, 20));
  if (table.length > 20) console.log(`...and ${table.length - 20} more.`);

  if (skippedNoEmail.length) {
    console.log(`\nSkipped — missing/malformed email (${skippedNoEmail.length}):`);
    console.table(skippedNoEmail.map((r) => ({ daieId: r.daieId, name: r.name, email: r.email ?? null, unitId: r.unitId })));
  }
  if (skippedDuplicate.length) {
    console.log(`\nSkipped — email already used by another active record (${skippedDuplicate.length}):`);
    console.table(skippedDuplicate.map((r) => ({ daieId: r.daieId, name: r.name, email: r.email, unitId: r.unitId })));
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
