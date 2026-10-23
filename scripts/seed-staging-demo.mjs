// Fills the STAGING project with made-up demo data so leaders can see how
// the app looks with a full team, without any real daie's data:
//   - 5 units, each with 10 demo daie (1 KDE, 2 DPM, 7 DM) — "DEMO-KWM-01" etc.
//   - FY25/26 sales + collections (Jul 2025 to today), so Home, Reports and
//     the Konvensyen figures have something to show — uneven per unit/month
//   - the last 4 months of activities and PIPPPAS prospects, planned so the
//     traffic light shows a real mix of Green / Amber / Red / Black
//   - goals, Al Wasitah status, contests, trainings + attendance, awards,
//     bulletins, and a few licences expired / expiring (renewal reminder)
//   - logins: 1 HQ admin (staff) + the KDE, one DPM and one DM of each unit.
//     Each gets its own random password, written to a CSV in Downloads —
//     never committed.
//
// Usage (from the project folder):
//   node scripts/seed-staging-demo.mjs "<path to the staging service-account key>" [--reset]
// --reset wipes staging first (every collection below + every demo login),
// so the script can be re-run for a clean slate. Refuses to touch any
// project whose id doesn't start with "staging-".

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

const [keyPath, ...flags] = process.argv.slice(2);
if (!keyPath) {
  console.error('Usage: node scripts/seed-staging-demo.mjs "<staging key.json>" [--reset]');
  console.error("   or: node scripts/seed-staging-demo.mjs --emulator [--reset]   (local emulators on 8080/9099)");
  process.exit(1);
}
// --emulator: same demo data into the local Emulator Suite, for checking
// screens before a staging deploy.
const EMULATOR = keyPath === "--emulator";
let key;
if (EMULATOR) {
  process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
  key = { project_id: "demo-kausar-group" };
} else {
  key = JSON.parse(fs.readFileSync(keyPath, "utf8"));
  if (!String(key.project_id).startsWith("staging-")) {
    console.error(`Refusing to run: ${key.project_id} is not a staging project.`);
    process.exit(1);
  }
}
const RESET = flags.includes("--reset") || EMULATOR;

initializeApp(EMULATOR ? { projectId: key.project_id } : { credential: cert(key), projectId: key.project_id });
const auth = getAuth();
const db = getFirestore();

const EMAIL_DOMAIN = "demo.kausar.test";
const COLLECTIONS = [
  "users", "units", "sales", "collections", "activities", "prospects", "goals", "wasitahSubscription",
  "contests", "contestProgress", "trainings", "trainingAttendance", "achievements", "bulletins", "marketing", "loginLinks", "meta",
];

// --- Seeded RNG so a re-run gives the same demo picture ---------------------
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261023);
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const choice = (arr) => arr[randInt(0, arr.length - 1)];
const chance = (p) => rand() < p;

const TODAY = new Date();
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const capToday = (d) => (d > TODAY ? new Date(TODAY) : d);
function randomDayInMonth(monthKey) {
  const [y, m] = monthKey.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return capToday(new Date(Date.UTC(y, m - 1, randInt(1, last), 4)));
}
function monthsBetween(startKey, endKey) {
  const out = [];
  let [y, m] = startKey.split("-").map(Number);
  while (`${y}-${String(m).padStart(2, "0")}` <= endKey) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}
const THIS_MONTH = iso(TODAY).slice(0, 7);
const FY_MONTHS = monthsBetween("2025-07", THIS_MONTH < "2026-12" ? THIS_MONTH : "2026-12");
const RECENT_MONTHS = FY_MONTHS.slice(-4);

// --- Names ------------------------------------------------------------------
const MALE = ["Ahmad Faizal", "Muhammad Hafiz", "Amir Hakim", "Azman Rizal", "Ridzuan Shah", "Zulkifli Anuar", "Firdaus Iskandar", "Hisham Danial", "Nazri Fitri", "Idris Zaki", "Shahrul Aizat", "Farid Hakimi", "Rosli Kamal", "Fadzil Imran", "Haziq Irfan"];
const FEMALE = ["Siti Aisyah", "Nurul Huda", "Farah Diyana", "Liyana Sofea", "Nadia Balqis", "Aina Shafiqah", "Zaleha Kartini", "Halimah Suhaila", "Norlela Azizah", "Fatimah Zahra", "Nabila Husna", "Amira Syafiqah", "Hasnah Rohana", "Salmah Aminah", "Izzati Hana"];
const FATHERS = ["Ahmad", "Ismail", "Hassan", "Rahman", "Yusof", "Osman", "Abdullah", "Zainal", "Kassim", "Salleh", "Hamid", "Rashid", "Karim", "Ibrahim", "Mansor"];
const usedNames = new Set();
function demoName() {
  for (;;) {
    const male = chance(0.5);
    const name = `${choice(male ? MALE : FEMALE)} ${male ? "bin" : "binti"} ${choice(FATHERS)}`;
    if (!usedNames.has(name)) {
      usedNames.add(name);
      return name;
    }
  }
}

