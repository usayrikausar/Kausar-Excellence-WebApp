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
  /** Set when this sale closed out a pipeline prospect (see ProspectDoc) — optional, entries can still be logged standalone. */
  prospectId?: string | null;
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
  /** Which sale this payment is for — optional since no UI ever forced picking one; a collection can be logged standalone. */
  saleRef: string | null;
  amountCollected: number;
  date: unknown;
  createdAt: unknown;
  /** Set when this collection is tied to a pipeline prospect (see ProspectDoc) — optional. */
  prospectId?: string | null;
}

/** Plain, client-safe shape of one collection (payment) entry — same rationale as SaleEntry. */
export interface CollectionEntry {
  id: string;
  uid: string;
  amountCollected: number;
  date: string; // ISO
  prospectId: string | null;
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

/**
 * A daie's own self-reported Al Wasitah subscription status — the app has no
 * real billing feed for Wasiyyah's Al Wasitah product, so this is stated by
 * the daie themself, same rationale as ContestProgressDoc. Feeds the DM→DPM
 * promotion-quota tracker (see lib/promotion.ts), which needs "since" to
 * check the "≥3 months active" bar on a candidate's recruited DMs.
 */
export interface WasitahSubscriptionDoc {
  active: boolean;
  since: string | null; // ISO date
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

// --- PIPPPAS pipeline (Activities) ------------------------------------------

/** Where a lead came from — shared between a prospect's origin and a logged activity's type. */
export const PROSPECT_SOURCES = [
  "booth",
  "live_tiktok",
  "social_media",
  "direct_approach",
  "referral",
  "talk",
  "training",
  "project200",
  "other",
] as const;
export type ProspectSource = (typeof PROSPECT_SOURCES)[number];

/** PIPPPAS stages, in pipeline order — Prospecting, Initial Contact, Present, Prepare Solution, Present Solution, Administration, Signing & Akad, Safekeeping & Delivery. */
export const PIPPPAS_STAGES = [
  "prospecting",
  "initial_contact",
  "present",
  "prepare_solution",
  "present_solution",
  "administration",
  "signing_akad",
  "safekeeping",
] as const;
export type PipppasStage = (typeof PIPPPAS_STAGES)[number];

export type ProspectStatus = "active" | "closed_won" | "closed_lost";

/** Work/profession — used to segment a daie's prospect/client list for analytics. */
export const PROFESSION_TYPES = [
  "c_level",
  "top_management",
  "management",
  "executive",
  "business_owner",
  "self_employed",
  "retired",
  "others",
] as const;
export type ProfessionType = (typeof PROFESSION_TYPES)[number];

/**
 * Malaysian public-sector service group — deliberately the 3 broad JPA
 * groups (Kumpulan Pelaksana / Pengurusan & Profesional / Pengurusan
 * Tertinggi), not the full Gred/JUSA/Turus grade taxonomy — the user
 * explicitly asked for something simple here, not grade-code-accurate.
 * "not_applicable" covers every prospect who isn't a civil servant.
 */
export const GOVERNMENT_TAHAP = [
  "not_applicable",
  "kumpulan_pelaksana",
  "kumpulan_pengurusan_profesional",
  "kumpulan_pengurusan_tertinggi",
] as const;
export type GovernmentTahap = (typeof GOVERNMENT_TAHAP)[number];

export const INCOME_BRACKETS = ["below_5k", "5k_10k", "10k_15k", "15k_20k", "above_20k"] as const;
export type IncomeBracket = (typeof INCOME_BRACKETS)[number];

export interface ProspectDoc {
  uid: string;
  name: string;
  phone: string | null;
  details: string | null;
  source: ProspectSource;
  stage: PipppasStage;
  status: ProspectStatus;
  nextFollowUpDate: string | null; // ISO date
  /** Set once this prospect closes into a real sale (see SaleDoc.prospectId). */
  linkedSaleId: string | null;
  createdAt: unknown;
  updatedAt: unknown;

  // --- Client profile — filled in over time, not necessarily at creation;
  // powers future per-daie prospect/client analytics (income/profession
  // segmentation etc.), all optional. ---
  age: number | null;
  birthdate: string | null; // ISO date
  email: string | null;
  profession: ProfessionType | null;
  /** Free text, only meaningful when profession === "others". */
  professionOther: string | null;
  governmentTahap: GovernmentTahap | null;
  /** Company / jabatan / organization name. */
  organizationName: string | null;
  incomeBracket: IncomeBracket | null;
  /** An important date to remember — anniversary, spouse's birthday, etc. importantDateLabel names what it is. */
  importantDate: string | null; // ISO date
  importantDateLabel: string | null;
  /** Faraid (Islamic inheritance) heirs — free text, deliberately unstructured since heir composition varies a lot per family. */
  faraidNotes: string | null;
}

/**
 * One dated note per stage a prospect passes through — written on every stage
 * change, including the very first one at creation. `uid` is denormalized
 * (always equals the parent prospect's uid, since only the owner ever writes
 * these) so a collectionGroup("updates") query can filter by daie without an
 * extra lookup per prospect — used to count "first time a prospect reached
 * Present" for the traffic-light presentation score.
 */
export interface ProspectUpdateDoc {
  uid: string;
  stage: PipppasStage;
  note: string;
  nextFollowUpDate: string | null;
  createdAt: unknown;
}

/**
 * Client-safe, plain shape of one update — same rationale as SaleEntry
 * (Firestore Timestamps can't cross into Client Components).
 */
export interface ProspectUpdateEntry {
  id: string;
  prospectId: string;
  uid: string;
  stage: PipppasStage;
  note: string;
  nextFollowUpDate: string | null;
  createdAt: string; // ISO
}

/** A logged prospecting/training activity, not necessarily tied to one named prospect (e.g. a booth reaching many people at once). */
export interface ActivityDoc {
  uid: string;
  type: ProspectSource;
  /** People reached by this activity — 0/omitted for non-reach types like training. */
  reachCount: number;
  note: string | null;
  date: string; // ISO date
  createdAt: unknown;
}

export interface ActivityEntry {
  id: string;
  uid: string;
  type: ProspectSource;
  reachCount: number;
  note: string | null;
  date: string;
}
