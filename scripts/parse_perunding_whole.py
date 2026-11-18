# Parses the authoritative "Perunding Whole.xlsx" export from Wasiyyah into
# scripts/roster_import_v2.json, in the same record shape import-roster.mjs
# already expects (rosterId/daieId/name/rank/unitId/uplineRosterId/
# lineagePath/status/isLdpMember/flags/sourceRow), plus fields this source
# makes possible: email and dateLicensed (from Tempoh Mula), dateExpiry
# (from Tempoh Tamat), and region.
#
# status is now driven by the sheet's own Tempoh Tamat (real contract end
# date, updated on renewal) rather than a fixed 24/36-month formula from
# Tempoh Mula — a spot check found the formula disagreed with Tempoh Tamat
# for 71% of records with both dates, since Tempoh Mula stays at the
# ORIGINAL start date across renewals while Tempoh Tamat tracks the actual
# current end date. The formula is kept only as a fallback for the handful
# of records missing Tempoh Tamat.
#
# Deliberately does NOT read IC, Tarikh Lahir, No Tel(2), Bank, No Account —
# data minimization: only what the app's schema actually uses.
#
# isLdpMember is not present in this file at all (it was inferred from
# manual orange color-coding in the old hierarchy sheet) — carried forward
# from scripts/roster_import.json by matching daieId, since that's the only
# place this signal exists.
#
# Usage: python scripts/parse_perunding_whole.py "<path to Perunding Whole.xlsx>"

import sys
import re
import json
from collections import Counter
from datetime import datetime

import openpyxl

UNIT_BY_KUMPULAN = {
    "KAUSAR WEALTH MANAGEMENT": "kausar-wealth",
    "KAUSAR GLOBAL": "kausar-global",
    "KAUSAR ASPIRE": "kausar-aspire",
    "KAUSAR INTISAR": "kausar-intisar",
    "KAUSAR NUSRAH": "kausar-nusrah",
}

RANK_BY_LEVEL = {
    "PM": "DM",
    "DM": "DM",  # 2026-11 sheet uses the app's own rank names
    "DPM": "DPM",
    "PPM": "DPM",
    "KPE": "KDE",
    "KDE": "KDE",
}

UPLINE_KOD_RE = re.compile(r"\((\d+)\)?\s*$")
UPLINE_LABEL_RE = re.compile(r"^(.*?)\s*\(\d+\)?\s*$")

# PIC review (2026-09-13) of the cross_unit_upline flags this parser raised
# on the first run: the sheet's own Kumpulan (unit) column is wrong for
# these 4 people — their real unit follows their actual introducer/upline,
# per usayri.kausar@gmail.com. Overriding here (rather than hand-editing the
# generated JSON) so the fix survives a re-parse of an updated source file.
UNIT_OVERRIDES = {
    "10521": "kausar-nusrah",  # Rika Binti Tahir — was Noorashiqien Ishak's (Kausar Nusrah KDE) downline before expiring; whole lineage traces back to Kausar Nusrah, not Kausar Wealth
    "86364": "kausar-aspire",  # Mohd Osmerayusman Bin Mohamad — recruited by Azura Binti Mohd Arif, Kausar Aspire
    "86834": "kausar-intisar",  # Mohd Fahmi Bin Md Miftahuddin — introducer Mohamad Nazri Daud is Kausar Intisar
    "86840": "kausar-intisar",  # Aimi Mursyidah Binti Suria — same introducer (Mohamad Nazri Daud), Kausar Intisar
}

# Also from that same review: this cross-unit upline is real, not a data
# error — Mohd Fazli Bin Omar (Kausar Wealth) is confirmed as Intan
# Yusliyana's actual introducer/sponsor even though she became Kausar
# Intisar's KDE. Flagged distinctly so it doesn't read as still-open.
CONFIRMED_CROSS_UNIT_UPLINES = {"11353"}

# Wasiyyah Konvensyen's 5 award regions, keyed by the sheet's own Region
# column values (normalized upper-case) -> canonical region id. "Easthern"
# is a typo in the source for "Eastern"/East Coast. A record with no Region
# value at all, or an ambiguous multi-region value like "Southern / Central",
# defaults to "central" per usayri.kausar@gmail.com (2026-09-17) rather than
# guessing from the free-text address.
REGION_BY_SHEET_VALUE = {
    "CENTRAL": "central",
    "EASTERN": "east-coast",
    "EASTHERN": "east-coast",
    "NORTHERN": "northern",
    "SOUTHERN": "southern",
    "BORNEO": "borneo",
}


def normalise_kod(value):
    """10026.0 / "10026" / " 10026 " -> "10026"; non-numeric text kept as-is; blank -> None."""
    if value is None:
        return None
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    if isinstance(value, int):
        return str(value)
    text = str(value).strip()
    if not text:
        return None
    try:
        as_float = float(text)
        return str(int(as_float)) if as_float.is_integer() else text
    except ValueError:
        return text