// --- Units ------------------------------------------------------------------
// `pace` makes the units differ on the Home graph instead of five equal bars.
// `kde`: the real Ketua Agensi's name on the demo KDE account (agreed
// 2026-10-23), and one login per person — Kausar Wealth's two heads share one
// KDE account, as on live (create-linked-logins-production.mjs).
const UNITS = [
  { id: "kausar-wealth", name: "Kausar Wealth", short: "kwm", pace: 1.6, kde: { name: "Kham & Suzana", logins: [["kham", "Kham"], ["suzana", "Suzana"]] } },
  { id: "kausar-global", name: "Kausar Global", short: "kg", pace: 1.0, kde: { name: "Umi", logins: [["umi", "Umi"]] } },
  { id: "kausar-aspire", name: "Kausar Aspire", short: "ka", pace: 0.75, kde: { name: "Usayri", logins: [["usayri", "Usayri"]] } },
  { id: "kausar-intisar", name: "Kausar Intisar", short: "ki", pace: 1.2, kde: { name: "Intan", logins: [["intan", "Intan"]] } },
  { id: "kausar-nusrah", name: "Kausar Nusrah", short: "kn", pace: 0.6, kde: { name: "Shiqien", logins: [["shiqien", "Shiqien"]] } },
];
const REGIONS = ["east-coast", "central", "northern", "southern", "borneo"];

// --- Batched writes ---------------------------------------------------------
let batch = db.batch();
let ops = 0;
const pending = [];
function put(ref, data) {
  batch.set(ref, data);
  if (++ops >= 400) {
    pending.push(batch.commit());
    batch = db.batch();
    ops = 0;
  }
}
async function flush() {
  if (ops > 0) pending.push(batch.commit());
  await Promise.all(pending);
  batch = db.batch();
  ops = 0;
  pending.length = 0;
}

// --- Logins -----------------------------------------------------------------
const logins = [];
function makePassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 10; i++) s += alphabet[crypto.randomInt(alphabet.length)];
  return s;
}
async function createLogin({ email, name, claims, role, unitName }) {
  const password = makePassword();
  const user = await auth.createUser({ email, password, displayName: name });
  await auth.setCustomUserClaims(user.uid, claims);
  logins.push({ role, unit: unitName, name, email, password });
  return user.uid;
}

/** A second login that opens an existing account (loginLinks + profileUid claim — see lib/auth/session.ts). */
async function createLinkedLogin({ email, name, profileUid, claims, role, unitName }) {
  const authUid = await createLogin({ email, name, claims: { ...claims, profileUid }, role, unitName });
  put(db.collection("loginLinks").doc(authUid), { profileUid, email, createdAt: FieldValue.serverTimestamp() });
}

async function reset() {
  console.log("Wiping existing demo data…");
  for (const c of COLLECTIONS) await db.recursiveDelete(db.collection(c));
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    const demo = page.users.filter((u) => u.email?.endsWith(`@${EMAIL_DOMAIN}`)).map((u) => u.uid);
    if (demo.length) await auth.deleteUsers(demo);
    pageToken = page.pageToken;
  } while (pageToken);
}

// --- Data generators ----------------------------------------------------------
const stats = { daie: 0, sales: 0, salesRM: 0, collections: 0, activities: 0, prospects: 0 };

