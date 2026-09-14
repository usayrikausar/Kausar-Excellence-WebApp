// Seeds ONE fully-populated "sample daie" into the running emulator, with a
// realistic ~300-prospect book of business spread over the last 6 months —
// so every report/screen (Activities pipeline, traffic light, Sales &
// Collection, My Team, Reports, the printable report card) can be reviewed
// against real volume instead of a handful of hand-typed test rows.
//
// This is a read-then-write script: it looks up a real DPM already in the
// roster (under the logged-in KDE, daieId 10363) to use as the sample daie's
// upline, so the sample shows up naturally in that KDE's own Team/Reports
// pages rather than floating as an orphan root.
//
// Usage (emulators must already be running):
//   node scripts/seed-dummy-daie.mjs

process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "127.0.0.1:9099";
process.env.GCLOUD_PROJECT ??= "demo-kausar-group";

import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue, Timestamp } from "firebase-admin/firestore";

initializeApp({ projectId: "demo-kausar-group" });
const auth = getAuth();
const db = getFirestore();

const PASSWORD = "password123";
const EMAIL = "sample.daie@kausar.test";
const NAME = "Aiman Haqimi (Sample Daie)";
const DAIE_ID = "DEMO-0001";

// Real DPM (Mohd Ibrahim bin Abu Bakar, 11541, Kausar Aspire) under the
// logged-in KDE (10363, Mohd Usayri) — found by inspecting the live roster.
const UPLINE_UID = "AI6HnkJUjMCf6271lySDcxJGrhhM";

const TODAY = new Date("2026-09-14T00:00:00");
const PROSPECT_COUNT = 300;

// --- Seeded RNG (mulberry32) so re-runs are reproducible ------------------
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260914);
const rand = () => rng();
const randInt = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const choice = (arr) => arr[randInt(0, arr.length - 1)];
const chance = (p) => rand() < p;

function weightedChoice(entries) {
  // entries: [[value, weight], ...]
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [value, w] of entries) {
    if (r < w) return value;
    r -= w;
  }
  return entries[entries.length - 1][0];
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

// --- Name / detail pools ----------------------------------------------------
const MALE_FIRST = ["Ahmad", "Muhammad", "Mohd", "Amir", "Faizal", "Azman", "Ridzuan", "Hafiz", "Zulkifli", "Rosli", "Fadzil", "Shahrul", "Idris", "Farid", "Nazri", "Hakim", "Iskandar", "Firdaus", "Anuar", "Hisham", "Aizat", "Rizal", "Zaki", "Fitri", "Danial"];
const FEMALE_FIRST = ["Siti", "Nurul", "Aisyah", "Fatimah", "Zainab", "Noraini", "Aminah", "Rohana", "Salmah", "Farah", "Liyana", "Sofea", "Hasnah", "Zaleha", "Halimah", "Suhaila", "Norlela", "Azizah", "Nadia", "Diyana", "Balqis", "Nabila", "Kartini", "Shafiqah", "Aina"];
const MALE_LAST = ["bin Ahmad", "bin Ismail", "bin Hassan", "bin Rahman", "bin Yusof", "bin Osman", "bin Abdullah", "bin Zainal", "bin Kassim", "bin Salleh", "bin Hamid", "bin Rashid", "bin Karim"];
const FEMALE_LAST = ["binti Ahmad", "binti Ismail", "binti Hassan", "binti Yusof", "binti Rahman", "binti Osman", "binti Abdullah", "binti Zainal", "binti Kassim", "binti Salleh", "binti Hamid", "binti Rashid", "binti Karim"];

function randomName() {
  const isMale = chance(0.5);
  const first = choice(isMale ? MALE_FIRST : FEMALE_FIRST);
  const last = choice(isMale ? MALE_LAST : FEMALE_LAST);
  return `${first} ${last}`;
}

