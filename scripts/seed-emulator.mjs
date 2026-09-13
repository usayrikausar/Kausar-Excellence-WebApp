// Seeds the running Firebase Emulator Suite (Auth + Firestore) with a small,
// realistic hierarchy so the app's lineage-scoping can be exercised manually.
// This talks to firebase-admin directly rather than through the Cloud
// Functions callables (createUser/updateUser) — it's a one-shot local
// convenience script, not something that needs to go through the same
// guarded path a real admin panel action does, and computing lineagePath
// inline here (instead of relying on the Firestore trigger to cascade) keeps
// the whole seed deterministic and fast.
//
// Usage (emulators must already be running):
//   node scripts/seed-emulator.mjs

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
const seededTable = [];
const rankSeq = { KDE: 0, DPM: 0, DM: 0 };

function nextDaieId(rank) {
  rankSeq[rank] += 1;
  return `${rank}-${String(rankSeq[rank]).padStart(4, "0")}`;
}

async function createDaie({ name, email, rank, unitId, uplineLineage = null, uplineId = null, structureType = "TS", isGroupAdmin = false, isLdpMember = false }) {
  const daieId = nextDaieId(rank);
  const authUser = await auth.createUser({ email, password: PASSWORD, displayName: name });

  await auth.setCustomUserClaims(authUser.uid, { rank, unitId, isGroupAdmin });

  const lineagePath = uplineId ? [...(uplineLineage ?? []), uplineId] : [];

  await db.collection("users").doc(authUser.uid).set({
    daieId,
    name,
    email,
    rank,
    unitId,
    uplineId,
    lineagePath,
    structureType,
    subscriptionStatus: "active",
    isGroupAdmin,
    isLdpMember,
    createdAt: FieldValue.serverTimestamp(),
  });

  seededTable.push({ daieId, email, password: PASSWORD, rank, unitId });
  return { uid: authUser.uid, daieId, lineagePath };
}

async function addSale({ uid, category, subCategory = null, amount = null, count = null, daysAgo = 0 }) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  await db.collection("sales").add({
    uid,
    category,
    subCategory,
    amount,
    count,
    date: Timestamp.fromDate(date),
    createdAt: FieldValue.serverTimestamp(),
  });
}

async function addCollection({ uid, saleRef, amountCollected, daysAgo = 0 }) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  await db.collection("collections").add({ uid, saleRef, amountCollected, date: Timestamp.fromDate(date) });
}