function addSale(daie, date, sale) {
  const ref = db.collection("sales").doc();
  put(ref, {
    uid: daie.uid,
    category: sale.category,
    subCategory: sale.subCategory,
    amount: sale.amount,
    count: sale.count,
    date: Timestamp.fromDate(date),
    createdAt: Timestamp.fromDate(date),
    unitId: daie.unitId,
    ...(sale.prospectId ? { prospectId: sale.prospectId } : {}),
  });
  stats.sales++;
  stats.salesRM += sale.amount ?? 0;
  if (sale.amount && sale.category !== "pengurusan" && chance(0.75)) {
    const collected = chance(0.65) ? sale.amount : Math.round(sale.amount / 2);
    const paidOn = capToday(addDays(date, randInt(0, 20)));
    put(db.collection("collections").doc(), {
      uid: daie.uid,
      saleRef: ref.id,
      amountCollected: collected,
      date: Timestamp.fromDate(paidOn),
      createdAt: Timestamp.fromDate(paidOn),
      ...(sale.prospectId ? { prospectId: sale.prospectId } : {}),
    });
    stats.collections++;
  }
  return ref.id;
}

function randomSale() {
  const r = rand();
  if (r < 0.62) return { category: "perancangan", subCategory: chance(0.75) ? "wasiat" : "hibah", amount: randInt(15, 80) * 100, count: null };
  if (r < 0.82) return { category: "pengurusan", subCategory: chance(0.6) ? "berlian" : "mutiara", amount: null, count: chance(0.8) ? 1 : 2 };
  if (r < 0.9) return { category: "kesPusaka", subCategory: "besar", amount: randInt(80, 250) * 100, count: null };
  return { category: "kesPusaka", subCategory: "kecil", amount: randInt(8, 30) * 100, count: null };
}

function seedSales(daie, pace) {
  for (const month of FY_MONTHS) {
    // Recent months get their sales through the prospect funnel (seedRecentMonths).
    if (RECENT_MONTHS.includes(month)) continue;
    // ~0–3 sales a month, more for stronger daie/units; quiet months happen.
    const expected = 1.3 * pace * daie.drive;
    let n = 0;
    for (let i = 0; i < 4; i++) if (chance(Math.min(0.9, expected / 4))) n++;
    for (let i = 0; i < n; i++) {
      const signedOn = randomDayInMonth(month);
      // About half of older sales come with their client record (Clients list).
      if (chance(0.55)) seedPastClient(daie, signedOn, randomSale());
      else addSale(daie, signedOn, randomSale());
    }
  }
}

/** A finished case from earlier in the FY: contact → … → Present Solution (sale) → after-sale steps, all done. */
function seedPastClient(daie, signedOn, sale) {
  const ref = db.collection("prospects").doc();
  const before = ["initial_contact", "present", "prepare_solution", "present_solution"];
  const after = ["signing_akad", "safekeeping", "video_delivery"];
  const dates = new Map();
  let d = addDays(signedOn, -randInt(10, 40));
  for (const stage of before.slice(0, -1)) {
    dates.set(stage, d);
    d = addDays(d, randInt(3, 10));
  }
  dates.set("present_solution", signedOn);
  d = signedOn;
  for (const stage of after) {
    d = capToday(addDays(d, randInt(3, 15)));
    dates.set(stage, d);
  }
  const linkedSaleId = addSale(daie, signedOn, { ...sale, prospectId: ref.id });
  for (const stage of [...before, ...after]) {
    const at = dates.get(stage);
    put(ref.collection("updates").doc(), { uid: daie.uid, stage, note: stage === "initial_contact" ? "Hubungan pertama." : choice(STAGE_NOTES), nextFollowUpDate: null, date: iso(at), createdAt: Timestamp.fromDate(at) });
  }
  const male = chance(0.5);
  put(ref, {
    ...prospectProfile(daie, `${choice(male ? MALE : FEMALE)} ${male ? "bin" : "binti"} ${choice(FATHERS)}`),
    stage: "video_delivery",
    status: "closed_won",
    nextFollowUpDate: null,
    linkedSaleId,
    createdAt: Timestamp.fromDate(dates.get("initial_contact")),
    updatedAt: Timestamp.fromDate(dates.get("video_delivery")),
  });
  stats.prospects++;
}

function prospectProfile(daie, name) {
  return {
    uid: daie.uid,
    name,
    phone: `01${randInt(0, 9)}-${randInt(1000000, 9999999)}`,
    details: null,
    source: choice(SOURCES),
    age: randInt(25, 65),
    birthdate: null,
    email: null,
    profession: choice(["management", "executive", "business_owner", "self_employed", "retired"]),
    professionOther: null,
    governmentTahap: "not_applicable",
    organizationName: null,
    incomeBracket: choice(["below_5k", "5k_10k", "10k_15k", "15k_20k"]),
    importantDate: null,
    importantDateLabel: null,
    faraidNotes: null,
  };
}

