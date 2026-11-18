// Syncs live `users` with Kausar's "Perunding Kausar Group" Google Sheet
// (parsed by scripts/parse_perunding_whole.py into roster_import_v2.json).
// Agreed with the PIC 2026-11-18:
//   1. The sheet's STATUS column decides who is a current perunding:
//      EXPIRED = expired; ACTIVE / GENERATE / INACTIVE = current. Written to
//      users.sheetStatus (isActiveStatus reads it), with dateJoined (the
//      sheet's "Bulan & Tahun", used for recruitment counts), dateExpiry and
//      region.
//   2. Every non-expired person in the sheet who has no login yet gets one
//      (their sheet email, no password — they use "Forgot password?").
//
// Matching is by Daie ID (then by email), NOT by roster row: rows with a
// duplicate or missing Kod are keyed by sheet row number, which shifts every
// time the sheet changes, so the old roster-id based scripts
// (update-roster-production.mjs + promote-newly-active-production.mjs) would
// create second logins for people who already have one. This script leaves
// the `roster` collection alone (the app never reads it).
//
// Never changes rank, unit, upline, subscriptionStatus or admin flags of an
// existing account — differences are only reported for a human to decide.
//
// Usage (dry run unless --apply):
//   node scripts/sync-perunding-sheet-production.mjs <service-account.json> [--apply]

import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const [keyPath, flag] = process.argv.slice(2);
const APPLY = flag === "--apply";
if (!keyPath) {
  console.error("Usage: node scripts/sync-perunding-sheet-production.mjs <service-account.json> [--apply]");
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
const norm = (e) => (e ?? "").trim().toLowerCase();

const records = JSON.parse(readFileSync(new URL("./roster_import_v2.json", import.meta.url), "utf8")).filter(
  (r) => !(r.flags ?? []).includes("synthetic_root"),
);
const usersSnap = await db.collection("users").get();
const users = new Map(usersSnap.docs.map((d) => [d.id, d.data()]));

// daieId -> uids (staff excluded); email -> uid
const uidsByDaieId = new Map();
const uidByEmail = new Map();
for (const [uid, u] of users) {
  if (u.isStaff) continue;
  if (u.daieId) uidsByDaieId.set(String(u.daieId), [...(uidsByDaieId.get(String(u.daieId)) ?? []), uid]);
  if (u.email) uidByEmail.set(norm(u.email), uid);
}
// Sheet daieIds that appear on more than one row can't identify one person.
const sheetKodCount = new Map();
for (const r of records) if (r.daieId) sheetKodCount.set(r.daieId, (sheetKodCount.get(r.daieId) ?? 0) + 1);

function matchByDaieId(r) {
  if (!r.daieId || sheetKodCount.get(r.daieId) !== 1) return null;
  const uids = uidsByDaieId.get(r.daieId) ?? [];
  if (uids.length === 1) return uids[0];
  if (uids.length > 1) {
    // Several accounts share the code (e.g. a company code). Prefer the email match, else the record-only profile.
    const byEmail = r.email ? uidByEmail.get(norm(r.email)) : null;
    if (byEmail && uids.includes(byEmail)) return byEmail;
    return uids.find((uid) => users.get(uid)?.recordOnly) ?? uids[0];
  }
  return null;
}

const byRosterId = new Map(records.map((r) => [r.rosterId, r]));
// Each account is matched to at most one sheet row: Daie ID matches first,
// then email matches only for accounts still unmatched (a person can appear
// on an old and a new row with the same email).
const matched = new Map(); // rosterId -> uid
const taken = new Set();
for (const r of records) {
  const uid = matchByDaieId(r);
  if (uid && !taken.has(uid)) { matched.set(r.rosterId, uid); taken.add(uid); }
}
const emailMatchedRows = new Set(); // rows that share an email with an account matched to another row
for (const r of records) {
  if (matched.has(r.rosterId) || !r.email) continue;
  const uid = uidByEmail.get(norm(r.email));
  if (!uid) continue;
  if (taken.has(uid)) { emailMatchedRows.add(r.rosterId); continue; }
  matched.set(r.rosterId, uid);
  taken.add(uid);
}
const matchedUids = new Set(matched.values());

// --- 1. Field sync for existing accounts ---
const updates = [];
const rankDiffs = [];
const unitDiffs = [];
let becomeExpired = 0;
for (const [rosterId, uid] of matched) {
  const r = byRosterId.get(rosterId);
  const u = users.get(uid);
  const patch = {};
  if ((u.sheetStatus ?? null) !== (r.sheetStatus ?? null)) patch.sheetStatus = r.sheetStatus ?? null;
  if ((u.dateJoined ?? null) !== (r.dateJoined ?? null)) patch.dateJoined = r.dateJoined ?? null;
  // Only overwrite an end date / region when the sheet actually has one.
  if (r.dateExpiry && u.dateExpiry !== r.dateExpiry) patch.dateExpiry = r.dateExpiry;
  if (r.region && u.region !== r.region && u.region == null) patch.region = r.region;
  if (Object.keys(patch).length) updates.push({ uid, patch });
  if (r.sheetStatus === "expired" && u.sheetStatus !== "expired") becomeExpired++;
  if (u.rank !== r.rank) rankDiffs.push({ daieId: r.daieId, name: r.name, app: u.rank, sheet: r.rank });
  if (u.unitId !== r.unitId) unitDiffs.push({ daieId: r.daieId, name: r.name, app: u.unitId, sheet: r.unitId });
}

// --- 2. New logins for non-expired people with no account ---
// Rows whose email already belongs to a matched account are the same person on another row — never a new login.
const candidates = records.filter((r) => r.status === "active" && !matched.has(r.rosterId) && !emailMatchedRows.has(r.rosterId));
const usedEmails = new Set([...users.values()].map((u) => norm(u.email)).filter(Boolean));
const skipped = [];
const toCreate = new Map();
for (const r of candidates) {
  const email = norm(r.email);
  if (!r.daieId || sheetKodCount.get(r.daieId) !== 1) { skipped.push({ ...brief(r), why: "missing or duplicate Kod" }); continue; }
  if (!email || !EMAIL_RE.test(email)) { skipped.push({ ...brief(r), why: "no valid email" }); continue; }
  if (usedEmails.has(email)) { skipped.push({ ...brief(r), why: "email already used by another account" }); continue; }
  usedEmails.add(email);
  toCreate.set(r.rosterId, r);
}
function brief(r) {
  return { daieId: r.daieId, name: r.name, unitId: r.unitId, sheetStatus: r.sheetStatus };
}

// Nearest ancestor (by sheet upline) that has an account or is being created now.
function effectiveUpline(rosterId) {
  let cur = byRosterId.get(rosterId)?.uplineRosterId ?? null;
  const seen = new Set();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    if (matched.has(cur) || toCreate.has(cur)) return cur;
    cur = byRosterId.get(cur)?.uplineRosterId ?? null;
  }
  return null;
}

