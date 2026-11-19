// Perancangan sale details for analysis (agreed 2026-11-19): one total
// amount (no Wasiat/Hibah split), the products in the plan (names only, no
// per-product amount), an optional promotion, and the deposit paid, which is
// recorded as a collection. Client-safe.

/** Suggestions only — daie can type any other product. From the FY24/25 product report plus the PIC's examples. */
export const PRODUCT_SUGGESTIONS = [
  "Hibah Komprehensif Hartanah",
  "Pra Hibah Hartanah",
  "Hibah Tabung Haji",
  "Pra Hibah Tabung Haji",
  "Hibah Barang Kemas",
  "Hibah Unit Trust",
  "Hibah ASB",
  "At Tijarah",
  "Kasihku",
  "Wasiat",
];

/** Suggestions only — any other promotion can be typed. */
export const PROMOTION_SUGGESTIONS = ["Promosi HK 45%", "Promosi Merdeka", "Hibah RM499"];

const MAX_PRODUCTS = 15;
const MAX_LEN = 80;

/** Trimmed, blank lines dropped, duplicates (any case) removed. */
export function cleanProducts(lines: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of lines) {
    const p = raw.trim().replace(/\s+/g, " ").slice(0, MAX_LEN);
    if (!p || seen.has(p.toLowerCase())) continue;
    seen.add(p.toLowerCase());
    out.push(p);
    if (out.length >= MAX_PRODUCTS) break;
  }
  return out;
}

export function cleanPromotion(text: string): string | null {
  const p = text.trim().replace(/\s+/g, " ").slice(0, MAX_LEN);
  return p || null;
}

/**
 * Al Wasitah packages (2026-11-19: Intan and Khairat Pusaka Silver / Gold
 * added). Every package counts as a Wasitah case everywhere — totals,
 * Al-Wasitah RT, the DM->DPM quota.
 */
export const WASITAH_PACKAGES = [
  { value: "berlian", label: "Berlian" },
  { value: "mutiara", label: "Mutiara" },
  { value: "intan", label: "Intan" },
  { value: "khairat_silver", label: "Khairat Pusaka Silver" },
  { value: "khairat_gold", label: "Khairat Pusaka Gold" },
] as const;
export type WasitahPackage = (typeof WASITAH_PACKAGES)[number]["value"];

export function wasitahLabel(value: string | null | undefined): string {
  return WASITAH_PACKAGES.find((p) => p.value === value)?.label ?? "Other";
}

/** "Berlian 2 · Intan 1" — only packages with cases; "" when none. */
export function wasitahBreakdown(byPackage: Partial<Record<string, number>>): string {
  return WASITAH_PACKAGES.filter((p) => (byPackage[p.value] ?? 0) > 0)
    .map((p) => `${p.label} ${byPackage[p.value]}`)
    .join(" · ");
}

/** A Perancangan case a payment can be recorded against. */
export interface CaseOption {
  id: string;
  /** e.g. "12 Nov 2026 · RM 10,000 · Hibah Komprehensif Hartanah, ASB" */
  label: string;
  prospectId: string | null;
}
