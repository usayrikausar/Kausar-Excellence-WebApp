"""Parses Kausar's "KONVENSYEN FYP 24/25 KAUSAR GROUP" sheet (SUMMARY tab)
into scripts/fy_history_2425.json for import-fy-history-production.mjs.

SUMMARY has one row per daie who produced in FY24/25: NO. ID (Daie ID),
NAMA, and "TOTAL PERANCANGAN 24/25". Its total (RM10,016,101.34, 205
producers) matches Kausar's FY review slides. Only those three columns are
read — nothing else from the sheet.

Usage: python scripts/parse_fy_history.py <sheet.xlsx>
"""
import json
import os
import sys

import openpyxl

ID_COL, NAME_COL, TOTAL_COL = 2, 1, 11
FY = "FY24/25"


def kod(v):
    if v in (None, "", "-"):
        return None
    try:
        return str(int(float(v)))
    except (TypeError, ValueError):
        return str(v).strip() or None


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def main(path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb["SUMMARY"]
    rows = list(ws.iter_rows(values_only=True, max_col=TOTAL_COL + 1))
    header = rows[2]
    assert "24/25" in str(header[TOTAL_COL]) and "ID" in str(header[ID_COL]), f"unexpected SUMMARY layout: {header}"
    by_id = {}
    skipped = []
    for r in rows[3:]:
        if not r[NAME_COL]:
            continue
        amount = round(num(r[TOTAL_COL]), 2)
        k = kod(r[ID_COL])
        if amount <= 0:
            continue
        if not k:
            skipped.append(str(r[NAME_COL]).strip())
            continue
        rec = by_id.setdefault(k, {"daieId": k, "name": str(r[NAME_COL]).strip(), "perancangan": 0.0})
        rec["perancangan"] = round(rec["perancangan"] + amount, 2)
    out = sorted(by_id.values(), key=lambda x: -x["perancangan"])
    dest = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fy_history_2425.json")
    with open(dest, "w", encoding="utf8") as f:
        json.dump({"fy": FY, "records": out}, f, ensure_ascii=False, indent=1)
    print(f"{FY}: {len(out)} daie, RM{sum(x['perancangan'] for x in out):,.2f} -> {dest}")
    if skipped:
        print("Skipped (sales but no Daie ID):", skipped)


if __name__ == "__main__":
    main(sys.argv[1])