const REACH_METHODS = ["booth", "live_tiktok", "social_media", "direct_approach", "talk", "project200", "other"];
const ACTIVITY_NOTES = ["Booth di Mydin", "Live TikTok malam Jumaat", "Taklimat di surau taman", "Panggilan susulan", "Program komuniti", null];
// Stages after Initial Contact, in order (see PIPPPAS_STAGES in src/lib/types.ts).
const LATER_STAGES = ["present", "prepare_solution", "present_solution", "signing_akad", "safekeeping", "video_delivery"];
const CONTINUE_PROB = [0.6, 0.65, 0.7, 0.75, 0.8, 0.8];
const SOURCES = ["booth", "live_tiktok", "social_media", "direct_approach", "referral", "talk", "project200"];
const STAGE_NOTES = ["Susulan panggilan telefon.", "Sesi pertemuan dengan klien.", "Hantar cadangan perancangan.", "Klien minta masa untuk berbincang dengan keluarga.", "Klien setuju, tunggu dokumen."];

// Traffic-light targets, mirrored from src/lib/scoring.ts (weekly × days-in-month / 7).
function monthTargets(month) {
  const [y, m] = month.split("-").map(Number);
  const weeks = new Date(y, m, 0).getDate() / 7;
  return { training: Math.round(weeks), reach: Math.round(30 * weeks), presentations: Math.round(6 * weeks), prosper: 2, sales: 10_000 };
}

// Each demo daie gets a planned result per recent month, so the traffic light
// shows a real mix: ~35% Green (4–5 of 5), ~30% Amber (3), ~20% Red (2),
// ~15% Black (0–1). Presentations (27/month) is the expensive criterion to
// fake, so it's only hit in some Green months.
const CHEAP = ["training", "reach", "prosper", "sales"];
function planMonth() {
  const r = rand();
  const pick = (n) => [...CHEAP].sort(() => rand() - 0.5).slice(0, n);
  if (r < 0.35) return new Set([...CHEAP, ...(chance(0.3) ? ["presentations"] : [])]);
  if (r < 0.65) return new Set(pick(3));
  if (r < 0.85) return new Set(pick(2));
  return new Set(pick(chance(0.5) ? 1 : 0));
}

// RM counted toward the sales criterion per daie per month (perancangan + kesPusaka only).
const countedRM = new Map();
function countsTowardSales(sale) {
  return sale.amount != null && sale.category !== "pengurusan";
}

function addActivity(daie, month, data) {
  put(db.collection("activities").doc(), { uid: daie.uid, note: null, reachCount: 0, ...data, date: iso(randomDayInMonth(month)), createdAt: FieldValue.serverTimestamp() });
  stats.activities++;
}

function seedRecentMonths(daie, partners) {
  // Plan every month first: a funnel sale can land in the following month,
  // and funnelSale() needs to know that month's plan.
  daie.plan = Object.fromEntries(RECENT_MONTHS.map((m) => [m, planMonth()]));
  for (const month of RECENT_MONTHS) {
    const plan = daie.plan[month];
    const t = monthTargets(month);

    const trainings = plan.has("training") ? t.training + randInt(0, 1) : randInt(0, t.training - 2);
    for (let i = 0; i < trainings; i++) addActivity(daie, month, { type: "training", note: choice(["Sesi KWEB", "Mentoring dengan upline", "Latihan produk", null]) });

    // Reach: hit = comfortably over target; miss = clearly under.
    let reachLeft = plan.has("reach") ? t.reach + randInt(5, 40) : randInt(20, Math.round(t.reach * 0.7));
    while (reachLeft > 0) {
      const n = Math.min(reachLeft, randInt(8, 40));
      addActivity(daie, month, { type: choice(REACH_METHODS), reachCount: n, note: choice(ACTIVITY_NOTES) });
      reachLeft -= n;
    }

    const invites = plan.has("prosper") ? randInt(2, 3) : randInt(0, 1);
    for (let i = 0; i < invites; i++) addActivity(daie, month, { type: "prosper_invite" });

    if (partners.length && chance(0.5)) {
      const p = choice(partners);
      addActivity(daie, month, { type: "jfw", note: "Jumpa klien bersama", withUid: p.uid, withName: p.name });
    }

    seedFunnel(daie, month);
    // A month planned to hit sales gets one solid case on top of the funnel.
    if (plan.has("sales")) {
      const already = countedRM.get(`${daie.uid}|${month}`) ?? 0;
      if (already < t.sales) seedRecentClient(daie, month, Math.max(t.sales - already, randInt(60, 120) * 100));
    }
    // Presentations: enough prospects reaching Present this month to clear the target.
    if (plan.has("presentations")) for (let i = 0; i < t.presentations; i++) seedPresentedProspect(daie, month);
  }
}

