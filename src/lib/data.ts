import "server-only";

// Server-side Firestore reads for Server Components, via the Admin SDK
// (bypasses firestore.rules). This is safe here the same way it is in
// rotan-pantang-spa's lib/auth.ts: every page/layout that calls these has
// already been through requireDaie()/requireGroupAdmin() in
// lib/auth/session.ts, and the lineage-scoping below re-implements the same
// "own lineage or group admin" logic the rules enforce for direct client
// reads/writes (sales & collection entry, bulletin posting).

import { adminDb } from "@/lib/firebase/admin";
import type {
  CurrentUser,
  SaleDoc,
  SaleEntry,
  CollectionDoc,
  BulletinDoc,
  ContestDoc,
  ContestProgressDoc,
  GoalDoc,
  AchievementDoc,
  ProspectDoc,
  ProspectUpdateDoc,
  ProspectUpdateEntry,
  ActivityDoc,
  ActivityEntry,
  WasitahSubscriptionDoc,
  CollectionEntry,
  TrainingDoc,
  TrainingWithId,
  TrainingAttendanceDoc,
  TrainingAttendanceEntry,
} from "@/lib/types";
import { computeOnboardingStatus, type OnboardingStatus } from "@/lib/onboarding";
import { UNIT_LABELS } from "@/lib/constants";
import { isActiveStatus } from "@/lib/utils";
import { computeMonthlyScore, type MonthKey, type MonthlyScore } from "@/lib/scoring";
import { computeDpmPromotionStatus, type DpmPromotionStatus, type RecruitInput } from "@/lib/promotion";
import { computeKonvensyenProgress, isRookieEligible, isWithinKonvensyenPeriod, type KonvensyenCriterion } from "@/lib/konvensyen";
import type { QueryDocumentSnapshot, DocumentData } from "firebase-admin/firestore";

/**
 * Builds a plain CurrentUser from a Firestore doc — explicitly, not via
 * `...doc.data()`. A raw spread carries over Timestamp class instances
 * (createdAt), which Next.js refuses to pass from a Server Component into
 * any of the Client Components these lists eventually feed (team table,
 * admin user table, create/edit-user forms).
 */
function toCurrentUser(doc: QueryDocumentSnapshot<DocumentData>): CurrentUser {
  const data = doc.data();
  return {
    uid: doc.id,
    daieId: data.daieId,
    name: data.name,
    email: data.email,
    rank: data.rank,
    unitId: data.unitId,
    uplineId: data.uplineId ?? null,
    lineagePath: data.lineagePath ?? [],
    structureType: data.structureType,
    subscriptionStatus: data.subscriptionStatus,
    isGroupAdmin: data.isGroupAdmin === true,
    isLdpMember: data.isLdpMember === true,
    dateLicensed: data.dateLicensed ?? null,
  };
}

export interface TeamMember extends CurrentUser {
  /** Perancangan only — Wasitah and Pusaka are their own totals below, per the requested column breakdown. */
  salesTotal: number;
  collectionTotal: number;
  /** Pengurusan (Al Wasitah) case count — Berlian + Mutiara combined. */
  wasitahTotal: number;
  /** Kes Pusaka RM — Besar + Kecil combined. */
  pusakaTotal: number;
}

export interface SalesTotals {
  /** Combined Wasiat + Hibah RM — this is THE figure used everywhere else in the app (sales totals, the DM->DPM promotion quota, Rookie Perancangan). Splitting into perancanganWasiat/perancanganHibah below never changes what this means. */
  perancangan: number; // RM
  perancanganWasiat: number; // RM — subset of perancangan
  perancanganHibah: number; // RM — subset of perancangan, for Konvensyen's Hibah Round Table
  pengurusanBerlian: number; // count
  pengurusanMutiara: number; // count
  kesPusakaBesar: number; // RM
  kesPusakaKecil: number; // RM
  collectionTotal: number; // RM
}

