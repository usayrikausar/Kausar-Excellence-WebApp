// Promotes ONLY roster records that are newly active (status === "active")
// and not yet promoted (appAccountUid is null) -- the incremental version of
// promote-roster-production.mjs, needed after update-roster-production.mjs
// flipped ~186 records from expired to active once status started coming
// from the sheet's real Tempoh Tamat field instead of a formula.
//
// Re-running the original bulk promotion script against everyone would be
// destructive: it always `.set()`s (no merge) users/{uid} with hardcoded
// defaults (subscriptionStatus: "active", isGroupAdmin: false,
// structureType: "TS"), which would silently wipe out any deliberate admin
// changes already made to the 822 previously-promoted accounts (e.g. an
// admin granted isGroupAdmin, deactivated a subscription, or corrected
// structureType to OS). This script never touches an already-promoted
// account at all -- it only creates new ones.
//
// The effective-upline walk needs to treat BOTH already-promoted accounts
// AND newly-promotable ones as valid "stop here" points, since a newly
// active person's upline might be someone promoted in the original run.
//
// Usage:
//   node scripts/promote-newly-active-production.mjs <path to service-account.json>

import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const keyPath = process.argv[2];
if (!keyPath) {
  console.error("Usage: node scripts/promote-newly-active-production.mjs <path to service-account.json>");
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
  const [rosterSnap, usersSnap] = await Promise.all([
    db.collection("roster").get(),
    db.collection("users").get(),
  ]);
  const allById = new Map(rosterSnap.docs.map((d) => [d.id, { rosterId: d.id, ...d.data() }]));
  console.log(`Loaded ${allById.size} roster records.`);

  // Seed with EVERYONE already promoted (any status) -- their lineagePath is
  // already correct in `users`, we just need it keyed by rosterId for the
  // upline walk below.
  const usersByUid = new Map(usersSnap.docs.map((d) => [d.id, d.data()]));
  const promoted = new Map(); // rosterId -> { uid, lineagePath }
  for (const [rosterId, rec] of allById) {
    if (rec.appAccountUid && usersByUid.has(rec.appAccountUid)) {
      const u = usersByUid.get(rec.appAccountUid);
      promoted.set(rosterId, { uid: rec.appAccountUid, lineagePath: u.lineagePath ?? [] });
    }
  }
  console.log(`${promoted.size} roster records are already promoted.`);

  const toPromote = [...allById.values()].filter((r) => r.status === "active" && !r.appAccountUid);
  console.log(`${toPromote.length} newly-active, not-yet-promoted records to process.`);

  // "Valid stop" set for the upline walk: already-promoted rosterIds plus
  // this run's candidates (minus any we're about to skip for bad/dup email).
  const byRosterId = new Map(toPromote.map((r) => [r.rosterId, r]));

  const usedEmails = new Set(
    [...usersByUid.values()].map((u) => (u.email ?? "").trim().toLowerCase()).filter(Boolean),
  );
  const skippedNoEmail = [];
  const skippedDuplicate = [];
  for (const rec of toPromote) {
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

  function resolveEffectiveUpline(rosterId) {
    let cur = allById.get(rosterId)?.uplineRosterId ?? null;
    while (cur) {
      if (promoted.has(cur) || byRosterId.has(cur)) return cur;
      cur = allById.get(cur)?.uplineRosterId ?? null;
    }
    return null;
  }

  const pending = new Map(byRosterId);
  const table = [];
  let guard = 0;

  while (pending.size > 0) {
    if (++guard > 10000) throw new Error("Dependency resolution stuck — possible cycle in roster data.");
    let progressed = false;

    for (const [rosterId, rec] of pending) {
      const effUpRosterId = resolveEffectiveUpline(rosterId);
      const upResolved = effUpRosterId === null || promoted.has(effUpRosterId);
      if (!upResolved) continue; // waiting on another record in THIS batch to be promoted first

      const up = effUpRosterId ? promoted.get(effUpRosterId) : null;
      const uplineId = up ? up.uid : null;
      const lineagePath = up ? [...up.lineagePath, up.uid] : [];
      const email = rec.email.trim().toLowerCase();

      let authUser;
      try {
        authUser = await auth.createUser({ email, displayName: rec.name });
      } catch (err) {
        if (err.code === "auth/email-already-exists") {
          authUser = await auth.getUserByEmail(email);
        } else if (err.code === "auth/invalid-email") {
          skippedNoEmail.push(rec);
          pending.delete(rosterId);
          byRosterId.delete(rosterId);
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
        region: rec.region ?? "central",
        uplineId,
        lineagePath,
        structureType: "TS",
        subscriptionStatus: "active",
        isGroupAdmin: false,
        isLdpMember: rec.isLdpMember === true,
        dateLicensed: rec.dateLicensed ?? null,
        dateExpiry: rec.dateExpiry ?? null,
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

  console.log(`\nPromoted ${table.length} newly-active accounts — no password set. Each daie sets their own via "Forgot password?" on the login page.\n`);
  console.table(table.slice(0, 20));
  if (table.length > 20) console.log(`...and ${table.length - 20} more.`);

  if (skippedNoEmail.length) {
    console.log(`\nSkipped — missing/malformed email (${skippedNoEmail.length}):`);
    console.table(skippedNoEmail.map((r) => ({ daieId: r.daieId, name: r.name, email: r.email ?? null, unitId: r.unitId })));
  }
  if (skippedDuplicate.length) {
    console.log(`\nSkipped — email already used (${skippedDuplicate.length}):`);
    console.table(skippedDuplicate.map((r) => ({ daieId: r.daieId, name: r.name, email: r.email, unitId: r.unitId })));
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
