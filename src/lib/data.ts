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
} from "@/lib/types";
import { UNIT_LABELS } from "@/lib/constants";
import { isActiveStatus } from "@/lib/utils";
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
  perancangan: number; // RM
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

export function sumTotals(list: SalesTotals[]): SalesTotals {
  return list.reduce(
    (acc, t) => ({
      perancangan: acc.perancangan + t.perancangan,
      pengurusanBerlian: acc.pengurusanBerlian + t.pengurusanBerlian,
      pengurusanMutiara: acc.pengurusanMutiara + t.pengurusanMutiara,
      kesPusakaBesar: acc.kesPusakaBesar + t.kesPusakaBesar,
      kesPusakaKecil: acc.kesPusakaKecil + t.kesPusakaKecil,
      collectionTotal: acc.collectionTotal + t.collectionTotal,
    }),
    { perancangan: 0, pengurusanBerlian: 0, pengurusanMutiara: 0, kesPusakaBesar: 0, kesPusakaKecil: 0, collectionTotal: 0 },
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

// Re-exported for existing server-side call sites — the real definition
// moved to lib/constants.ts (a client-safe module) so Client Components
// like team-tree.tsx can use it without pulling this "server-only" file
// (and the Admin SDK it wraps) into the browser bundle.
export { unitLabel } from "@/lib/constants";