def parse_sheet_date(value):
    """A cell that's a real date, or text like "15/7/2019" (day/month/year) -> ISO date, else None."""
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, str):
        m = re.match(r"^\s*(\d{1,2})/(\d{1,2})/(\d{4})\s*$", value)
        if m:
            try:
                return datetime(int(m.group(3)), int(m.group(2)), int(m.group(1))).date().isoformat()
            except ValueError:
                return None
    return None


# The 2026-11 sheet's STATUS column, which Kausar's own reports use: EXPIRED
# is out; ACTIVE / GENERATE / INACTIVE are all current perunding (the
# "perunding semasa" count). Older exports had no STATUS column.
SHEET_STATUS = {"ACTIVE": "active", "GENERATE": "generate", "INACTIVE": "inactive", "EXPIRED": "expired"}


def upline_text(row, idx):
    """The upline as "NAME (kod)". The 2026-11 sheet splits the code into its own
    "ID Upline" column; older exports put it inside the Upline text."""
    name = row[idx["Upline"]]
    if "ID Upline" in idx:
        kod = normalise_kod(row[idx["ID Upline"]])
        if kod:
            return f"{str(name or '').strip()} ({kod})"
    return name


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/parse_perunding_whole.py <path to xlsx>")
        sys.exit(1)

    path = sys.argv[1]
    old_roster_path = sys.argv[2] if len(sys.argv) > 2 else "scripts/roster_import.json"

    old_ldp_by_daie_id = {}
    try:
        with open(old_roster_path, encoding="utf-8") as f:
            for r in json.load(f):
                if r.get("isLdpMember"):
                    old_ldp_by_daie_id[str(r["daieId"])] = True
    except FileNotFoundError:
        print(f"(no old roster found at {old_roster_path}, isLdpMember will default to false)")

    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    # 2026-11 layout ("Perunding Kausar Group" Google Sheet) keeps the roster
    # on "New Perunding Whole Kausar"; the original export used "Sheet1".
    sheet_name = next((n for n in ("New Perunding Whole Kausar", "Sheet1") if n in wb.sheetnames), None)
    if sheet_name is None:
        print(f"No roster tab found (looked for 'New Perunding Whole Kausar' / 'Sheet1'); tabs: {wb.sheetnames}")
        sys.exit(1)
    ws = wb[sheet_name]
    # Row-at-a-time read: the Google Sheet export carries formatting far past
    # the real columns, which made a cell-by-cell loop take hours.
    all_rows = ws.iter_rows(values_only=True)
    headers = list(next(all_rows))
    idx = {str(h).strip(): i for i, h in enumerate(headers) if h is not None}
    width = max(idx.values()) + 1

    raw_rows = []
    for r, values in enumerate(all_rows, start=2):
        row = list(values[:width]) + [None] * max(0, width - len(values))
        if row[idx["Nama"]] is None:
            continue
        # The Google Sheet stores Kod as a number (10026.0); normalise to the
        # "10026" string form used everywhere else.
        row[idx["Kod"]] = normalise_kod(row[idx["Kod"]])
        raw_rows.append((r, row))

    # Pass 1: assign a stable rosterId per row and index by daieId (Kod).
    kod_counts = Counter()
    for _sourceRow, row in raw_rows:
        kod = row[idx["Kod"]]
        if kod is not None:
            kod_counts[str(kod)] += 1

    records = []
    row_by_kod = {}  # daieId(str) -> record, only for unique, non-missing kods
    for sourceRow, row in raw_rows:
        kod_raw = row[idx["Kod"]]
        daie_id = str(kod_raw) if kod_raw is not None else None
        flags = []

        if daie_id is None:
            roster_id = f"row{sourceRow}"
            flags.append("missing_id")
        elif kod_counts[daie_id] > 1:
            roster_id = f"row{sourceRow}"  # keep stable but distinct per duplicate
            flags.append("duplicate_id")
        else:
            roster_id = f"k{daie_id}"

        level = row[idx["Level"]]
        rank = RANK_BY_LEVEL.get(level)
        if rank is None:
            rank = "DM"
            flags.append(f"unknown_level:{level}")

        kumpulan = row[idx["Kumpulan"]]
        unit_id = UNIT_BY_KUMPULAN.get(kumpulan)
        if unit_id is None:
            unit_id = "kausar-wealth"
            flags.append(f"unresolved_unit:{kumpulan}")
        if daie_id in UNIT_OVERRIDES:
            unit_id = UNIT_OVERRIDES[daie_id]
            flags.append("unit_corrected_by_pic")

        date_licensed = parse_sheet_date(row[idx["Tempoh Mula"]])
        date_expiry = parse_sheet_date(row[idx["Tempoh Tamat"]])
        # "Bulan & Tahun" = the month they joined Kausar (the recruit date
        # Kausar's recruitment report counts); not in older exports.
        date_joined = parse_sheet_date(row[idx["Bulan & Tahun"]]) if "Bulan & Tahun" in idx else None
        status_raw = row[idx["STATUS"]] if "STATUS" in idx else None
        sheet_status = SHEET_STATUS.get(str(status_raw).strip().upper()) if status_raw else None
        if status_raw and sheet_status is None:
            flags.append(f"unknown_status:{status_raw}")

        region_raw = row[idx["Region"]]
        region_key = str(region_raw).strip().upper() if region_raw else None
        region = REGION_BY_SHEET_VALUE.get(region_key, "central")
        if region_raw and region_key not in REGION_BY_SHEET_VALUE:
            flags.append(f"unrecognized_region:{region_raw}")

        email = row[idx["Emel"]]
        email = str(email).strip() if email else None
        if not email:
            flags.append("missing_email")

        rec = {
            "rosterId": roster_id,
            "daieId": daie_id,
            "name": str(row[idx["Nama"]]).strip(),
            "email": email,
            "rank": rank,
            "unitId": unit_id,
            "region": region,
            "dateLicensed": date_licensed,
            "dateExpiry": date_expiry,
            "dateJoined": date_joined,
            "sheetStatus": sheet_status,
            "isLdpMember": old_ldp_by_daie_id.get(daie_id, False),
            "flags": flags,
            "sourceRow": sourceRow,
            "_uplineRaw": upline_text(row, idx),
        }
        records.append(rec)
        if daie_id is not None and kod_counts[daie_id] == 1:
            row_by_kod[daie_id] = rec

    # Some Upline references point to a "(kod)" that never appears as a real
    # person's Kod anywhere in the sheet — e.g. "KAUSAR WEALTH MANAGEMENT
    # SDN. BHD. (10026)", the parent company itself, which (unlike the other
    # 4 units) has no person explicitly marked KDE. Mirrors the old
    # hierarchy import's approach: synthesize one root record per such
    # phantom entity so its direct reports nest under a real node instead of
    # each becoming a stray top-level root.
    phantom_kods = {}
    for _sourceRow, row in raw_rows:
        upline_raw = upline_text(row, idx)
        if not upline_raw:
            continue
        m = UPLINE_KOD_RE.search(str(upline_raw))
        if not m:
            continue
        up_kod = m.group(1)
        if up_kod in row_by_kod or up_kod in phantom_kods:
            continue
        label_m = UPLINE_LABEL_RE.match(str(upline_raw))
        label = label_m.group(1).strip() if label_m else str(upline_raw)
        unit_id = next(
            (uid for name, uid in UNIT_BY_KUMPULAN.items() if name in label.upper()),
            "kausar-wealth",
        )
        phantom_kods[up_kod] = {
            "rosterId": f"phantom{up_kod}",
            "daieId": up_kod,
            "name": label,
            "email": None,
            "rank": "KDE",
            "unitId": unit_id,
            "region": "central",
            "dateLicensed": None,
            "dateExpiry": None,
            "dateJoined": None,
            "sheetStatus": None,
            "isLdpMember": old_ldp_by_daie_id.get(up_kod, False),
            "flags": ["synthetic_root"],
            "sourceRow": None,
            "uplineRosterId": None,
        }
    records.extend(phantom_kods.values())

    # Pass 2: resolve Upline -> uplineRosterId (or null if it's a root/
    # unresolvable external reference).
    unresolved_upline_examples = Counter()
    cross_unit = []
    for rec in records:
        upline_raw = rec.pop("_uplineRaw", None)
        rec.setdefault("uplineRosterId", None)
        if upline_raw:
            m = UPLINE_KOD_RE.search(str(upline_raw))
            if m:
                up_kod = m.group(1)
                up_rec = row_by_kod.get(up_kod) or phantom_kods.get(up_kod)
                if up_rec:
                    rec["uplineRosterId"] = up_rec["rosterId"]
                    if up_rec["unitId"] != rec["unitId"]:
                        if "synthetic_root" in up_rec["flags"]:
                            # Unit's own KDE reporting to the Kausar Wealth
                            # Management parent-company entity — expected,
                            # not an anomaly (see the phantom-root comment
                            # above).
                            rec["flags"].append("cross_unit_upline_structural")
                        elif rec["daieId"] in CONFIRMED_CROSS_UNIT_UPLINES:
                            rec["flags"].append("cross_unit_upline_confirmed")
                        else:
                            rec["flags"].append("cross_unit_upline")
                            cross_unit.append((rec["daieId"], rec["name"], rec["unitId"], up_kod, up_rec["name"], up_rec["unitId"]))
            else:
                rec["flags"].append("unresolved_upline")
                unresolved_upline_examples[str(upline_raw)] += 1

    # Pass 3: lineagePath by walking uplineRosterId chains.
    by_id = {r["rosterId"]: r for r in records}

    def lineage_of(rec, seen=None):
        seen = seen or set()
        if rec["rosterId"] in seen:
            rec["flags"].append("upline_cycle")
            return []
        seen.add(rec["rosterId"])
        up_id = rec["uplineRosterId"]
        if not up_id or up_id not in by_id:
            return []
        up = by_id[up_id]
        return lineage_of(up, seen) + [up_id]

    for rec in records:
        rec["lineagePath"] = lineage_of(rec)

    # Pass 4: status, from dateExpiry (Tempoh Tamat) directly where the sheet
    # has it — that's the real, renewal-aware contract end date. Falls back
    # to the old dateLicensed + rank 24/36-month formula only when dateExpiry
    # is missing (mirrors lib/utils.ts's contractExpiryDate, kept in sync by
    # hand). No date at all -> active (mirrors isActiveStatus treating a null
    # dateLicensed as not-yet-expired).
    def add_months(d, months):
        month = d.month - 1 + months
        year = d.year + month // 12
        month = month % 12 + 1
        day = min(d.day, [31, 29 if year % 4 == 0 and (year % 100 != 0 or year % 400 == 0) else 28,
                          31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1])
        return d.replace(year=year, month=month, day=day)

    today = datetime.now().date()
    active_count = 0
    expired_count = 0
    from_expiry_field = 0
    from_formula = 0
    from_sheet_status = 0
    for rec in records:
        if rec.get("sheetStatus"):
            # The sheet's own STATUS wins when present (user decision
            # 2026-11-18): 357 EXPIRED people have no Tempoh Tamat at all,
            # and would otherwise count as active.
            rec["status"] = "expired" if rec["sheetStatus"] == "expired" else "active"
            from_sheet_status += 1
        elif rec["dateExpiry"] is not None:
            expiry = datetime.fromisoformat(rec["dateExpiry"]).date()
            rec["status"] = "active" if expiry >= today else "expired"
            from_expiry_field += 1
        elif rec["dateLicensed"] is None:
            rec["status"] = "active"
        else:
            months = 36 if rec["rank"] == "KDE" else 24
            start = datetime.fromisoformat(rec["dateLicensed"]).date()
            expiry = add_months(start, months)
            rec["status"] = "active" if expiry >= today else "expired"
            from_formula += 1
        if rec["status"] == "active":
            active_count += 1
        else:
            expired_count += 1

    out_path = "scripts/roster_import_v2.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=1, ensure_ascii=False)

    dupes = sum(1 for r in records if "duplicate_id" in r["flags"])
    missing_id = sum(1 for r in records if "missing_id" in r["flags"])
    missing_email = sum(1 for r in records if "missing_email" in r["flags"])
    unresolved = sum(1 for r in records if "unresolved_upline" in r["flags"])
    cross = sum(1 for r in records if "cross_unit_upline" in r["flags"])
    cross_structural = sum(1 for r in records if "cross_unit_upline_structural" in r["flags"])
    cross_confirmed = sum(1 for r in records if "cross_unit_upline_confirmed" in r["flags"])
    corrected = sum(1 for r in records if "unit_corrected_by_pic" in r["flags"])

    region_counts = Counter(r["region"] for r in records)
    unrecognized_region = sum(1 for r in records if any(f.startswith("unrecognized_region:") for f in r["flags"]))

    print(f"Wrote {out_path}: {len(records)} records")
    print(f"  active={active_count} expired={expired_count}")
    print(f"  status source: STATUS column={from_sheet_status} dateExpiry field={from_expiry_field} formula-fallback={from_formula}")
    print(f"  sheetStatus: {dict(Counter(r.get('sheetStatus') for r in records))} | dateJoined set: {sum(1 for r in records if r.get('dateJoined'))}")
    print(f"  region: {dict(region_counts)} (unrecognized value defaulted to central: {unrecognized_region})")
    print(f"  flagged: duplicate_id={dupes} missing_id={missing_id} missing_email={missing_email} "
          f"unresolved_upline={unresolved}")
    print(f"  cross_unit_upline: unresolved={cross} structural(unit-KDE->parent company)={cross_structural} "
          f"PIC-confirmed={cross_confirmed} | unit_corrected_by_pic={corrected}")
    print(f"\nUnresolved-upline external references: {dict(unresolved_upline_examples)}")
    if cross_unit:
        print(f"\nStill-unresolved cross-unit upline pairs ({len(cross_unit)}):")
        for c in cross_unit:
            print(" ", c)


if __name__ == "__main__":
    main()