console.log(`Sheet records: ${records.length} | matched to an existing account: ${matched.size} (${matchedUids.size} accounts) | accounts not in the sheet: ${[...users.entries()].filter(([uid, u]) => !u.isStaff && !matchedUids.has(uid)).length}`);
console.log(`Field updates: ${updates.length} accounts (become expired via STATUS: ${becomeExpired})`);
console.log(`New logins: ${toCreate.size} | skipped: ${skipped.length}`);
const createRows = [...toCreate.values()].map((r) => {
  const up = effectiveUpline(r.rosterId);
  const upRec = up ? byRosterId.get(up) : null;
  return { daieId: r.daieId, name: r.name, unitId: r.unitId, rank: r.rank, sheetStatus: r.sheetStatus, upline: upRec ? `${upRec.daieId} ${upRec.name}` : "(none — root)" };
});
console.table(createRows);
if (skipped.length) { console.log("Skipped:"); console.table(skipped); }
console.log(`Rank differs from the sheet (NOT changed): ${rankDiffs.length}`);
console.table(rankDiffs.slice(0, 80));
console.log(`Unit differs from the sheet (NOT changed): ${unitDiffs.length}`);
console.table(unitDiffs);

if (!APPLY) {
  console.log("\nDry run — nothing written. Re-run with --apply to write.");
  process.exit(0);
}

// --- Apply ---
for (let i = 0; i < updates.length; i += 400) {
  const batch = db.batch();
  for (const { uid, patch } of updates.slice(i, i + 400)) batch.set(db.collection("users").doc(uid), patch, { merge: true });
  await batch.commit();
}
console.log(`Updated ${updates.length} accounts.`);

const createdUid = new Map(); // rosterId -> { uid, lineagePath }
const uplineInfo = (rosterId) => {
  if (createdUid.has(rosterId)) return createdUid.get(rosterId);
  const uid = matched.get(rosterId);
  return uid ? { uid, lineagePath: users.get(uid)?.lineagePath ?? [] } : null;
};
const pending = new Map(toCreate);
let created = 0;
while (pending.size) {
  let progressed = false;
  for (const [rosterId, r] of pending) {
    const up = effectiveUpline(rosterId);
    if (up && !uplineInfo(up)) continue; // upline is in this batch and not created yet
    const info = up ? uplineInfo(up) : null;
    const email = norm(r.email);
    let authUser;
    try {
      authUser = await auth.createUser({ email, displayName: r.name });
    } catch (err) {
      console.log(`  skipped ${r.daieId} ${r.name}: ${err.code}`);
      pending.delete(rosterId);
      progressed = true;
      continue;
    }
    await auth.setCustomUserClaims(authUser.uid, { rank: r.rank, unitId: r.unitId, isGroupAdmin: false });
    const lineagePath = info ? [...info.lineagePath, info.uid] : [];
    await db.collection("users").doc(authUser.uid).set({
      daieId: r.daieId,
      name: r.name,
      email,
      rank: r.rank,
      unitId: r.unitId,
      region: r.region ?? "central",
      uplineId: info ? info.uid : null,
      lineagePath,
      structureType: "TS",
      subscriptionStatus: "active",
      isGroupAdmin: false,
      isLdpMember: r.isLdpMember === true,
      dateLicensed: r.dateLicensed ?? null,
      dateExpiry: r.dateExpiry ?? null,
      dateJoined: r.dateJoined ?? null,
      sheetStatus: r.sheetStatus ?? null,
      createdAt: FieldValue.serverTimestamp(),
    });
    createdUid.set(rosterId, { uid: authUser.uid, lineagePath });
    pending.delete(rosterId);
    created++;
    progressed = true;
  }
  if (!progressed) throw new Error(`Stuck: ${pending.size} records with an unresolved upline chain.`);
}
console.log(`Created ${created} logins (no password; "Forgot password?").`);