const ORGANIZATIONS = [
  "Petronas Dagangan Bhd", "Tenaga Nasional Bhd", "Bank Islam Malaysia", "CIMB Group",
  "Telekom Malaysia", "Sime Darby Plantation", "AmBank Group", "Maybank Berhad",
  "Perodua Manufacturing", "Proton Holdings", "Kementerian Pendidikan Malaysia",
  "Jabatan Kastam Diraja Malaysia", "Majlis Perbandaran Klang", "UiTM Shah Alam",
  "Universiti Malaya", "Hospital Kuala Lumpur", "Klinik Kesihatan Setia Alam",
  "Astro Malaysia Holdings", "AirAsia Berhad", "IJM Corporation",
  "Digi Telecommunications", "Celcom Axiata", "Genting Malaysia", "Nestle Malaysia",
  "Sunway Group", "IOI Corporation", "Perniagaan Sendiri", "Kedai Runcit Sendiri",
  "Klinik Swasta", "Firma Guaman Rahman & Co",
];

const FARAID_NOTES = [
  "Isteri + 2 anak lelaki", "Suami + 3 anak (2 perempuan, 1 lelaki)",
  "Isteri, 1 anak, ibu masih hidup", "Bujang, waris: ibu bapa",
  "Balu, 4 anak, ada harta pusaka tanah", "Suami + anak angkat (perlu nasihat khas)",
  "Isteri + 5 anak, bapa masih hidup", "Duda, 2 anak dewasa",
  "Isteri + 1 anak kecil, perlu wasi", "Bujang, waris: adik-beradik",
];

const IMPORTANT_DATE_LABELS = ["Hari jadi pasangan", "Ulang tahun perkahwinan", "Hari jadi anak sulung", "Tarikh persaraan dijangka"];

// --- App-shared enums (mirrored from src/lib/types.ts) ----------------------
const PROSPECT_SOURCES = ["booth", "live_tiktok", "social_media", "direct_approach", "referral", "talk", "project200", "other"];
const PIPPPAS_STAGES = ["prospecting", "initial_contact", "present", "prepare_solution", "present_solution", "administration", "signing_akad", "safekeeping"];
const PROFESSION_TYPES = ["c_level", "top_management", "management", "executive", "business_owner", "self_employed", "retired", "others"];
const GOVERNMENT_TAHAP = ["not_applicable", "kumpulan_pelaksana", "kumpulan_pengurusan_profesional", "kumpulan_pengurusan_tertinggi"];
const INCOME_BRACKETS = ["below_5k", "5k_10k", "10k_15k", "15k_20k", "above_20k"];
const ADMINISTRATION_INDEX = PIPPPAS_STAGES.indexOf("administration");
const PRESENT_INDEX = PIPPPAS_STAGES.indexOf("present");

// Cumulative "reached at least this stage" probability, applied as
// conditional step-through-step draws below — an intentionally top-heavy
// funnel (most leads stall early; only a minority reach a real closing
// conversation), which is what makes the traffic light and sales numbers
// come out uneven month to month instead of a suspiciously perfect demo.
const STAGE_CONTINUE_PROB = [null, 0.65, 0.62, 0.62, 0.72, 0.67, 0.75, 0.78];
// index i = probability of moving from stage i-1 to stage i, given stage i-1 reached

function walkFunnel(startIndex) {
  let stage = startIndex;
  for (let i = startIndex + 1; i < PIPPPAS_STAGES.length; i++) {
    if (chance(STAGE_CONTINUE_PROB[i])) stage = i;
    else break;
  }
  return stage;
}

function decideStatus(finalStageIndex) {
  if (finalStageIndex >= ADMINISTRATION_INDEX) return chance(0.8) ? "closed_won" : "closed_lost";
  return chance(0.15) ? "closed_lost" : "active";
}