/** A sale for the funnel that won't accidentally push a month planned as "missed sales" over RM10k. */
function funnelSale(daie, date) {
  const month = iso(date).slice(0, 7);
  const sale = randomSale();
  const k = `${daie.uid}|${month}`;
  const plannedMiss = daie.plan?.[month] && !daie.plan[month].has("sales");
  if (countsTowardSales(sale) && plannedMiss && (countedRM.get(k) ?? 0) + sale.amount >= 10_000) {
    return { category: "pengurusan", subCategory: "berlian", amount: null, count: 1 };
  }
  return sale;
}

function addCountedSale(daie, date, sale) {
  if (countsTowardSales(sale)) {
    const k = `${daie.uid}|${iso(date).slice(0, 7)}`;
    countedRM.set(k, (countedRM.get(k) ?? 0) + sale.amount);
  }
  return addSale(daie, date, sale);
}

function writeUpdates(ref, daie, stageDates) {
  for (const [stage, at] of stageDates) {
    put(ref.collection("updates").doc(), { uid: daie.uid, stage, note: stage === "initial_contact" ? "Hubungan pertama." : choice(STAGE_NOTES), nextFollowUpDate: null, date: iso(at), createdAt: Timestamp.fromDate(at) });
  }
}

function randomProspectName() {
  const male = chance(0.5);
  return `${choice(male ? MALE : FEMALE)} ${male ? "bin" : "binti"} ${choice(FATHERS)}`;
}

/** The month's ordinary pipeline: a handful of prospects walking the PIPPPAS steps, some to a sale. */
function seedFunnel(daie, month) {
  for (let n = randInt(3, 6); n > 0; n--) {
    const ref = db.collection("prospects").doc();
    const stages = ["initial_contact"];
    for (let i = 0; i < LATER_STAGES.length && chance(CONTINUE_PROB[i]); i++) stages.push(LATER_STAGES[i]);
    let cursor = randomDayInMonth(month);
    const first = new Date(cursor);
    const stageDates = [];
    let linkedSaleId = null;
    stages.forEach((stage, i) => {
      if (i > 0) cursor = capToday(addDays(cursor, randInt(2, 8)));
      stageDates.push([stage, new Date(cursor)]);
      if (stage === "present_solution" && chance(0.85)) linkedSaleId = addCountedSale(daie, new Date(cursor), { ...funnelSale(daie, cursor), prospectId: ref.id });
    });
    writeUpdates(ref, daie, stageDates);
    const finalStage = stages[stages.length - 1];
    // A client (sale linked) is never "lost" — they're just mid after-sale.
    const status = finalStage === "video_delivery" ? "closed_won" : !linkedSaleId && chance(0.12) ? "closed_lost" : "active";
    put(ref, {
      ...prospectProfile(daie, randomProspectName()),
      stage: finalStage,
      status,
      nextFollowUpDate: status === "active" ? iso(addDays(TODAY, randInt(1, 21))) : null,
      linkedSaleId,
      createdAt: Timestamp.fromDate(first),
      updatedAt: Timestamp.fromDate(cursor),
    });
    stats.prospects++;
  }
}

/** A case signed this month big enough to clear RM10k, now somewhere in the after-sale steps. */
function seedRecentClient(daie, month, amount) {
  const ref = db.collection("prospects").doc();
  const signedOn = randomDayInMonth(month);
  const stageDates = [];
  let d = addDays(signedOn, -randInt(8, 25));
  for (const stage of ["initial_contact", "present", "prepare_solution"]) {
    stageDates.push([stage, d]);
    d = addDays(d, randInt(2, 7));
  }
  stageDates.push(["present_solution", signedOn]);
  const after = ["signing_akad", "safekeeping", "video_delivery"].slice(0, randInt(0, 3));
  d = signedOn;
  for (const stage of after) {
    d = capToday(addDays(d, randInt(2, 8)));
    stageDates.push([stage, d]);
  }
  const sale = chance(0.8)
    ? { category: "perancangan", subCategory: chance(0.7) ? "wasiat" : "hibah", amount: Math.ceil(amount / 100) * 100, count: null }
    : { category: "kesPusaka", subCategory: "besar", amount: Math.ceil(amount / 100) * 100, count: null };
  const linkedSaleId = addCountedSale(daie, signedOn, { ...sale, prospectId: ref.id });
  writeUpdates(ref, daie, stageDates);
  const [finalStage, finalAt] = stageDates[stageDates.length - 1];
  put(ref, {
    ...prospectProfile(daie, randomProspectName()),
    stage: finalStage,
    status: finalStage === "video_delivery" ? "closed_won" : "active",
    nextFollowUpDate: finalStage === "video_delivery" ? null : iso(addDays(TODAY, randInt(1, 14))),
    linkedSaleId,
    createdAt: Timestamp.fromDate(stageDates[0][1]),
    updatedAt: Timestamp.fromDate(finalAt),
  });
  stats.prospects++;
}

