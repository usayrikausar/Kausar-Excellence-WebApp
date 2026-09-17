# Parses the 5 unit "(HRT) <unit>" tabs of the Konvensyen monthly workbook
# into month-by-month Perancangan sales records (one row per person per
# month with a nonzero figure), superseding the earlier
# parse-konvensyen-monthly.mjs / konvensyen_monthly_perancangan.json, which
# collapsed an entire year of production into a single lump total dated
# "today" -- that's what broke Reports' month filter (everything landed in
# whichever month the import happened to run) and inflated whatever month
# it did land in.
#
# The sheet's own 18 month columns (JUL..DEC, JAN..JUNE, JULY..DEC again)
# span two calendar years for FY 25/26: JUL-DEC = 2025, JAN-JUNE = 2026,
# then JULY/OGOS/SEPT/OCT/NOV/DEC (the second occurrence, positionally
# after JUNE) = Jul-Dec 2026. Confirmed against the sheet's own "at at 14
# September 2026" snapshot note and the Perunding Whole.xlsx cross-check
# (today = 2026-09-18): the second SEPT column is the current, still-filling
# month, and the columns after it are blank (future).
#
# Usage: python scripts/parse_konvensyen_monthly_v2.py "<path to xlsx>"

import sys
import json
from collections import Counter

import openpyxl

MONTH_SEQUENCE = [
    ("JUL", "2025-07"), ("AUG", "2025-08"), ("SEPT", "2025-09"), ("OCT", "2025-10"),
    ("NOV", "2025-11"), ("DEC", "2025-12"), ("JAN", "2026-01"), ("FEB", "2026-02"),
    ("MARCH", "2026-03"), ("APRIL", "2026-04"), ("MAY", "2026-05"), ("JUNE", "2026-06"),
    ("JULY", "2026-07"), ("OGOS", "2026-08"), ("SEPT", "2026-09"), ("OCT", "2026-10"),
    ("NOV", "2026-11"), ("DEC", "2026-12"),
]

TABS = ["(HRT) KWM", "(HRT) KG", "(HRT) KA", "(HRT) INTISAR", "(HRT) NUSRAH"]


def parse_money(v):
    if v is None:
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).replace(",", "").strip()
    try:
        return float(s)
    except ValueError:
        return 0.0


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/parse_konvensyen_monthly_v2.py <path to xlsx>")
        sys.exit(1)

    wb = openpyxl.load_workbook(sys.argv[1], data_only=True)
    records = []  # {daieId, name, unit, monthKey, amount}
    skipped_no_kod = []

    for tab in TABS:
        ws = wb[tab]
        header_row_idx = None
        for r in range(1, min(ws.max_row, 10) + 1):
            row = [ws.cell(row=r, column=c).value for c in range(1, ws.max_column + 1)]
            if "KOD" in row and "NAMA PERUNDING" in row:
                header_row_idx = r
                header = row
                break
        if header_row_idx is None:
            print(f"{tab}: no header row found, skipping")
            continue

        # Month column LABELS drift across tabs (KWM uses "OGOS" for the
        # second August; others use "AUG 2"; Intisar is missing "OCT 2"
        # outright and has a stray unlabeled "Column 29" instead) -- too
        # inconsistent to match by name. Every tab agrees on position
        # though: the 18 month columns sit contiguously between "DPM" and
        # "JUMLAH", in chronological order, so slice by position and zip
        # against the known sequence instead.
        dpm_idx = header.index("DPM")
        jumlah_idx = header.index("JUMLAH")
        month_positions = list(range(dpm_idx + 1, jumlah_idx))
        month_col_idx = [(MONTH_SEQUENCE[i][1], month_positions[i]) for i in range(min(len(month_positions), len(MONTH_SEQUENCE)))]

        kod_idx = header.index("KOD")
        name_idx = header.index("NAMA PERUNDING")

        unit = tab.replace("(HRT) ", "").strip().lower()
        row_count = 0
        for r in range(header_row_idx + 1, ws.max_row + 1):
            name = ws.cell(row=r, column=name_idx + 1).value
            if not name:
                continue
            kod = ws.cell(row=r, column=kod_idx + 1).value
            if kod is None:
                skipped_no_kod.append({"unit": unit, "name": str(name).strip()})
                continue
            daie_id = str(kod).strip()
            row_count += 1
            for month_key, idx in month_col_idx:
                if idx is None:
                    continue
                amount = parse_money(ws.cell(row=r, column=idx + 1).value)
                if amount > 0:
                    records.append({"daieId": daie_id, "name": str(name).strip(), "unit": unit, "monthKey": month_key, "amount": amount})
        print(f"{tab}: {row_count} people")

    # Sum duplicates: same person can appear in more than one unit tab
    # (moved units/mentors mid-year -- see the earlier pass's finding), and
    # in rare cases could have >0 in the same month across two tabs.
    combined = {}
    for rec in records:
        key = (rec["daieId"], rec["monthKey"])
        if key in combined:
            combined[key]["amount"] += rec["amount"]
        else:
            combined[key] = dict(rec)

    final = list(combined.values())
    out_path = "scripts/konvensyen_monthly_by_month.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(final, f, indent=1, ensure_ascii=False)

    by_daie = Counter(r["daieId"] for r in final)
    print(f"\nWrote {out_path}: {len(final)} (daie, month) records for {len(by_daie)} unique daie.")
    print(f"Rows with a name but no KOD (skipped): {len(skipped_no_kod)}")
    if skipped_no_kod:
        for s in skipped_no_kod[:10]:
            print(" ", s)


if __name__ == "__main__":
    main()