function saleForClose() {
  const category = weightedChoice([
    ["perancangan", 55],
    ["pengurusan_berlian", 15],
    ["pengurusan_mutiara", 10],
    ["kesPusaka_besar", 8],
    ["kesPusaka_kecil", 12],
  ]);
  switch (category) {
    case "perancangan":
      return { category: "perancangan", subCategory: null, amount: randInt(15, 80) * 100, count: null };
    case "pengurusan_berlian":
      return { category: "pengurusan", subCategory: "berlian", amount: null, count: chance(0.8) ? 1 : 2 };
    case "pengurusan_mutiara":
      return { category: "pengurusan", subCategory: "mutiara", amount: null, count: chance(0.8) ? 1 : 2 };
    case "kesPusaka_besar":
      return { category: "kesPusaka", subCategory: "besar", amount: randInt(80, 250) * 100, count: null };
    case "kesPusaka_kecil":
      return { category: "kesPusaka", subCategory: "kecil", amount: randInt(8, 30) * 100, count: null };
  }
}

// Monthly cohorts — a growing book of business over the last 6 months,
// reflecting a daie who's been ramping up (also gives the report card's
// month-over-month trend something real to show).
const COHORTS = [
  { year: 2026, month: 4, count: 35 },
  { year: 2026, month: 5, count: 40 },
  { year: 2026, month: 6, count: 45 },
  { year: 2026, month: 7, count: 55 },
  { year: 2026, month: 8, count: 65 },
  { year: 2026, month: 9, count: 60 }, // partial month (1st-14th), still the busiest
];

function randomDayInMonth(year, month) {
  const lastDay = month === 9 ? 14 : new Date(year, month, 0).getDate();
  return new Date(year, month - 1, randInt(1, lastDay));
}

let batch = db.batch();
let opsInBatch = 0;
const commits = [];
function write(ref, data) {
  batch.set(ref, data);
  opsInBatch++;
  if (opsInBatch >= 400) {
    commits.push(batch.commit());
    batch = db.batch();
    opsInBatch = 0;
  }
}
async function flush() {
  if (opsInBatch > 0) commits.push(batch.commit());
  await Promise.all(commits);
}