export async function getUnits(): Promise<Record<string, string>> {
  const snap = await adminDb.collection("units").get();
  if (snap.empty) return UNIT_LABELS as Record<string, string>;
  const out: Record<string, string> = {};
  snap.forEach((doc) => {
    out[doc.id] = (doc.data().name as string) ?? doc.id;
  });
  return out;
}

/** Single user by uid, or null if they don't exist — for detail pages (e.g. the printable report card) keyed by uid rather than the viewer's own session. */
export async function getUserByUid(uid: string): Promise<CurrentUser | null> {
  const doc = await adminDb.collection("users").doc(uid).get();
  if (!doc.exists) return null;
  return toCurrentUser(doc as QueryDocumentSnapshot<DocumentData>);
}

/** Batched getUserByUid for a list of uids (e.g. resolving names for a training's attendance list) — chunked the same way as getSaleEntriesForUids. */
export async function getUsersByUids(uids: string[]): Promise<CurrentUser[]> {
  const unique = [...new Set(uids)];
  if (unique.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += 30) chunks.push(unique.slice(i, i + 30));

  const results = await Promise.all(
    chunks.map((chunk) => adminDb.collection("users").where("__name__", "in", chunk).get()),
  );
  return results.flatMap((snap) => snap.docs.map(toCurrentUser));
}

/** Everyone in `user`'s downline (does NOT include `user` themself). Group admins get everyone. */
export async function getDownline(user: CurrentUser): Promise<CurrentUser[]> {
  const query = user.isGroupAdmin
    ? adminDb.collection("users")
    : adminDb.collection("users").where("lineagePath", "array-contains", user.uid);

  const snap = await query.get();
  return snap.docs.map(toCurrentUser).filter((u) => u.uid !== user.uid);
}

export async function getSalesTotalsForUid(uid: string): Promise<SalesTotals> {
  const totals: SalesTotals = {
    perancangan: 0,
    perancanganWasiat: 0,
    perancanganHibah: 0,
    pengurusanBerlian: 0,
    pengurusanMutiara: 0,
    kesPusakaBesar: 0,
    kesPusakaKecil: 0,
    collectionTotal: 0,
  };

  const [salesSnap, collectionsSnap] = await Promise.all([
    adminDb.collection("sales").where("uid", "==", uid).get(),
    adminDb.collection("collections").where("uid", "==", uid).get(),
  ]);

  salesSnap.forEach((doc) => {
    const sale = doc.data() as SaleDoc;
    if (sale.category === "perancangan") {
      totals.perancangan += sale.amount ?? 0;
      if (sale.subCategory === "hibah") totals.perancanganHibah += sale.amount ?? 0;
      else totals.perancanganWasiat += sale.amount ?? 0; // "wasiat" and legacy/unspecified entries both count as wasiat by default
    } else if (sale.category === "pengurusan") {
      if (sale.subCategory === "berlian") totals.pengurusanBerlian += sale.count ?? 0;
      if (sale.subCategory === "mutiara") totals.pengurusanMutiara += sale.count ?? 0;
    } else if (sale.category === "kesPusaka") {
      if (sale.subCategory === "besar") totals.kesPusakaBesar += sale.amount ?? 0;
      if (sale.subCategory === "kecil") totals.kesPusakaKecil += sale.amount ?? 0;
    }
  });

  collectionsSnap.forEach((doc) => {
    const collection = doc.data() as CollectionDoc;
    totals.collectionTotal += collection.amountCollected ?? 0;
  });

  return totals;
}

function toSaleEntry(doc: QueryDocumentSnapshot<DocumentData>): SaleEntry {
  const data = doc.data() as SaleDoc;
  const date = data.date as unknown as { toDate: () => Date };
  return {
    id: doc.id,
    uid: data.uid,
    category: data.category,
    subCategory: data.subCategory,
    amount: data.amount,
    count: data.count,
    date: date.toDate().toISOString(),
  };
}

