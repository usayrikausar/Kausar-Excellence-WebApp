import type { UnitId, PipppasStage, ProspectSource, ProfessionType, GovernmentTahap, IncomeBracket } from "./types";

export const UNIT_LABELS: Record<UnitId, string> = {
  "kausar-wealth": "Kausar Wealth",
  "kausar-global": "Kausar Global",
  "kausar-aspire": "Kausar Aspire",
  "kausar-intisar": "Kausar Intisar",
  "kausar-nusrah": "Kausar Nusrah",
};

// Client-safe (no "server-only" dependency) so both Server Components and
// Client Components (e.g. team-tree.tsx) can use it.
export function unitLabel(unitId: string, units: Record<string, string>) {
  return units[unitId] ?? UNIT_LABELS[unitId as UnitId] ?? unitId;
}

export const RANK_LABELS = {
  KDE: "Ketua Daie Eksekutif",
  DPM: "Daie Profesional Mawarith",
  DM: "Daie Mawarith",
} as const;

/** PIPPPAS stage labels, in pipeline order — see PIPPPAS_STAGES in lib/types.ts. */
export const STAGE_LABELS: Record<PipppasStage, string> = {
  prospecting: "Prospecting",
  initial_contact: "Initial Contact",
  present: "Present",
  prepare_solution: "Prepare Solution",
  present_solution: "Present Solution",
  administration: "Administration",
  signing_akad: "Signing & Akad",
  safekeeping: "Safekeeping & Delivery",
};

/**
 * Shared between a prospect's lead source and a logged activity's type — see
 * PROSPECT_SOURCES in lib/types.ts. "training" is only ever offered as an
 * *activity* type (see log-activity-form.tsx) — new-prospect-dialog.tsx
 * filters it out of the Source picker, since "how did you meet this
 * prospect" and "I attended a training session" aren't the same kind of
 * thing, even though both feed the same reach/traffic-light bookkeeping.
 */
export const SOURCE_LABELS: Record<ProspectSource, string> = {
  booth: "Booth",
  live_tiktok: "Live TikTok",
  social_media: "Social Media",
  direct_approach: "Direct Approach",
  referral: "Referral",
  talk: "Talk",
  training: "Training",
  project200: "Project 200",
  other: "Other",
};

/** Work/profession — see PROFESSION_TYPES in lib/types.ts. */
export const PROFESSION_LABELS: Record<ProfessionType, string> = {
  c_level: "C-Level",
  top_management: "Top Management",
  management: "Management",
  executive: "Executive",
  business_owner: "Business Owner",
  self_employed: "Self Employed",
  retired: "Retired",
  others: "Others",
};

/** Malaysian public-sector service group — see GOVERNMENT_TAHAP in lib/types.ts for why this is deliberately coarse. */
export const GOVERNMENT_TAHAP_LABELS: Record<GovernmentTahap, string> = {
  not_applicable: "Not applicable",
  kumpulan_pelaksana: "Kumpulan Pelaksana",
  kumpulan_pengurusan_profesional: "Kumpulan Pengurusan & Profesional",
  kumpulan_pengurusan_tertinggi: "Kumpulan Pengurusan Tertinggi",
};

/** See INCOME_BRACKETS in lib/types.ts. */
export const INCOME_BRACKET_LABELS: Record<IncomeBracket, string> = {
  below_5k: "RM5,000 and below",
  "5k_10k": "RM5,000 – RM10,000",
  "10k_15k": "RM10,000 – RM15,000",
  "15k_20k": "RM15,000 – RM20,000",
  above_20k: "RM20,000 and above",
};

export interface NavItem {
  href: string;
  label: string;
  /** Placeholder pages that render "Coming in Phase N" instead of real content. */
  phase?: 2 | 3;
  /** Only rendered for Group Admins. */
  adminOnly?: boolean;
  /** Only rendered for KDEs and daie flagged as Kausar Leadership Programme members. */
  ldpOnly?: boolean;
}

// Order matches the agreed left-nav IA. Every rank sees all 10 items — real
// hierarchy data shows a DM can sponsor their own downline (rank alone
// doesn't determine who has a team), so My Team is always visible and just
// renders "No downline yet." for anyone with none.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home" },
  { href: "/bulletin", label: "Bulletin" },
  { href: "/my-goal", label: "My Goal" },
  { href: "/team", label: "My Team" },
  { href: "/wall-of-fame", label: "My Wall of Fame" },
  { href: "/my-onboarding", label: "My Onboarding" },
  { href: "/sales", label: "Sales & Collection" },
  { href: "/activities", label: "Activities" },
  { href: "/cpd", label: "CPD & Training" },
  { href: "/ldp", label: "LDP", phase: 2, ldpOnly: true },
  { href: "/leaders-tool", label: "Leaders Tool", phase: 2, ldpOnly: true },
  { href: "/mr-k", label: "Mr K", phase: 3 },
  { href: "/reports", label: "Reports" },
  { href: "/admin", label: "Admin", adminOnly: true },
];