/** A prospect contacted and presented to this month, still deciding — counts as one presentation. */
function seedPresentedProspect(daie, month) {
  const ref = db.collection("prospects").doc();
  const contacted = randomDayInMonth(month);
  const presented = capToday(addDays(contacted, randInt(0, 5)));
  // Keep the presentation inside the month it's meant to count for.
  const presentedIn = iso(presented).slice(0, 7) === month ? presented : contacted;
  writeUpdates(ref, daie, [["initial_contact", contacted], ["present", presentedIn]]);
  put(ref, {
    ...prospectProfile(daie, randomProspectName()),
    stage: "present",
    status: "active",
    nextFollowUpDate: iso(addDays(TODAY, randInt(1, 21))),
    linkedSaleId: null,
    createdAt: Timestamp.fromDate(contacted),
    updatedAt: Timestamp.fromDate(presentedIn),
  });
  stats.prospects++;
}

// --- Main -----------------------------------------------------------------------
async function main() {
  console.log(`Project: ${key.project_id}`);
  const existing = await db.collection("users").limit(1).get();
  if (!existing.empty && !RESET) {
    console.error("Staging already has data. Re-run with --reset to wipe it and seed fresh.");
    process.exit(1);
  }
  if (RESET) await reset();

  for (const u of UNITS) put(db.collection("units").doc(u.id), { name: u.name });

  // HQ admin (staff, like the real HQ admin accounts — not a daie).
  const adminUid = await createLogin({
    email: `admin@${EMAIL_DOMAIN}`,
    name: "HQ Admin (Demo)",
    claims: { rank: "KDE", unitId: "kausar-group-hq", isGroupAdmin: true },
    role: "Group Admin (HQ staff)",
    unitName: "Kausar Group HQ",
  });
  put(db.collection("users").doc(adminUid), {
    daieId: "DEMO-HQ-01", name: "HQ Admin (Demo)", email: `admin@${EMAIL_DOMAIN}`, rank: "KDE", unitId: "kausar-group-hq",
    uplineId: null, lineagePath: [], structureType: "TS", subscriptionStatus: "active", isGroupAdmin: true, isStaff: true,
    isLdpMember: false, recordOnly: false, region: "central", dateLicensed: null, dateExpiry: null, createdAt: FieldValue.serverTimestamp(),
  });

  const allDaie = [];
  for (const unit of UNITS) {
    // 1 KDE → 2 DPM → 3 DM each, plus 1 DM directly under the KDE = 10.
    const plan = [
      { key: "kde", rank: "KDE", upline: null },
      { key: "dpm1", rank: "DPM", upline: "kde" },
      { key: "dpm2", rank: "DPM", upline: "kde" },
      { key: "dm1", rank: "DM", upline: "dpm1" },
      { key: "dm2", rank: "DM", upline: "dpm1" },
      { key: "dm3", rank: "DM", upline: "dpm1" },
      { key: "dm4", rank: "DM", upline: "dpm2" },
      { key: "dm5", rank: "DM", upline: "dpm2" },
      { key: "dm6", rank: "DM", upline: "dpm2" },
      { key: "dm7", rank: "DM", upline: "kde" },
    ];
    const withLogin = new Set(["kde", "dpm1", "dm1"]);
    const byKey = {};
    for (const [i, p] of plan.entries()) {
      // demoName() is still drawn for the KDE so the seeded RNG — and so the
      // whole demo picture — stays the same as before the real names.
      const isKde = p.key === "kde";
      const name = isKde ? (demoName(), unit.kde.name) : demoName();
      const email = `${isKde ? unit.kde.logins[0][0] : p.key}.${unit.short}@${EMAIL_DOMAIN}`;
      const upline = p.upline ? byKey[p.upline] : null;
      const claims = { rank: p.rank, unitId: unit.id, isGroupAdmin: false };
      const uid = withLogin.has(p.key)
        ? await createLogin({ email, name: isKde ? unit.kde.logins[0][1] : name, claims, role: p.rank, unitName: unit.name })
        : db.collection("users").doc().id;
      if (isKde) {
        for (const [local, person] of unit.kde.logins.slice(1)) {
          await createLinkedLogin({ email: `${local}.${unit.short}@${EMAIL_DOMAIN}`, name: person, profileUid: uid, claims, role: "KDE (shared account)", unitName: unit.name });
        }
      }

      // Licences: most renewed to 2027; per unit one already expired and two
      // expiring within 6 months, so the renewal reminder has something to show.
      const licensedYear = p.rank === "KDE" ? randInt(2016, 2019) : p.rank === "DPM" ? randInt(2019, 2023) : randInt(2023, 2025);
      const dateLicensed = `${licensedYear}-${String(randInt(1, 12)).padStart(2, "0")}-${String(randInt(1, 28)).padStart(2, "0")}`;
      const dateExpiry =
        p.key === "dm6" ? iso(addDays(TODAY, -randInt(20, 60)))
        : p.key === "dm5" ? iso(addDays(TODAY, randInt(20, 80)))
        : p.key === "dm4" ? iso(addDays(TODAY, randInt(100, 170)))
        : `2027-${String(randInt(3, 12)).padStart(2, "0")}-${String(randInt(1, 28)).padStart(2, "0")}`;

      const daie = {
        uid, name, unitId: unit.id, rank: p.rank,
        // How productive this daie is (KDEs/DPMs a bit stronger, plus individual spread).
        drive: (p.rank === "KDE" ? 1.3 : p.rank === "DPM" ? 1.1 : 0.8) * (0.4 + rand() * 1.2),
      };
      put(db.collection("users").doc(uid), {
        daieId: `DEMO-${unit.short.toUpperCase()}-${String(i + 1).padStart(2, "0")}`,
        name,
        email,
        rank: p.rank,
        unitId: unit.id,
        uplineId: upline?.uid ?? null,
        lineagePath: upline ? [...upline.lineagePath, upline.uid] : [],
        structureType: chance(0.7) ? "TS" : "OS",
        subscriptionStatus: "active",
        isGroupAdmin: false,
        isStaff: false,
        isLdpMember: p.rank !== "DM" && chance(0.5),
        recordOnly: false,
        region: choice(REGIONS),
        dateLicensed,
        dateExpiry,
        createdAt: FieldValue.serverTimestamp(),
      });
      byKey[p.key] = { ...daie, lineagePath: upline ? [...upline.lineagePath, upline.uid] : [] };
      allDaie.push(byKey[p.key]);
      stats.daie++;

      if (chance(0.6)) put(db.collection("goals").doc(uid), { salesGoal: randInt(3, 15) * 10000, incomeGoal: randInt(2, 8) * 1000, updatedAt: FieldValue.serverTimestamp() });
      if (p.rank === "DM" && chance(0.6)) put(db.collection("wasitahSubscription").doc(uid), { active: true, since: iso(addDays(TODAY, -randInt(30, 400))), updatedAt: FieldValue.serverTimestamp() });
    }

    const team = Object.values(byKey);
    for (const daie of team) {
      // JFW partners: upline, downline or a same-unit peer (it isn't lineage-bound).
      const partners = team.filter((t) => t.uid !== daie.uid);
      seedSales(daie, unit.pace);
      seedRecentMonths(daie, partners);
    }
    await flush();
    console.log(`  ${unit.name}: 10 demo daie seeded`);
  }

  // Contests, trainings, awards, bulletins.
  const contests = [
    { section: "wasiyyah", title: "Konvensyen Wasiyyah FY25/26 (Demo)", startDate: "2025-07-01", endDate: "2026-12-31", targets: [{ label: "Dai'e Mawarith (Individu)", amount: 100000 }, { label: "Kumpulan", amount: 500000 }], requirements: "Jualan Perancangan sepanjang tempoh FY25/26.", rewardDescription: "Pengiktirafan di Konvensyen Wasiyyah." },
    { section: "kausar", title: "Kausar Year-End Sprint (Demo)", startDate: "2026-10-01", endDate: "2026-12-31", targets: [{ label: "DM", amount: 15000 }, { label: "DPM", amount: 30000 }], requirements: "Jualan Perancangan Oktober – Disember 2026.", rewardDescription: "Makan malam bersama pengurusan." },
  ];
  for (const c of contests) {
    const ref = db.collection("contests").doc();
    put(ref, { ...c, posterUrl: null, createdBy: adminUid, createdAt: FieldValue.serverTimestamp() });
    for (const d of allDaie) if (chance(0.5)) put(db.collection("contestProgress").doc(`${ref.id}_${d.uid}`), { contestId: ref.id, uid: d.uid, amount: randInt(5, 120) * 1000 * (c.section === "kausar" ? 0.2 : 1), updatedAt: FieldValue.serverTimestamp() });
  }

  const trainings = [
    { title: "Start Training", provider: "kausar", cpdHours: 6, date: `${RECENT_MONTHS[1]}-12`, location: "Kausar HQ, Shah Alam", requiredForOnboarding: true },
    { title: "Start Training", provider: "kausar", cpdHours: 6, date: `${RECENT_MONTHS[3]}-09`, location: "Kausar HQ, Shah Alam", requiredForOnboarding: true },
    { title: "Kemas Kini Produk Hibah (Demo)", provider: "wasiyyah", cpdHours: 3, date: `${RECENT_MONTHS[2]}-20`, location: "Wasiyyah Shoppe, Kuala Lumpur", requiredForOnboarding: false },
  ];
  for (const t of trainings) {
    const ref = db.collection("trainings").doc();
    put(ref, { ...t, description: null, qrToken: t.provider === "kausar" ? crypto.randomBytes(12).toString("hex") : null, createdBy: adminUid, createdAt: FieldValue.serverTimestamp() });
    if (t.date > iso(TODAY)) continue;
    for (const d of allDaie) {
      if (!chance(0.6)) continue;
      put(db.collection("trainingAttendance").doc(`${ref.id}_${d.uid}`), { trainingId: ref.id, uid: d.uid, method: t.provider === "kausar" ? "qr" : "self_reported", qrToken: null, markedBy: d.uid, markedAt: Timestamp.fromDate(new Date(`${t.date}T10:00:00Z`)) });
    }
  }

  for (const d of allDaie.filter((x) => x.rank !== "DM" || chance(0.2)).slice(0, 12)) {
    put(db.collection("achievements").doc(), { uid: d.uid, title: choice(["Top Producer (Demo)", "Rookie of the Month (Demo)", "Konvensyen Qualifier (Demo)"]), category: "sales", description: "Contoh anugerah untuk staging.", dateAwarded: iso(addDays(TODAY, -randInt(10, 200))), awardedBy: adminUid, createdAt: FieldValue.serverTimestamp() });
  }

  const bulletins = [
    ["Selamat datang ke STAGING", "Ini aplikasi percubaan dengan data contoh sahaja. Cuba semua fungsi di sini — tiada apa yang dibuat di sini akan sampai ke aplikasi sebenar.", 0],
    ["Kempen Kesedaran Wasiat Q4 (Demo)", "Bahan promosi baharu boleh didapati daripada KDE masing-masing.", 5],
    ["Jadual Start Training (Demo)", "Start Training seterusnya di Kausar HQ. Daftar kehadiran melalui QR di lokasi.", 12],
  ];
  for (const [title, body, daysAgo] of bulletins) put(db.collection("bulletins").doc(), { title, body, imageUrl: null, attachmentUrl: null, attachmentName: null, publishAt: Timestamp.fromDate(addDays(TODAY, -daysAgo)), createdBy: adminUid });

  await flush();

  const out = path.join(os.homedir(), "Downloads", EMULATOR ? "Kausar-Emulator-Demo-Logins.csv" : "Kausar-Staging-Demo-Logins.csv");
  const csv = ["Role,Unit,Name,Email,Password", ...logins.map((l) => [l.role, l.unit, l.name, l.email, l.password].map((v) => `"${v}"`).join(","))].join("\n");
  fs.writeFileSync(out, csv + "\n");

  console.log(`\nDone. ${stats.daie} demo daie, ${stats.sales} sales (RM ${stats.salesRM.toLocaleString("en-MY")}), ${stats.collections} collections, ${stats.activities} activities, ${stats.prospects} prospects.`);
  console.log(`${logins.length} logins written to ${out}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