/** Every individual sale entry for one or more daie — for month-by-month breakdowns, "biggest case," and ranking views that a single aggregated total can't answer. */
export async function getSaleEntriesForUids(uids: string[]): Promise<SaleEntry[]> {
  if (uids.length === 0) return [];
  // Firestore "in" queries cap at 30 values — chunk for large teams (KDE
  // downlines can run into the hundreds).
  const chunks: string[][] = [];
  for (let i = 0; i < uids.length; i += 30) chunks.push(uids.slice(i, i + 30));

  const results = await Promise.all(
    chunks.map((chunk) => adminDb.collection("sales").where("uid", "in", chunk).get()),
  );
  return results.flatMap((snap) => snap.docs.map(toSaleEntry));
}

function toCollectionEntry(doc: QueryDocumentSnapshot<DocumentData>): CollectionEntry {
  const data = doc.data() as CollectionDoc;
  const date = data.date as unknown as { toDate: () => Date };
  return {
    id: doc.id,
    uid: data.uid,
    amountCollected: data.amountCollected ?? 0,
    date: date.toDate().toISOString(),
    prospectId: data.prospectId ?? null,
  };
}

/** Every individual collection (payment) entry for one daie — for month-scoped totals (e.g. the printable report card), which the aggregated getSalesTotalsForUid can't answer. */
export async function getCollectionEntriesForUid(uid: string): Promise<CollectionEntry[]> {
  const snap = await adminDb.collection("collections").where("uid", "==", uid).get();
  return snap.docs.map(toCollectionEntry);
}

/** Same as getCollectionEntriesForUid but batched across many daie in one shot (see getSaleEntriesForUids) — for team-wide reports. */
export async function getCollectionEntriesForUids(uids: string[]): Promise<CollectionEntry[]> {
  if (uids.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < uids.length; i += 30) chunks.push(uids.slice(i, i + 30));

  const results = await Promise.all(
    chunks.map((chunk) => adminDb.collection("collections").where("uid", "in", chunk).get()),
  );
  return results.flatMap((snap) => snap.docs.map(toCollectionEntry));
}

export function sumTotals(list: SalesTotals[]): SalesTotals {
  return list.reduce(
    (acc, t) => ({
      perancangan: acc.perancangan + t.perancangan,
      perancanganWasiat: acc.perancanganWasiat + t.perancanganWasiat,
      perancanganHibah: acc.perancanganHibah + t.perancanganHibah,
      pengurusanBerlian: acc.pengurusanBerlian + t.pengurusanBerlian,
      pengurusanMutiara: acc.pengurusanMutiara + t.pengurusanMutiara,
      kesPusakaBesar: acc.kesPusakaBesar + t.kesPusakaBesar,
      kesPusakaKecil: acc.kesPusakaKecil + t.kesPusakaKecil,
      collectionTotal: acc.collectionTotal + t.collectionTotal,
    }),
    { perancangan: 0, perancanganWasiat: 0, perancanganHibah: 0, pengurusanBerlian: 0, pengurusanMutiara: 0, kesPusakaBesar: 0, kesPusakaKecil: 0, collectionTotal: 0 },
  );
}

export interface SalesSummary {
  personalTotals: SalesTotals;
  groupTotals: SalesTotals | null;
  groupStatusCounts: { active: number; expired: number } | null;
}

/**
 * Personal totals + "My Total Group Production" (personal + whole downline,
 * whatever depth) in one shot — used by Sales & Collection, Reports, and
 * elsewhere so the personal-vs-group split stays identical everywhere
 * rather than being recomputed slightly differently per page.
 */
export async function getSalesSummary(user: CurrentUser): Promise<SalesSummary> {
  const [personalTotals, downline] = await Promise.all([getSalesTotalsForUid(user.uid), getDownline(user)]);

  if (downline.length === 0) {
    return { personalTotals, groupTotals: null, groupStatusCounts: null };
  }

  const downlineTotals = await Promise.all(downline.map((m) => getSalesTotalsForUid(m.uid)));
  const groupTotals = sumTotals([personalTotals, ...downlineTotals]);
  const groupStatusCounts = {
    active: downline.filter(isActiveStatus).length,
    expired: downline.filter((m) => !isActiveStatus(m)).length,
  };
  return { personalTotals, groupTotals, groupStatusCounts };
}

