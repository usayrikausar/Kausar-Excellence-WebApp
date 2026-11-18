// Creates "record only" profiles (no login, recordOnly: true) for daie who
// produced in FY24/25 (scripts/fy_history_2425.json) but have no profile in
// the app — mostly perunding who have since expired. Without one, their
// FY24/25 Perancangan counts nowhere and the year-on-year base falls short of
// Kausar's official FY24/25 figure. Agreed with the PIC 2026-11-18.
//
// Unit, rank, dates and STATUS come from the Perunding sheet
// (scripts/roster_import_v2.json); the profile sits under its nearest sheet
// ancestor that has a profile, like create-record-only-profiles-production.mjs.
// fyHistory is written in the same step. Skips anyone who already has a
// profile (by Daie ID, or holding that ID's imported sales). The `roster`
// collection is left alone.
//
// Usage (dry run unless --apply):
//   node scripts/create-record-only-fy-history-production.mjs <service-account.json> [--apply]

import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const [keyPath, flag] = process.argv.slice(2);
const APPLY = flag === "--apply";
if (!keyPath) {
  console.error("Usage: node scripts/create-record-only-fy-history-production.mjs <service-account.json> [--apply]");
  process.exit(1);
}
const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
if (serviceAccount.project_id !== "kausar-excellence-web-app") {
  console.error(`Refusing to run: key belongs to project "${serviceAccount.project_id}", expected "kausar-excellence-web-app".`);
  process.exit(1);
}
initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
const db = getFirestore();

const { fy, records: fyRecords } = JSON.parse(readFileSync(new URL("./fy_history_2425.json", import.meta.url), "utf8"));
const sheet = JSON.parse(readFileSync(new URL("./roster_import_v2.json", import.meta.url), "utf8")).filter((r) => !(r.flags ?? []).includes("synthetic_root"));
const sheetByKod = new Map();
for (const r of sheet) if (r.daieId) sheetByKod.set(r.daieId, [...(sheetByKod.get(r.daieId) ?? []), r]);
const sheetByRosterId = new Map(sheet.map((r) => [r.rosterId, r]));

const usersSnap = await db.collection("users").get();
const users = new Map(usersSnap.docs.map((d) => [d.id, d.data()]));
const uidByDaieId = new Map();
const uidByEmail = new Map();
for (const [uid, u] of users) {
  if (u.isStaff) continue;
  if (u.daieId) uidByDaieId.set(String(u.daieId), uid);
  if (u.email) uidByEmail.set(String(u.email).trim().toLowerCase(), uid);
}
const salesSnap = await db.collection("sales").select("uid", "sourceDaieId").get();
const hasSalesProfile = new Set(salesSnap.docs.map((s) => s.get("sourceDaieId")).filter(Boolean).map(String));

/** Profile uid for a sheet row: by Daie ID, else by email. */
function profileFor(r) {
  return (r.daieId && uidByDaieId.get(r.daieId)) || (r.email && uidByEmail.get(String(r.email).trim().toLowerCase())) || null;
}

const toCreate = [];
const problems = [];
for (const f of fyRecords) {
  if (uidByDaieId.has(f.daieId) || hasSalesProfile.has(f.daieId)) continue; // already has a profile
  const rows = sheetByKod.get(f.daieId) ?? [];
  if (rows.length !== 1) { problems.push({ daieId: f.daieId, name: f.name, why: rows.length ? "Kod on several sheet rows" : "not on the Perunding sheet" }); continue; }
  const rec = rows[0];
  if (profileFor(rec)) { problems.push({ daieId: f.daieId, name: f.name, why: "email belongs to an existing profile" }); continue; }
  toCreate.push({ rec, perancangan: f.perancangan, ref: db.collection("users").doc() });
}
const createdByRosterId = new Map(toCreate.map((c) => [c.rec.rosterId, c]));

// Nearest sheet ancestor that has a profile (existing, or created in this run).
function upline(rec) {
  let cur = rec.uplineRosterId ?? null;
  const seen = new Set();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    if (createdByRosterId.has(cur)) return { created: createdByRosterId.get(cur) };
    const r = sheetByRosterId.get(cur);
    const uid = r ? profileFor(r) : null;
    if (uid) return { uid };
    cur = r?.uplineRosterId ?? null;
  }
  return null;
}

console.log(`${fy}: ${toCreate.length} record-only profiles to create, RM${toCreate.reduce((s, c) => s + c.perancangan, 0).toLocaleString("en-MY", { minimumFractionDigits: 2 })}`);
console.table(toCreate.map(({ rec, perancangan }) => {
  const up = upline(rec);
  const upName = up?.uid ? users.get(up.uid)?.name : up?.created ? up.created.rec.name : "(none — unit root)";
  return { daieId: rec.daieId, name: rec.name, rank: rec.rank, unit: rec.unitId, status: rec.sheetStatus, upline: upName, [fy]: perancangan };
}));
if (problems.length) { console.log("Not created:"); console.table(problems); }
if (!APPLY) {
  console.log("\nDry run — nothing written. Re-run with --apply to write.");
  process.exit(0);
}

const done = new Map(); // rosterId -> { uid, lineagePath }
const pending = [...toCreate];
while (pending.length) {
  const before = pending.length;
  for (let i = pending.length - 1; i >= 0; i--) {
    const { rec, perancangan, ref } = pending[i];
    const up = upline(rec);
    let uplineId = null;
    let lineagePath = [];
    if (up?.created) {
      const parent = done.get(up.created.rec.rosterId);
      if (!parent) continue; // parent not written yet
      uplineId = parent.uid;
      lineagePath = [...parent.lineagePath, parent.uid];
    } else if (up?.uid) {
      uplineId = up.uid;
      lineagePath = [...(users.get(up.uid)?.lineagePath ?? []), up.uid];
    }
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
      dateJoined: rec.dateJoined ?? null,
      sheetStatus: rec.sheetStatus ?? null,
      fyHistory: { [fy]: { perancangan } },
      recordOnly: true,
      createdAt: FieldValue.serverTimestamp(),
    });
    done.set(rec.rosterId, { uid: ref.id, lineagePath });
    pending.splice(i, 1);
  }
  if (pending.length === before) throw new Error(`Stuck: ${pending.length} profiles with an unresolved upline chain.`);
}
console.log(`Created ${done.size} record-only profiles.`);
