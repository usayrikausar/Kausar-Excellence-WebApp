export type Rank = "KDE" | "DPM" | "DM";
export type StructureType = "TS" | "OS";
export type SubscriptionStatus = "active" | "inactive";

export const UNIT_IDS = [
  "kausar-wealth",
  "kausar-global",
  "kausar-aspire",
  "kausar-intisar",
  "kausar-nusrah",
] as const;
export type UnitId = (typeof UNIT_IDS)[number];

export interface UnitDoc {
  name: string;
}

export interface UserDoc {
  daieId: string;
  name: string;
  email: string;
  rank: Rank;
  unitId: string;
  uplineId: string | null;
  lineagePath: string[];
  structureType: StructureType;
  subscriptionStatus: SubscriptionStatus;
  isGroupAdmin: boolean;
  /** Kausar Leadership Programme member — grants access to the LDP and Leaders Tool tabs (KDEs get this access regardless of the flag). */
  isLdpMember: boolean;
  /**
   * ISO date (YYYY-MM-DD) the daie's Wasiyyah contract was licensed — entered
   * manually by their introducer/upline once the daie completes onboarding
   * (My Onboarding). null until then. The Wasiyyah contract auto-expires 24
   * months after this date (36 months for KDE, a longer renewal term);
   * expiry is computed from it (see lib/utils.ts's contractExpiryDate), not
   * stored separately, so it can never drift.
   */
  dateLicensed: string | null;
  createdAt?: unknown;
}

/** UserDoc plus its Firestore document id (the Firebase Auth uid). */
export interface CurrentUser extends UserDoc {
  uid: string;
}

export type SalesCategory = "perancangan" | "pengurusan" | "kesPusaka";
export type PengurusanSubCategory = "berlian" | "mutiara";
export type KesPusakaSubCategory = "besar" | "kecil";

export interface SaleDoc {
  uid: string;
  category: SalesCategory;
  subCategory: PengurusanSubCategory | KesPusakaSubCategory | null;
  amount: number | null;
  count: number | null;
  date: unknown;
  createdAt: unknown;
}

/**
 * Plain, client-safe shape of one sale document — kept here (not lib/data.ts,
 * which is "server-only") so analytics helpers and any Client Component that
 * ends up rendering individual entries can import the type without dragging
 * the Admin SDK into the browser bundle via a type-only import (Turbopack's
 * client/server module graph creates a dependency edge for that in practice
 * — see team-tree.tsx for where this bit us the first time).
 */
export interface SaleEntry {
  id: string;
  uid: string;
  category: SalesCategory;
  subCategory: PengurusanSubCategory | KesPusakaSubCategory | null;
  amount: number | null;
  count: number | null;
  /** ISO date string — Firestore Timestamps can't cross into Client Components. */
  date: string;
}

export interface CollectionDoc {
  uid: string;
  saleRef: string;
  amountCollected: number;
  date: unknown;
}

export interface BulletinDoc {
  title: string;
  body: string;
  imageUrl: string | null;
  publishAt: unknown;
  createdBy: string;
}

export type ContestSection = "wasiyyah" | "kausar";

/** One row of a contest's target table — free-form so it can represent per-rank/individual-vs-kumpulan tiers without a fixed schema (e.g. "Dai'e Mawarith (Individu)" -> 100000). */
export interface ContestTarget {
  label: string;
  amount: number;
}

export interface ContestDoc {
  section: ContestSection;
  title: string;
  posterUrl: string | null;
  requirements: string;
  startDate: string; // ISO date
  endDate: string; // ISO date
  targets: ContestTarget[];
  rewardDescription: string;
  createdBy: string;
  createdAt: unknown;
}

/**
 * One daie's self-reported running total against one contest. Self-reported
 * rather than computed — the app's sales/collections ledger isn't scoped to
 * a contest's date window, and Kausar's activity-based contests (prospecting
 * calls, presentations) aren't tracked anywhere yet.
 */
export interface ContestProgressDoc {
  contestId: string;
  uid: string;
  amount: number;
  updatedAt: unknown;
}

/**
 * A daie's own stated sales/income targets. salesGoal's progress is computed
 * from their real personal sales total; incomeGoal has no computed progress
 * (the app has no commission/income data model) — it's a stated figure only.
 */
export interface GoalDoc {
  salesGoal: number | null;
  incomeGoal: number | null;
  updatedAt: unknown;
}

/** A badge manually awarded by a group admin — shown on the recipient's Wall of Fame. */
export interface AchievementDoc {
  uid: string;
  title: string;
  category: string;
  description: string;
  dateAwarded: string; // ISO date
  awardedBy: string;
  createdAt: unknown;
}
