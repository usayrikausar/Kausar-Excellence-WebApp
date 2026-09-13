import type { UnitId } from "./types";

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
  { href: "/my-onboarding", label: "My Onboarding", phase: 2 },
  { href: "/sales", label: "Sales & Collection" },
  { href: "/activities", label: "Activities", phase: 2 },
  { href: "/cpd", label: "CPD & Training", phase: 2 },
  { href: "/ldp", label: "LDP", phase: 2, ldpOnly: true },
  { href: "/leaders-tool", label: "Leaders Tool", phase: 2, ldpOnly: true },
  { href: "/mr-k", label: "Mr K", phase: 3 },
  { href: "/reports", label: "Reports", phase: 2 },
  { href: "/admin", label: "Admin", adminOnly: true },
];