export async function getTeamWithTotals(user: CurrentUser): Promise<TeamMember[]> {
  const downline = await getDownline(user);
  const totalsList = await Promise.all(downline.map((member) => getSalesTotalsForUid(member.uid)));
  return downline.map((member, i) => {
    const t = totalsList[i];
    return {
      ...member,
      salesTotal: t.perancangan,
      collectionTotal: t.collectionTotal,
      wasitahTotal: t.pengurusanBerlian + t.pengurusanMutiara,
      pusakaTotal: t.kesPusakaBesar + t.kesPusakaKecil,
    };
  });
}

export async function getRecentBulletins(max = 3): Promise<Array<BulletinDoc & { id: string }>> {
  const snap = await adminDb.collection("bulletins").orderBy("publishAt", "desc").limit(max).get();
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as BulletinDoc) }));
}

export async function getAllBulletins(): Promise<Array<BulletinDoc & { id: string }>> {
  const snap = await adminDb.collection("bulletins").orderBy("publishAt", "desc").get();
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as BulletinDoc) }));
}

export async function getThisMonthBulletinCount(): Promise<number> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const snap = await adminDb.collection("bulletins").where("publishAt", ">=", startOfMonth).get();
  return snap.size;
}

export async function getAllUsers(): Promise<CurrentUser[]> {
  const snap = await adminDb.collection("users").orderBy("daieId").get();
  return snap.docs.map(toCurrentUser);
}

/**
 * Built explicitly (not via `...doc.data()`) for the same reason as
 * toCurrentUser/toSaleEntry — `createdAt` is a Firestore Timestamp class
 * instance, which crashes when passed from this Server Component data
 * fetch into EditContestDialog (a Client Component).
 */
export async function getContests(): Promise<Array<ContestDoc & { id: string }>> {
  const snap = await adminDb.collection("contests").orderBy("endDate", "asc").get();
  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      section: data.section,
      title: data.title,
      posterUrl: data.posterUrl ?? null,
      requirements: data.requirements,
      startDate: data.startDate,
      endDate: data.endDate,
      targets: data.targets ?? [],
      rewardDescription: data.rewardDescription,
      createdBy: data.createdBy,
      createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
    };
  });
}

/** Every self-reported progress doc for a set of uids — chunked the same way as getSaleEntriesForUids for Firestore's 30-value "in" cap. */
export async function getContestProgressForUids(uids: string[]): Promise<ContestProgressDoc[]> {
  if (uids.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < uids.length; i += 30) chunks.push(uids.slice(i, i + 30));

  const results = await Promise.all(
    chunks.map((chunk) => adminDb.collection("contestProgress").where("uid", "in", chunk).get()),
  );
  return results.flatMap((snap) => snap.docs.map((doc) => doc.data() as ContestProgressDoc));
}

export async function getGoal(uid: string): Promise<GoalDoc | null> {
  const doc = await adminDb.collection("goals").doc(uid).get();
  return doc.exists ? (doc.data() as GoalDoc) : null;
}

export async function getAchievementsForUid(uid: string): Promise<Array<AchievementDoc & { id: string }>> {
  const snap = await adminDb.collection("achievements").where("uid", "==", uid).orderBy("dateAwarded", "desc").get();
  return snap.docs.map((doc) => ({ id: doc.id, ...(doc.data() as AchievementDoc) }));
}

// --- PIPPPAS pipeline (Activities) ------------------------------------------

export interface ProspectWithId extends Omit<ProspectDoc, "createdAt" | "updatedAt"> {
  id: string;
  createdAt: string;
  updatedAt: string;
}

