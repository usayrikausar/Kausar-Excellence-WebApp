// Writes earlier-FY Perancangan onto live `users` docs as
// fyHistory["FY24/25"] = { perancangan }, for the year-on-year comparison
// (src/lib/yoy.ts). Input: scripts/fy_history_2425.json from
// scripts/parse_fy_history.py. Matches by Daie ID only; anything that doesn't
// match exactly one daie profile is reported, never guessed. Re-running is
// safe: it overwrites the same field, and clears it on profiles no longer in
// the sheet.
//
// Usage (dry run unless --apply):
//   node scripts/import-fy-history-production.mjs <service-account.json> [--apply]

import { readFileSync } from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldPath, FieldValue } from "firebase-admin/firestore";

const [keyPath, flag] = process.argv.slice(2);
const APPLY = flag === "--apply";
if (!keyPath) {
  console.error("Usage: node scripts/import-fy-history-production.mjs <service-account.json> [--apply]");
  process.exit(1);
}
const serviceAccount = JSON.parse(readFileSync(keyPath, "utf8"));
if (serviceAccount.project_id !== "kausar-excellence-web-app") {
  console.error(`Refusing to run: key belongs to project "${serviceAccount.project_id}", expected "kausar-excellence-web-app".`);
  process.exit(1);
}
initializeApp({ credential: cert(serviceAccount), projectId: serviceAccount.project_id });
const db = getFirestore();

const { fy, records } = JSON.parse(readFileSync(new URL("./fy_history_2425.json", import.meta.url), "utf8"));
const snap = await db.collection("users").get();
const byDaieId = new Map();
for (const d of snap.docs) {
  const u = d.data();
  if (u.isStaff || !u.daieId) continue;
  byDaieId.set(String(u.daieId), [...(byDaieId.get(String(u.daieId)) ?? []), d]);
}

// Fallback: the profile that already holds this Daie ID's imported sales
// (sales.sourceDaieId) — e.g. a KDE company code whose sales sit on the
// KDE's own profile under another ID.
const salesSnap = await db.collection("sales").select("uid", "sourceDaieId").get();
const uidsBySourceId = new Map();
for (const s of salesSnap.docs) {
  const id = s.get("sourceDaieId");
  if (id) uidsBySourceId.set(String(id), new Set([...(uidsBySourceId.get(String(id)) ?? []), s.get("uid")]));
}

// Last fallback: the same person re-registered under a new Kod — their
// Perunding-sheet email belongs to an existing profile with the same name.
const sheet = JSON.parse(readFileSync(new URL("./roster_import_v2.json", import.meta.url), "utf8"));
const normName = (s) => String(s ?? "").toUpperCase().replace(/[^A-Z]/g, "");
function viaEmail(daieId) {
  const rows = sheet.filter((x) => x.daieId === daieId && x.email);
  if (rows.length !== 1) return null;
  const email = rows[0].email.trim().toLowerCase();
  const owners = snap.docs.filter((d) => !d.get("isStaff") && String(d.get("email") ?? "").trim().toLowerCase() === email);
  return owners.length === 1 && normName(owners[0].get("name")) === normName(rows[0].name) ? owners[0] : null;
}

const writes = new Map(); // uid -> perancangan
const viaNewKod = [];
const problems = [];
for (const r of records) {
  const docs = byDaieId.get(r.daieId) ?? [];
  const viaSales = [...(uidsBySourceId.get(r.daieId) ?? [])];
  let uid = docs.length === 1 ? docs[0].id : docs.length === 0 && viaSales.length === 1 ? viaSales[0] : null;
  if (!uid && docs.length === 0 && viaSales.length === 0) {
    const owner = viaEmail(r.daieId);
    if (owner) {
      uid = owner.id;
      viaNewKod.push({ oldKod: r.daieId, newKod: owner.get("daieId"), name: r.name, perancangan: r.perancangan });
    }
  }
  if (uid) writes.set(uid, Math.round(((writes.get(uid) ?? 0) + r.perancangan) * 100) / 100);
  else problems.push({ daieId: r.daieId, name: r.name, perancangan: r.perancangan, why: docs.length ? `${docs.length} profiles share this ID` : "no profile in the app" });
}
if (viaNewKod.length) { console.log("Re-registered under a new Kod (FY24/25 goes to the current profile):"); console.table(viaNewKod); }
const stale = snap.docs.filter((d) => d.get("fyHistory")?.[fy] && !writes.has(d.id));

const total = records.reduce((s, r) => s + r.perancangan, 0);
const matched = [...writes.values()].reduce((s, v) => s + v, 0);
console.log(`${fy}: ${records.length} daie in the sheet, RM${total.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`);
console.log(`Matched to a profile: ${writes.size} (RM${matched.toLocaleString("en-MY", { minimumFractionDigits: 2 })}) | not matched: ${problems.length} | stale to clear: ${stale.length}`);
if (problems.length) console.table(problems);

if (!APPLY) {
  console.log("\nDry run — nothing written. Re-run with --apply to write.");
  process.exit(0);
}

const ops = [
  ...[...writes].map(([uid, perancangan]) => (b) => b.update(db.collection("users").doc(uid), new FieldPath("fyHistory", fy), { perancangan })),
  ...stale.map((d) => (b) => b.update(d.ref, new FieldPath("fyHistory", fy), FieldValue.delete())),
];
for (let i = 0; i < ops.length; i += 400) {
  const batch = db.batch();
  for (const op of ops.slice(i, i + 400)) op(batch);
  await batch.commit();
}
console.log(`Wrote ${writes.size}, cleared ${stale.length}.`);
