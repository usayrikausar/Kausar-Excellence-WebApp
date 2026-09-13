import type { SaleEntry } from "@/lib/types";

export interface MonthlyRow {
  month: string; // "2026-07"
  perancangan: number;
  pengurusanBerlian: number;
  pengurusanMutiara: number;
  kesPusakaBesar: number;
  kesPusakaKecil: number;
}

/** Groups raw sale entries into one row per calendar month, sorted oldest to newest. */
export function computeMonthlyBreakdown(entries: SaleEntry[]): MonthlyRow[] {
  const byMonth = new Map<string, MonthlyRow>();
  for (const entry of entries) {
    const month = entry.date.slice(0, 7); // "YYYY-MM-DD..." -> "YYYY-MM"
    if (!byMonth.has(month)) {
      byMonth.set(month, {
        month,
        perancangan: 0,
        pengurusanBerlian: 0,
        pengurusanMutiara: 0,
        kesPusakaBesar: 0,
        kesPusakaKecil: 0,
      });
    }
    const row = byMonth.get(month)!;
    if (entry.category === "perancangan") row.perancangan += entry.amount ?? 0;
    else if (entry.category === "pengurusan") {
      if (entry.subCategory === "berlian") row.pengurusanBerlian += entry.count ?? 0;
      if (entry.subCategory === "mutiara") row.pengurusanMutiara += entry.count ?? 0;
    } else if (entry.category === "kesPusaka") {
      if (entry.subCategory === "besar") row.kesPusakaBesar += entry.amount ?? 0;
      if (entry.subCategory === "kecil") row.kesPusakaKecil += entry.amount ?? 0;
    }
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/** The single highest-Perancangan-RM month, or null if there's no Perancangan activity at all. */
export function findHighestMonth(rows: MonthlyRow[]): MonthlyRow | null {
  return rows.reduce<MonthlyRow | null>((best, row) => {
    if (row.perancangan <= 0) return best;
    if (!best || row.perancangan > best.perancangan) return row;
    return best;
  }, null);
}

/** The single largest individual sale entry (by RM) in the given category — "biggest case size." Only meaningful for RM-based categories (perancangan, kesPusaka), not Pengurusan (counted in cases, not RM). */
export function findBiggestCase(entries: SaleEntry[], category: "perancangan" | "kesPusaka"): SaleEntry | null {
  return entries
    .filter((e) => e.category === category && (e.amount ?? 0) > 0)
    .reduce<SaleEntry | null>((best, e) => (!best || (e.amount ?? 0) > (best.amount ?? 0) ? e : best), null);
}