function toProspect(doc: QueryDocumentSnapshot<DocumentData>): ProspectWithId {
  const data = doc.data();
  return {
    id: doc.id,
    uid: data.uid,
    name: data.name,
    phone: data.phone ?? null,
    details: data.details ?? null,
    source: data.source,
    stage: data.stage,
    status: data.status,
    nextFollowUpDate: data.nextFollowUpDate ?? null,
    linkedSaleId: data.linkedSaleId ?? null,
    createdAt: data.createdAt?.toDate?.().toISOString() ?? null,
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? null,
    age: data.age ?? null,
    birthdate: data.birthdate ?? null,
    email: data.email ?? null,
    profession: data.profession ?? null,
    professionOther: data.professionOther ?? null,
    governmentTahap: data.governmentTahap ?? null,
    organizationName: data.organizationName ?? null,
    incomeBracket: data.incomeBracket ?? null,
    importantDate: data.importantDate ?? null,
    importantDateLabel: data.importantDateLabel ?? null,
    faraidNotes: data.faraidNotes ?? null,
  };
}

export async function getProspectsForUid(uid: string): Promise<ProspectWithId[]> {
  const snap = await adminDb.collection("prospects").where("uid", "==", uid).get();
  return snap.docs.map(toProspect);
}

function toProspectUpdateEntry(prospectId: string, doc: QueryDocumentSnapshot<DocumentData>): ProspectUpdateEntry {
  const data = doc.data() as ProspectUpdateDoc;
  const createdAt = data.createdAt as unknown as { toDate: () => Date };
  return {
    id: doc.id,
    prospectId,
    uid: data.uid,
    stage: data.stage,
    note: data.note,
    nextFollowUpDate: data.nextFollowUpDate ?? null,
    createdAt: createdAt.toDate().toISOString(),
  };
}

/** Full stage-by-stage history for one prospect, oldest first. */
export async function getUpdatesForProspect(prospectId: string): Promise<ProspectUpdateEntry[]> {
  const snap = await adminDb
    .collection("prospects")
    .doc(prospectId)
    .collection("updates")
    .orderBy("createdAt", "asc")
    .get();
  return snap.docs.map((doc) => toProspectUpdateEntry(prospectId, doc));
}

/**
 * The earliest "reached Present stage" date for each of this daie's
 * prospects (one ISO date per distinct prospect) — used to score the
 * traffic-light presentation count ("first time a prospect reached
 * Present"). A collectionGroup query across every prospect's `updates`
 * subcollection, filtered by the denormalized `uid` field rather than a
 * per-prospect get() — see ProspectUpdateDoc in lib/types.ts.
 */
export async function getPresentStageFirstDatesForUid(uid: string): Promise<string[]> {
  const snap = await adminDb
    .collectionGroup("updates")
    .where("uid", "==", uid)
    .where("stage", "==", "present")
    .orderBy("createdAt", "asc")
    .get();

  const firstByProspect = new Map<string, string>();
  snap.docs.forEach((doc) => {
    const prospectId = doc.ref.parent.parent!.id;
    if (firstByProspect.has(prospectId)) return; // ascending order — first occurrence is the earliest
    const createdAt = doc.data().createdAt as { toDate: () => Date };
    firstByProspect.set(prospectId, createdAt.toDate().toISOString());
  });
  return [...firstByProspect.values()];
}

function toActivityEntry(doc: QueryDocumentSnapshot<DocumentData>): ActivityEntry {
  const data = doc.data() as ActivityDoc;
  return {
    id: doc.id,
    uid: data.uid,
    type: data.type,
    reachCount: data.reachCount ?? 0,
    note: data.note ?? null,
    date: data.date,
  };
}

/** Every logged activity for one daie (all-time — callers filter by month via lib/scoring.ts). */
export async function getActivitiesForUid(uid: string): Promise<ActivityEntry[]> {
  const snap = await adminDb.collection("activities").where("uid", "==", uid).get();
  return snap.docs.map(toActivityEntry);
}

/** Everything computeMonthlyScore needs for one daie, fetched and combined in one call. */
export async function getMonthlyScoreForUid(uid: string, monthKey: MonthKey): Promise<MonthlyScore> {
  const [activities, presentDates, saleEntries] = await Promise.all([
    getActivitiesForUid(uid),
    getPresentStageFirstDatesForUid(uid),
    getSaleEntriesForUids([uid]),
  ]);
  return computeMonthlyScore(monthKey, activities, presentDates, saleEntries);
}

