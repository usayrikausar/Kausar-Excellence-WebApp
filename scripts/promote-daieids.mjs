// Promotes specific roster records (by daieId) into real (emulator) login
// accounts, regardless of their computed active/expired status — unlike
// promote-roster-subtree.mjs's whole-unit "active only" sweep, this is for
// filling in specific people the roster's dependency chain needs (e.g. an
// unpromoted parent whose already-relevant downlines need a real upline to
// nest under), or people PIC has specifically asked to bring into the demo.
//
// A person's login existing is independent of their contract's computed
// active/expired status — same as the many already-promoted accounts that
// now show "Non-Active (Expired)" after the Wasiyyah-file refresh; this
// script doesn't special-case that.
//
// Usage (emulators must already be running):
//   node scripts/promote-daieids.mjs <daieId> [daieId...]

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
process.env.GCLOUD_PROJECT ??= "demo-kausar-group";

import { readFileSync } from "node:fs";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const targetDaieIds = process.argv.slice(2);
if (targetDaieIds.length === 0) {
  console.error("Usage: node scripts/promote-daieids.mjs <daieId> [daieId...]");
  process.exit(1);
}

initializeApp({ projectId: "demo-kausar-group" });
const auth = getAuth();
const db = getFirestore();
const PASSWORD = "password123";

// Roster data straight from the parsed source (same file reimport-roster.mjs
// uses) rather than Firestore, so uplineRosterId chains are available for
// walking even through records that were never written with an
// appAccountUid link.
const records = JSON.parse(readFileSync(new URL("./roster_import_v2.json", import.meta.url), "utf8"));
const byRosterId = new Map(records.map((r) => [r.rosterId, r]));
const byDaieId = new Map(records.filter((r) => r.daieId).map((r) => [r.daieId, r]));

const targets = targetDaieIds.map((id) => {
  const rec = byDaieId.get(id);
  if (!rec) throw new Error(`No roster record found for daieId ${id}`);
  return rec;
});

async function main() {
  // Load already-promoted accounts so we know each roster record's current
  // appAccountUid (if any) and can resolve "effective upline" the same way
  // reimport-roster.mjs does.
  const usersSnap = await db.collection("users").get();
  const uidByDaieId = new Map();
  usersSnap.forEach((doc) => {
    const daieId = doc.data().daieId;
    if (daieId) uidByDaieId.set(daieId, doc.id);
  });
  for (const r of records) {
    r.appAccountUid = r.daieId ? (uidByDaieId.get(r.daieId) ?? null) : null;
  }

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

  // Process in dependency order: repeatedly promote anyone in the target
  // list whose effective upline is already resolvable (root, or already
  // promoted — including someone promoted earlier in this same run).
  const pending = new Map(targets.map((r) => [r.rosterId, r]));
  const table = [];
  let guard = 0;

  while (pending.size > 0) {
    if (++guard > 1000) throw new Error("Dependency resolution stuck — possible cycle.");
    let progressed = false;

    for (const [rosterId, rec] of pending) {
      const effUp = resolveEffectiveUpline(rosterId);
      const upResolved = effUp === null || effUp.appAccountUid;
      if (!upResolved) continue; // this target's upline is itself an unpromoted, unresolved target — wait for it

      const uplineId = effUp ? effUp.appAccountUid : null;
      const email = `d${rec.daieId}@kausar.test`;

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

      const lineagePath = computeLineagePath(rosterId);
      await db.collection("users").doc(authUser.uid).set({
        daieId: rec.daieId,
        name: rec.name,
        email,
        rank: rec.rank,
        unitId: rec.unitId,
        uplineId,
        lineagePath,
        structureType: "TS",
        subscriptionStatus: "active",
        isGroupAdmin: false,
        isLdpMember: rec.isLdpMember === true,
        dateLicensed: rec.dateLicensed,
        createdAt: FieldValue.serverTimestamp(),
      });
      await db.collection("roster").doc(rosterId).update({ appAccountUid: authUser.uid });

      rec.appAccountUid = authUser.uid;
      lineageCache.set(rosterId, lineagePath);
      table.push({ daieId: rec.daieId, name: rec.name, email, rank: rec.rank, unitId: rec.unitId, status: rec.status, uplineId });
      pending.delete(rosterId);
      progressed = true;
    }

    if (!progressed) {
      throw new Error(
        `Stuck: ${pending.size} target(s) depend on an unpromoted upline outside the target list: ` +
          [...pending.values()].map((r) => `${r.daieId} (needs ${r.uplineRosterId})`).join(", "),
      );
    }
  }

  console.log(`\nPromoted ${table.length} account(s). Password for all: ${PASSWORD}\n`);
  console.table(table);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
