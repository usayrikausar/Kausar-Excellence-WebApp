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
/** Wasiat (will) vs Hibah (gift) — both are Perancangan cases; "Perancangan" everywhere in the app (sales totals, the DM->DPM promotion quota, Rookie Perancangan) is the COMBINED wasiat+hibah RM figure, unchanged by this split. This only exists so Hibah can ALSO be tracked on its own for Wasiyyah's Hibah Round Table Konvensyen award, which needs a Hibah-only number. */
export type PerancanganSubCategory = "wasiat" | "hibah";
export type PengurusanSubCategory = "berlian" | "mutiara";
export type KesPusakaSubCategory = "besar" | "kecil";

export interface SaleDoc {
  uid: string;
  category: SalesCategory;
  subCategory: PerancanganSubCategory | PengurusanSubCategory | KesPusakaSubCategory | null;
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
  subCategory: PerancanganSubCategory | PengurusanSubCategory | KesPusakaSubCategory | null;
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

// --- CPD & Training -----------------------------------------------------

/** Who ran the session — drives which attendance method is even possible: Kausar sessions get a QR self-check-in, Wasiyyah's own sessions (Kausar doesn't control the venue) rely on self-reporting. */
export type TrainingProvider = "kausar" | "wasiyyah";

export interface TrainingDoc {
  title: string;
  description: string | null;
  provider: TrainingProvider;
  cpdHours: number;
  date: string; // ISO date
  location: string | null;
  /** Random unguessable token embedded in the check-in QR — only set for provider "kausar". Not a strong security boundary (anyone who sees the QR can check in as themselves), just enough to stop someone guessing a training id and self-checking-in without ever seeing the code. */
  qrToken: string | null;
  /**
   * A MUST-attend session for new daie (My Onboarding), not just optional
   * CPD. Recurring monthly sessions (e.g. "Start Training") are separate
   * docs with the same title — My Onboarding groups by title and treats
   * attending ANY ONE instance as satisfying that requirement, so admin
   * doesn't need any extra linking step beyond naming each month's session
   * consistently. See lib/onboarding.ts.
   */
  requiredForOnboarding: boolean;
  createdBy: string;
  createdAt: unknown;
}

/** Client-safe shape of one training — createdAt (a Timestamp) is dropped, same rationale as ProspectWithId. */
export interface TrainingWithId extends Omit<TrainingDoc, "createdAt"> {
  id: string;
}

export type AttendanceMethod = "qr" | "self_reported" | "manual";

export interface TrainingAttendanceDoc {
  trainingId: string;
  uid: string;
  method: AttendanceMethod;
  /** Only present for method "qr" — the token the client presented, checked against the training's own qrToken by firestore.rules. Kept on the doc afterward as a lightweight audit trail. */
  qrToken: string | null;
  markedBy: string; // uid of whoever wrote this doc — self, except for method "manual" (an admin override)
  markedAt: unknown;
}

export interface TrainingAttendanceEntry {
  id: string;
  trainingId: string;
  uid: string;
  method: AttendanceMethod;
  markedAt: string; // ISO
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
  "prosper_invite",
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