// --- DM → DPM promotion-quota tracker ---------------------------------------

export async function getWasitahSubscription(uid: string): Promise<{ active: boolean; since: string | null }> {
  const doc = await adminDb.collection("wasitahSubscription").doc(uid).get();
  if (!doc.exists) return { active: false, since: null };
  const data = doc.data() as WasitahSubscriptionDoc;
  return { active: data.active === true, since: data.since ?? null };
}

/** DM daie this uid directly recruited (uplineId === uid) — the "5 DM dilantik" pool, not the whole downline. */
async function getDirectDmRecruits(uid: string): Promise<CurrentUser[]> {
  const snap = await adminDb.collection("users").where("uplineId", "==", uid).where("rank", "==", "DM").get();
  return snap.docs.map(toCurrentUser);
}

/**
 * Full DM→DPM promotion status for one daie, as of today. Fetches this
 * daie's own sales totals + Al Wasitah subscription, then the same for every
 * DM they directly recruited (small N — bounded by the 5-DM quota itself,
 * not a whole downline scan), and hands it all to the pure calculator in
 * lib/promotion.ts.
 */
export async function getDpmPromotionStatusForUid(user: CurrentUser): Promise<DpmPromotionStatus> {
  const asOfIso = new Date().toISOString().slice(0, 10);
  const [totals, selfWasitah, recruits] = await Promise.all([
    getSalesTotalsForUid(user.uid),
    getWasitahSubscription(user.uid),
    getDirectDmRecruits(user.uid),
  ]);

  const recruitInputs: RecruitInput[] = await Promise.all(
    recruits.map(async (r): Promise<RecruitInput> => {
      const [recruitTotals, recruitWasitah] = await Promise.all([getSalesTotalsForUid(r.uid), getWasitahSubscription(r.uid)]);
      return {
        uid: r.uid,
        name: r.name,
        perancangan: recruitTotals.perancangan,
        wasitahActive: recruitWasitah.active,
        wasitahSince: recruitWasitah.since,
      };
    }),
  );

  return computeDpmPromotionStatus({
    asOfIso,
    alWasitahKes: totals.pengurusanBerlian + totals.pengurusanMutiara,
    perancangan: totals.perancangan,
    dateLicensed: user.dateLicensed,
    selfWasitahActive: selfWasitah.active,
    recruits: recruitInputs,
  });
}

// --- Printable Team Report (traffic light / sales by category / convention qualifiers) ------

export interface TeamReportRow {
  uid: string;
  name: string;
  daieId: string;
  rank: CurrentUser["rank"];
  unitId: string;
  score: MonthlyScore;
  sales: SalesTotals;
  konvensyen: KonvensyenCriterion[];
  konvensyenQualified: boolean;
}

/**
 * One row per downline member, with everything the printable Team Report
 * needs across all three of its views. Group admins' `getDownline` already
 * returns everyone across all 5 units; anyone else (a KDE, a DPM) gets just
 * their own lineage — so this one function naturally serves both "super
 * admin prints the whole company" and "each group's own leader prints their
 * own group" without any special-casing.
 *
 * Sales/collection entries are fetched once in two BATCHED queries for the
 * whole team (bounded by getSaleEntriesForUids' chunking, not one query per
 * member) since a group admin's downline can run into the hundreds. Monthly
 * scores still cost one getMonthlyScoreForUid per member — same as the
 * existing Reports page already pays — since that itself composes 3
 * different per-uid queries and isn't easily batched further.
 */