async function ensureDaie() {
  let authUser;
  try {
    authUser = await auth.getUserByEmail(EMAIL);
    console.log(`Auth user already exists (${authUser.uid}) — reusing.`);
  } catch {
    authUser = await auth.createUser({ email: EMAIL, password: PASSWORD, displayName: NAME });
    await auth.setCustomUserClaims(authUser.uid, { rank: "DM", unitId: "kausar-aspire", isGroupAdmin: false });
    console.log(`Created Auth user ${authUser.uid}.`);
  }

  const upline = await db.collection("users").doc(UPLINE_UID).get();
  if (!upline.exists) throw new Error(`Upline ${UPLINE_UID} not found — roster may have changed, re-check the uid.`);
  const uplineData = upline.data();
  const lineagePath = [...(uplineData.lineagePath ?? []), UPLINE_UID];

  await db.collection("users").doc(authUser.uid).set({
    daieId: DAIE_ID,
    name: NAME,
    email: EMAIL,
    rank: "DM",
    unitId: "kausar-aspire",
    uplineId: UPLINE_UID,
    lineagePath,
    structureType: "TS",
    subscriptionStatus: "active",
    isGroupAdmin: false,
    isLdpMember: false,
    dateLicensed: "2025-06-15",
    createdAt: FieldValue.serverTimestamp(),
  });

  await db.collection("goals").doc(authUser.uid).set({
    salesGoal: 12000,
    incomeGoal: 5000,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return authUser.uid;
}

async function seedContestProgress(uid) {
  const snap = await db.collection("contests").get();
  for (const doc of snap.docs) {
    const amount = doc.data().section === "wasiyyah" ? 38000 : 18500;
    write(db.collection("contestProgress").doc(`${doc.id}_${uid}`), {
      contestId: doc.id,
      uid,
      amount,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }
}

function buildProspect(uid, cohortYear, cohortMonth) {
  const startDirectAtPresent = chance(0.1);
  const startIndex = startDirectAtPresent ? PRESENT_INDEX : 0;
  const finalIndex = walkFunnel(startIndex);
  const status = decideStatus(finalIndex);

  const name = randomName();
  const hasEmail = chance(0.7);
  const age = randInt(24, 66);
  const birthYear = TODAY.getFullYear() - age;
  const birthdate = isoDate(new Date(birthYear, randInt(0, 11), randInt(1, 28)));
  const hasProfile = chance(0.85);
  const profession = hasProfile ? choice(PROFESSION_TYPES) : null;
  const govTahap = hasProfile && chance(0.15)
    ? choice(GOVERNMENT_TAHAP.slice(1))
    : hasProfile ? "not_applicable" : null;
  const hasImportantDate = chance(0.3);

  const prospect = {
    uid,
    name,
    phone: `01${randInt(0, 9)}-${randInt(1000000, 9999999)}`,
    details: chance(0.4) ? choice(["Berjumpa di booth kaunter", "Rujukan dari klien sedia ada", "Berminat selepas sesi taklimat", "Susulan daripada panggilan sejuk"]) : null,
    source: startDirectAtPresent ? "direct_approach" : choice(PROSPECT_SOURCES),
    stage: PIPPPAS_STAGES[finalIndex],
    status,
    nextFollowUpDate: status === "active" ? isoDate(addDays(TODAY, randInt(1, 21))) : null,
    linkedSaleId: null,
    age,
    birthdate,
    email: hasEmail ? `${name.toLowerCase().replace(/[^a-z]/g, ".")}${randInt(1, 99)}@gmail.com` : null,
    profession,
    professionOther: profession === "others" ? choice(["Peniaga kecil-kecilan", "Pemandu e-hailing", "Suri rumah sepenuh masa"]) : null,
    governmentTahap: govTahap,
    organizationName: hasProfile ? choice(ORGANIZATIONS) : null,
    incomeBracket: hasProfile ? weightedChoice([["below_5k", 15], ["5k_10k", 35], ["10k_15k", 28], ["15k_20k", 15], ["above_20k", 7]]) : null,
    importantDate: hasImportantDate ? isoDate(addDays(TODAY, randInt(-300, 300))) : null,
    importantDateLabel: hasImportantDate ? choice(IMPORTANT_DATE_LABELS) : null,
    faraidNotes: chance(0.4) ? choice(FARAID_NOTES) : null,
  };

  return { prospect, startIndex, finalIndex, status };
}

let stats = { total: 0, byStage: {}, byStatus: {}, sales: 0, salesAmount: 0, collections: 0, activities: 0 };

function seedOneProspect(uid, cohortYear, cohortMonth) {
  const { prospect, startIndex, finalIndex, status } = buildProspect(uid, cohortYear, cohortMonth);
  const prospectRef = db.collection("prospects").doc();

  let cursor = randomDayInMonth(cohortYear, cohortMonth);
  const stageDates = {};
  for (let i = startIndex; i <= finalIndex; i++) {
    if (i > startIndex) cursor = addDays(cursor, randInt(2, 12));
    if (cursor > TODAY) cursor = TODAY;
    stageDates[PIPPPAS_STAGES[i]] = new Date(cursor);
    const updateRef = db.collection("prospects").doc(prospectRef.id).collection("updates").doc();
    write(updateRef, {
      uid,
      stage: PIPPPAS_STAGES[i],
      note: i === startIndex
        ? `Added as a new prospect at ${PIPPPAS_STAGES[i]}.`
        : choice(["Susulan panggilan telefon.", "Sesi pertemuan/taklimat.", "Menghantar cadangan perancangan.", "Klien minta masa untuk fikir.", "Perbincangan lanjut dengan keluarga."]),
      nextFollowUpDate: null,
      createdAt: Timestamp.fromDate(stageDates[PIPPPAS_STAGES[i]]),
    });
  }

  let closeDate = null;
  let saleRef = null;
  if (status === "closed_won") {
    closeDate = addDays(stageDates[PIPPPAS_STAGES[finalIndex]], randInt(1, 5));
    if (closeDate > TODAY) closeDate = TODAY;
    const sale = saleForClose();
    saleRef = db.collection("sales").doc();
    write(saleRef, {
      uid,
      category: sale.category,
      subCategory: sale.subCategory,
      amount: sale.amount,
      count: sale.count,
      date: Timestamp.fromDate(closeDate),
      createdAt: Timestamp.fromDate(closeDate),
      prospectId: prospectRef.id,
    });
    stats.sales++;
    stats.salesAmount += sale.amount ?? 0;

    if (chance(0.7)) {
      const collectedAmount = sale.amount ? Math.round(sale.amount * (chance(0.6) ? 1 : 0.5)) : null;
      if (collectedAmount) {
        write(db.collection("collections").doc(), {
          uid,
          saleRef: saleRef.id,
          amountCollected: collectedAmount,
          date: Timestamp.fromDate(addDays(closeDate, randInt(0, 10))),
          createdAt: Timestamp.fromDate(closeDate),
          prospectId: prospectRef.id,
        });
        stats.collections++;
      }
    }
  } else if (status === "closed_lost") {
    closeDate = addDays(stageDates[PIPPPAS_STAGES[finalIndex]], randInt(1, 14));
  }

  const finalUpdatedAt = closeDate ?? stageDates[PIPPPAS_STAGES[finalIndex]];
  write(prospectRef, {
    ...prospect,
    linkedSaleId: saleRef ? saleRef.id : null,
    createdAt: Timestamp.fromDate(stageDates[PIPPPAS_STAGES[startIndex]]),
    updatedAt: Timestamp.fromDate(finalUpdatedAt),
  });

  stats.total++;
  stats.byStage[prospect.stage] = (stats.byStage[prospect.stage] ?? 0) + 1;
  stats.byStatus[status] = (stats.byStatus[status] ?? 0) + 1;
}

function seedActivitiesForMonth(uid, year, month) {
  const trainingCount = randInt(2, 5);
  for (let i = 0; i < trainingCount; i++) {
    write(db.collection("activities").doc(), {
      uid,
      type: "training",
      reachCount: 0,
      note: choice(["Sesi KWEB", "Mentoring dengan upline", "Latihan produk baharu", null]),
      date: isoDate(randomDayInMonth(year, month)),
      createdAt: FieldValue.serverTimestamp(),
    });
    stats.activities++;
  }

  const reachActivityCount = randInt(4, 9);
  for (let i = 0; i < reachActivityCount; i++) {
    const type = choice(PROSPECT_SOURCES.filter((s) => s !== "referral"));
    write(db.collection("activities").doc(), {
      uid,
      type,
      reachCount: randInt(8, 35),
      note: choice(["Booth di mall", "Sesi Live TikTok", "Panggilan susulan pukal", "Program komuniti", null]),
      date: isoDate(randomDayInMonth(year, month)),
      createdAt: FieldValue.serverTimestamp(),
    });
    stats.activities++;
  }
}

async function main() {
  console.log("Seeding sample daie + ~300 prospects…\n");
  const uid = await ensureDaie();
  console.log(`Sample daie uid: ${uid} (daieId ${DAIE_ID}, upline ${UPLINE_UID})`);

  await seedContestProgress(uid);

  for (const cohort of COHORTS) {
    for (let i = 0; i < cohort.count; i++) seedOneProspect(uid, cohort.year, cohort.month);
    seedActivitiesForMonth(uid, cohort.year, cohort.month);
  }

  await flush();

  console.log("\nDone. Summary:");
  console.log(`  Prospects: ${stats.total}`);
  console.log(`  By stage:`, stats.byStage);
  console.log(`  By status:`, stats.byStatus);
  console.log(`  Sales entries: ${stats.sales} (RM ${stats.salesAmount.toLocaleString()} across perancangan/kesPusaka amount-bearing categories)`);
  console.log(`  Collections entries: ${stats.collections}`);
  console.log(`  Activities entries: ${stats.activities}`);
  console.log(`\nLogin: ${EMAIL} / ${PASSWORD}`);
  console.log("Emulator UI: http://127.0.0.1:4000");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