async function main() {
  console.log("Seeding demo-kausar-group emulators…\n");

  // --- Units -----------------------------------------------------------
  await db.collection("units").doc("kausar-wealth").set({ name: "Kausar Wealth" });
  await db.collection("units").doc("kausar-global").set({ name: "Kausar Global" });

  // --- Group Admin -------------------------------------------------------
  const groupAdmin = await createDaie({
    name: "Amir Hafiz (Group Admin)",
    email: "groupadmin@kausar.test",
    rank: "KDE",
    unitId: "kausar-wealth",
    structureType: "TS",
    isGroupAdmin: true,
  });

  // --- Kausar Wealth: 1 KDE, 2 DPM, 2 DM under each DPM (7 total) -------
  const wealthKde = await createDaie({
    name: "Kamarul Zaman",
    email: "kde.wealth@kausar.test",
    rank: "KDE",
    unitId: "kausar-wealth",
    structureType: "TS",
  });

  const wealthDpm1 = await createDaie({
    name: "Siti Rahmah",
    email: "dpm1.wealth@kausar.test",
    rank: "DPM",
    unitId: "kausar-wealth",
    uplineId: wealthKde.uid,
    uplineLineage: wealthKde.lineagePath,
    structureType: "TS",
  });
  const wealthDpm2 = await createDaie({
    name: "Faizal Rahman",
    email: "dpm2.wealth@kausar.test",
    rank: "DPM",
    unitId: "kausar-wealth",
    uplineId: wealthKde.uid,
    uplineLineage: wealthKde.lineagePath,
    structureType: "OS",
    isLdpMember: true, // test account for the LDP / Leaders Tool visibility gate
  });

  const wealthDm1 = await createDaie({
    name: "Nurul Ain",
    email: "dm1.wealth@kausar.test",
    rank: "DM",
    unitId: "kausar-wealth",
    uplineId: wealthDpm1.uid,
    uplineLineage: wealthDpm1.lineagePath,
    structureType: "TS",
  });
  const wealthDm2 = await createDaie({
    name: "Hafiz Iskandar",
    email: "dm2.wealth@kausar.test",
    rank: "DM",
    unitId: "kausar-wealth",
    uplineId: wealthDpm1.uid,
    uplineLineage: wealthDpm1.lineagePath,
    structureType: "TS",
  });
  const wealthDm3 = await createDaie({
    name: "Aisyah Kamal",
    email: "dm3.wealth@kausar.test",
    rank: "DM",
    unitId: "kausar-wealth",
    uplineId: wealthDpm2.uid,
    uplineLineage: wealthDpm2.lineagePath,
    structureType: "OS",
  });
  const wealthDm4 = await createDaie({
    name: "Zulkifli Osman",
    email: "dm4.wealth@kausar.test",
    rank: "DM",
    unitId: "kausar-wealth",
    uplineId: wealthDpm2.uid,
    uplineLineage: wealthDpm2.lineagePath,
    structureType: "OS",
  });

  // --- Kausar Global: 1 KDE, 1 DPM, 2 DM under that DPM (4 total) -------
  const globalKde = await createDaie({
    name: "Mohd Rizal",
    email: "kde.global@kausar.test",
    rank: "KDE",
    unitId: "kausar-global",
    structureType: "TS",
  });
  const globalDpm = await createDaie({
    name: "Farah Diyana",
    email: "dpm.global@kausar.test",
    rank: "DPM",
    unitId: "kausar-global",
    uplineId: globalKde.uid,
    uplineLineage: globalKde.lineagePath,
    structureType: "TS",
  });
  const globalDm1 = await createDaie({
    name: "Azman Yusof",
    email: "dm1.global@kausar.test",
    rank: "DM",
    unitId: "kausar-global",
    uplineId: globalDpm.uid,
    uplineLineage: globalDpm.lineagePath,
    structureType: "TS",
  });
  const globalDm2 = await createDaie({
    name: "Liyana Sofea",
    email: "dm2.global@kausar.test",
    rank: "DM",
    unitId: "kausar-global",
    uplineId: globalDpm.uid,
    uplineLineage: globalDpm.lineagePath,
    structureType: "OS",
  });

  // Keep the app's own daieId counter (used by the createUser callable) in
  // sync with what this script already used, so the next admin-created user
  // doesn't collide with a seeded Daie ID.
  await db.collection("meta").doc("daieCounters").set({
    kdeSeq: rankSeq.KDE,
    dpmSeq: rankSeq.DPM,
    dmSeq: rankSeq.DM,
  });

  // --- Sample sales & collections ---------------------------------------
  await addSale({ uid: wealthDm1.uid, category: "perancangan", amount: 3500, daysAgo: 2 });
  await addSale({ uid: wealthDm1.uid, category: "pengurusan", subCategory: "berlian", count: 2, daysAgo: 5 });
  await addSale({ uid: wealthDm2.uid, category: "kesPusaka", subCategory: "kecil", amount: 1800, daysAgo: 1 });
  await addSale({ uid: wealthDpm1.uid, category: "perancangan", amount: 6200, daysAgo: 3 });
  await addSale({ uid: wealthDm3.uid, category: "pengurusan", subCategory: "mutiara", count: 1, daysAgo: 4 });
  await addSale({ uid: wealthDm4.uid, category: "kesPusaka", subCategory: "besar", amount: 12000, daysAgo: 7 });
  await addSale({ uid: wealthKde.uid, category: "perancangan", amount: 9000, daysAgo: 10 });
  await addSale({ uid: globalDm1.uid, category: "perancangan", amount: 2750, daysAgo: 2 });
  await addSale({ uid: globalDm2.uid, category: "kesPusaka", subCategory: "kecil", amount: 2200, daysAgo: 6 });
  await addSale({ uid: globalDpm.uid, category: "pengurusan", subCategory: "berlian", count: 3, daysAgo: 1 });

  await addCollection({ uid: wealthDm1.uid, saleRef: "manual-seed-1", amountCollected: 3500, daysAgo: 1 });
  await addCollection({ uid: wealthDpm1.uid, saleRef: "manual-seed-2", amountCollected: 6200, daysAgo: 2 });
  await addCollection({ uid: globalDm1.uid, saleRef: "manual-seed-3", amountCollected: 1500, daysAgo: 1 });

  // --- Bulletins ----------------------------------------------------------
  await db.collection("bulletins").add({
    title: "Welcome to the Kausar Excellence WebApp",
    body: "This is Phase 1 of the internal dashboard — Home, My Team, Sales & Collection, Bulletin, and Admin are all live. More modules land in Phase 2 and 3.",
    imageUrl: null,
    publishAt: Timestamp.fromDate(new Date()),
    createdBy: groupAdmin.uid,
  });
  await db.collection("bulletins").add({
    title: "Q3 Wasiat Awareness Campaign kicks off",
    body: "New collateral is available for all units. Reach out to your KDE for the latest talking points and client deck.",
    imageUrl: null,
    publishAt: Timestamp.fromDate(new Date(Date.now() - 1000 * 60 * 60 * 24 * 3)),
    createdBy: groupAdmin.uid,
  });

  console.log("Seed complete.\n");
  console.log("Test accounts (all use the same password):\n");
  console.table(seededTable);
  console.log(`\nPassword for every account above: ${PASSWORD}`);
  console.log("\nEmulator UI: http://127.0.0.1:4000");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