export async function getTeamReportRows(user: CurrentUser, monthKey: MonthKey): Promise<TeamReportRow[]> {
  const downline = await getDownline(user);
  if (downline.length === 0) return [];

  const uids = downline.map((m) => m.uid);
  const [saleEntries, collectionEntries, scores] = await Promise.all([
    getSaleEntriesForUids(uids),
    getCollectionEntriesForUids(uids),
    Promise.all(downline.map((m) => getMonthlyScoreForUid(m.uid, monthKey))),
  ]);

  const salesByUid = new Map<string, SaleEntry[]>();
  for (const e of saleEntries) {
    const list = salesByUid.get(e.uid) ?? [];
    list.push(e);
    salesByUid.set(e.uid, list);
  }
  const collectedByUid = new Map<string, number>();
  for (const c of collectionEntries) collectedByUid.set(c.uid, (collectedByUid.get(c.uid) ?? 0) + c.amountCollected);

  return downline.map((member, i) => {
    const entries = salesByUid.get(member.uid) ?? [];
    const sales: SalesTotals = {
      perancangan: entries.filter((e) => e.category === "perancangan").reduce((s, e) => s + (e.amount ?? 0), 0),
      perancanganWasiat: entries.filter((e) => e.category === "perancangan" && e.subCategory !== "hibah").reduce((s, e) => s + (e.amount ?? 0), 0),
      perancanganHibah: entries.filter((e) => e.category === "perancangan" && e.subCategory === "hibah").reduce((s, e) => s + (e.amount ?? 0), 0),
      pengurusanBerlian: entries.filter((e) => e.category === "pengurusan" && e.subCategory === "berlian").reduce((s, e) => s + (e.count ?? 0), 0),
      pengurusanMutiara: entries.filter((e) => e.category === "pengurusan" && e.subCategory === "mutiara").reduce((s, e) => s + (e.count ?? 0), 0),
      kesPusakaBesar: entries.filter((e) => e.category === "kesPusaka" && e.subCategory === "besar").reduce((s, e) => s + (e.amount ?? 0), 0),
      kesPusakaKecil: entries.filter((e) => e.category === "kesPusaka" && e.subCategory === "kecil").reduce((s, e) => s + (e.amount ?? 0), 0),
      collectionTotal: collectedByUid.get(member.uid) ?? 0,
    };

    const periodEntries = entries.filter((e) => isWithinKonvensyenPeriod(e.date));
    const konvensyen = computeKonvensyenProgress({
      alWasitahKesInPeriod: periodEntries.filter((e) => e.category === "pengurusan").reduce((s, e) => s + (e.count ?? 0), 0),
      pusakaAmountInPeriod: periodEntries.filter((e) => e.category === "kesPusaka").reduce((s, e) => s + (e.amount ?? 0), 0),
      perancanganInPeriod: periodEntries.filter((e) => e.category === "perancangan").reduce((s, e) => s + (e.amount ?? 0), 0),
      hibahInPeriod: periodEntries.filter((e) => e.category === "perancangan" && e.subCategory === "hibah").reduce((s, e) => s + (e.amount ?? 0), 0),
      rookieEligible: isRookieEligible(member.dateLicensed),
    });

    return {
      uid: member.uid,
      name: member.name,
      daieId: member.daieId,
      rank: member.rank,
      unitId: member.unitId,
      score: scores[i],
      sales,
      konvensyen,
      konvensyenQualified: konvensyen.every((c) => c.met),
    };
  });
}

// --- CPD & Training -----------------------------------------------------

function toTrainingWithId(doc: QueryDocumentSnapshot<DocumentData>): TrainingWithId {
  const data = doc.data() as TrainingDoc;
  return {
    id: doc.id,
    title: data.title,
    description: data.description ?? null,
    provider: data.provider,
    cpdHours: data.cpdHours,
    date: data.date,
    location: data.location ?? null,
    qrToken: data.qrToken ?? null,
    requiredForOnboarding: data.requiredForOnboarding === true,
    createdBy: data.createdBy,
  };
}

export async function getTrainings(): Promise<TrainingWithId[]> {
  const snap = await adminDb.collection("trainings").orderBy("date", "desc").get();
  return snap.docs.map(toTrainingWithId);
}

export async function getTrainingById(id: string): Promise<TrainingWithId | null> {
  const doc = await adminDb.collection("trainings").doc(id).get();
  if (!doc.exists) return null;
  return toTrainingWithId(doc as QueryDocumentSnapshot<DocumentData>);
}

