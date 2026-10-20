// Creates "record only" users docs for daie who have Perancangan sales in the
// Konvensyen sheet but no app account — expired daie who still produced this
// FY, an active daie who was never promoted (no usable email), or a company
// code such as KAUSAR WEALTH MANAGEMENT SDN BHD. Without a users doc their
// sales count nowhere, so the app's group total falls short of the official
// Kausar Group figure.
//
// A record-only profile has NO Firebase Auth account (cannot log in, gets no
// email), carries recordOnly: true, and sits in the tree under its nearest
// promoted roster ancestor — the same effective-upline walk as
// promote-newly-active-production.mjs — so its sales roll up to the right
// DPM/KDE, unit and group. subscriptionStatus stays "active" so Status still
// reflects the real contract (dateExpiry), not the missing login.
//
// roster.appAccountUid is set to the new profile id, so later promotion runs
// treat the person as already promoted. To give one of them a real login
// later, create the Auth user with that same uid (auth.createUser({ uid }))
// and clear recordOnly.
//
// Usage (dry run by default):
//   node scripts/create-record-only-profiles-production.mjs <service-account.json> <records.json> [--apply]
// records.json: [{ daieId, name, unit, monthKey, amount }] (see konvensyen_monthly_by_month.json)

import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const [keyPath, recordsPath, flag] = process.argv.slice(2);
if (!keyPath || !recordsPath) {
  console.error("Usage: node scripts/create-record-only-profiles-production.mjs <service-account.json> <records.json> [--apply]");
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

const records = JSON.parse(readFileSync(recordsPath, "utf8"));
const salesByDaie = new Map();
for (const r of records) {
  if (r.amount > 0) salesByDaie.set(String(r.daieId), (salesByDaie.get(String(r.daieId)) ?? 0) + r.amount);
}

const [rosterSnap, usersSnap] = await Promise.all([db.collection("roster").get(), db.collection("users").get()]);
const usersByUid = new Map(usersSnap.docs.map((d) => [d.id, d.data()]));
const userDaieIds = new Set([...usersByUid.values()].map((u) => String(u.daieId)));
const allById = new Map(rosterSnap.docs.map((d) => [d.id, { rosterId: d.id, ...d.data() }]));
const rosterIdsByDaie = new Map();
for (const r of allById.values()) {
  const k = String(r.daieId);
  rosterIdsByDaie.set(k, [...(rosterIdsByDaie.get(k) ?? []), r.rosterId]);
}

const promoted = new Map(); // rosterId -> { uid, lineagePath }
for (const [rosterId, r] of allById) {
  if (r.appAccountUid && usersByUid.has(r.appAccountUid)) {
    promoted.set(rosterId, { uid: r.appAccountUid, lineagePath: usersByUid.get(r.appAccountUid).lineagePath ?? [] });
  }
}
const toCreate = [];
const problems = [];
for (const [daieId, total] of salesByDaie) {
  if (userDaieIds.has(daieId)) continue;
  const rosterIds = rosterIdsByDaie.get(daieId) ?? [];
  if (rosterIds.length !== 1) {
    problems.push({ daieId, total: total.toFixed(2), reason: rosterIds.length ? "duplicate roster code" : "not in roster" });
    continue;
  }
  const rec = allById.get(rosterIds[0]);
  if (rec.appAccountUid && usersByUid.has(rec.appAccountUid)) continue; // promoted under a different daieId
  toCreate.push({ rec, total, ref: db.collection("users").doc() });
}

// Resolve uplines in dependency order: a profile created in this run (e.g.
// the KWM company code) is a valid upline for another one (Haryati reports
// to it), so each profile joins `promoted` before its children resolve.
const creatingByRosterId = new Map(toCreate.map((c) => [c.rec.rosterId, c]));
function effectiveUplineRosterId(rosterId) {
  let cur = allById.get(rosterId)?.uplineRosterId ?? null;
  while (cur) {
    if (promoted.has(cur) || creatingByRosterId.has(cur)) return cur;
    cur = allById.get(cur)?.uplineRosterId ?? null;
  }
  return null;
}
const ordered = [];
const pending = new Set(creatingByRosterId.keys());
while (pending.size) {
  let progressed = false;
  for (const rosterId of pending) {
    const upRosterId = effectiveUplineRosterId(rosterId);
    if (upRosterId && !promoted.has(upRosterId)) continue; // upline is created later in this run
    const c = creatingByRosterId.get(rosterId);
    const up = upRosterId ? promoted.get(upRosterId) : null;
    c.uplineId = up?.uid ?? null;
    c.lineagePath = up ? [...up.lineagePath, up.uid] : [];
    promoted.set(rosterId, { uid: c.ref.id, lineagePath: c.lineagePath });
    ordered.push(c);
    pending.delete(rosterId);
    progressed = true;
  }
  if (!progressed) throw new Error("Stuck resolving uplines — possible cycle in roster data.");
}
const nameByUid = new Map([...usersByUid].map(([uid, u]) => [uid, u.name]));
for (const c of ordered) nameByUid.set(c.ref.id, c.rec.name);

console.table(ordered.map(({ rec, total, uplineId }) => ({
  daieId: rec.daieId, name: rec.name, rank: rec.rank, unitId: rec.unitId, status: rec.status,
  upline: uplineId ? nameByUid.get(uplineId) : "(none — unit root)", sales: total.toFixed(2),
})));
if (problems.length) console.table(problems);
if (!apply) {
  console.log(`Dry run: ${ordered.length} record-only profiles would be created. Re-run with --apply.`);
  process.exit(0);
}

for (const { rec, ref, uplineId, lineagePath } of ordered) {
  await ref.set({
    daieId: rec.daieId,
    name: rec.name,
    email: null,
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
    recordOnly: true,
    createdAt: FieldValue.serverTimestamp(),
  });
  await db.collection("roster").doc(rec.rosterId).update({ appAccountUid: ref.id });
}
console.log(`Created ${ordered.length} record-only profiles.`);