function toTrainingAttendanceEntry(doc: QueryDocumentSnapshot<DocumentData>): TrainingAttendanceEntry {
  const data = doc.data() as TrainingAttendanceDoc;
  const markedAt = data.markedAt as unknown as { toDate: () => Date } | null;
  return {
    id: doc.id,
    trainingId: data.trainingId,
    uid: data.uid,
    method: data.method,
    markedAt: markedAt ? markedAt.toDate().toISOString() : new Date().toISOString(),
  };
}

/** One specific (training, uid) attendance record, or null — for the QR check-in page's "have you already checked in" check. */
export async function getAttendanceRecordForUid(trainingId: string, uid: string): Promise<TrainingAttendanceEntry | null> {
  const doc = await adminDb.collection("trainingAttendance").doc(`${trainingId}_${uid}`).get();
  if (!doc.exists) return null;
  return toTrainingAttendanceEntry(doc as QueryDocumentSnapshot<DocumentData>);
}

/** Every attendance record for one training — for the admin's per-training attendee list. */
export async function getAttendanceForTraining(trainingId: string): Promise<TrainingAttendanceEntry[]> {
  const snap = await adminDb.collection("trainingAttendance").where("trainingId", "==", trainingId).get();
  return snap.docs.map(toTrainingAttendanceEntry);
}

/** Every attendance record for one daie — for their own CPD summary. */
export async function getAttendanceForUid(uid: string): Promise<TrainingAttendanceEntry[]> {
  const snap = await adminDb.collection("trainingAttendance").where("uid", "==", uid).get();
  return snap.docs.map(toTrainingAttendanceEntry);
}

/** Every attendance record across the whole app — for the admin CPD export (detail + summary are both derived from this one query rather than one query per daie). */
export async function getAllTrainingAttendance(): Promise<TrainingAttendanceEntry[]> {
  const snap = await adminDb.collection("trainingAttendance").get();
  return snap.docs.map(toTrainingAttendanceEntry);
}

export interface CpdSummary {
  totalHours: number;
  kausarHours: number;
  wasiyyahHours: number;
  records: Array<{ training: TrainingWithId; method: TrainingAttendanceEntry["method"]; markedAt: string }>;
}

/** One daie's full CPD picture — total hours (split by provider) and the underlying list of attended trainings, joined in-memory against the (already-fetched) training catalog. */
export function computeCpdSummary(attendance: TrainingAttendanceEntry[], trainingsById: Map<string, TrainingWithId>): CpdSummary {
  const records = attendance
    .map((a) => {
      const training = trainingsById.get(a.trainingId);
      return training ? { training, method: a.method, markedAt: a.markedAt } : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => b.training.date.localeCompare(a.training.date));

  let kausarHours = 0;
  let wasiyyahHours = 0;
  for (const r of records) {
    if (r.training.provider === "kausar") kausarHours += r.training.cpdHours;
    else wasiyyahHours += r.training.cpdHours;
  }

  return { totalHours: kausarHours + wasiyyahHours, kausarHours, wasiyyahHours, records };
}

export async function getCpdSummaryForUid(uid: string): Promise<CpdSummary> {
  const [attendance, trainings] = await Promise.all([getAttendanceForUid(uid), getTrainings()]);
  const trainingsById = new Map(trainings.map((t) => [t.id, t]));
  return computeCpdSummary(attendance, trainingsById);
}

/** My Onboarding status for one daie — see lib/onboarding.ts for the grouping/completion logic. */
export async function getOnboardingStatusForUid(uid: string): Promise<OnboardingStatus> {
  const [trainings, attendance] = await Promise.all([getTrainings(), getAttendanceForUid(uid)]);
  return computeOnboardingStatus(trainings, attendance);
}

// Re-exported for existing server-side call sites — the real definition
// moved to lib/constants.ts (a client-safe module) so Client Components
// like team-tree.tsx can use it without pulling this "server-only" file
// (and the Admin SDK it wraps) into the browser bundle.
export { unitLabel } from "@/lib/constants";
