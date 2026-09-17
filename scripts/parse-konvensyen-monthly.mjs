// Parses the 5 unit tabs of "KONVENSYEN MONTHLY - FYP 25/26 KAUSAR GROUP"
// (exported as CSV into scripts/konvensyen_raw/*.csv) into a single flat
// Perancangan totals list, keyed by KOD (daieId). This is the authoritative,
// current source — supersedes scripts/matched_perancangan.json, which was
// built from an older/incomplete snapshot (236 records vs ~380+ here).
//
// Column layout drifts slightly between unit tabs (some have an extra blank
// "No"/"Column 29" column before JUMLAH), so columns are located by header
// name per-file rather than by fixed index.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";

function parseCsvLine(line) {
  const fields = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { fields.push(cur); cur = ""; }
      else cur += c;
    }
  }
  fields.push(cur);
  return fields;
}

function parseMoney(s) {
  if (!s) return 0;
  const n = Number(String(s).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

const dir = "scripts/konvensyen_raw";
const results = [];
const skippedNoKod = [];

for (const file of readdirSync(dir)) {
  if (!file.endsWith(".csv")) continue;
  const unit = file.replace(".csv", "");
  const lines = readFileSync(`${dir}/${file}`, "utf8").split(/\r?\n/);

  const headerIdx = lines.findIndex((l) => l.includes("KOD") && l.includes("JUMLAH"));
  if (headerIdx === -1) { console.error(`${unit}: no header row found, skipping file`); continue; }
  const header = parseCsvLine(lines[headerIdx]).map((h) => h.trim());
  const kodCol = header.indexOf("KOD");
  const jumlahCol = header.indexOf("JUMLAH");
  const nameCol = header.indexOf("NAMA PERUNDING");
  if (kodCol === -1 || jumlahCol === -1) { console.error(`${unit}: missing KOD/JUMLAH column, skipping file`); continue; }

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw || !raw.trim()) continue;
    const fields = parseCsvLine(raw);
    const kod = (fields[kodCol] ?? "").trim();
    const name = (fields[nameCol] ?? "").trim();
    if (!kod) { if (name) skippedNoKod.push({ unit, name }); continue; }
    const total = parseMoney(fields[jumlahCol]);
    results.push({ daieId: kod, name, total, unit });
  }
}

// A daieId can legitimately appear in more than one unit tab: sales are
// attributed by when they occurred, so someone who moved units mid-year
// (e.g. onto the newly-split-off Nusrah team) has production tracked under
// their old unit's tab before the move and their new unit's tab after it.
// Both figures are real and belong to the same person -- sum them.
const byDaieId = new Map();
const combined = [];
for (const r of results) {
  if (byDaieId.has(r.daieId)) {
    const prev = byDaieId.get(r.daieId);
    combined.push({ daieId: r.daieId, name: r.name, units: `${prev.unit}+${r.unit}`, a: prev.total, b: r.total, sum: prev.total + r.total });
    byDaieId.set(r.daieId, { ...prev, total: prev.total + r.total, unit: `${prev.unit}+${r.unit}` });
  } else {
    byDaieId.set(r.daieId, { ...r });
  }
}

const final = [...byDaieId.values()];
writeFileSync("scripts/konvensyen_monthly_perancangan.json", JSON.stringify(final, null, 2));

console.log(`Parsed ${results.length} rows across all units -> ${final.length} unique daieId.`);
console.log(`Skipped rows with a name but no KOD: ${skippedNoKod.length}`);
if (skippedNoKod.length) console.table(skippedNoKod.slice(0, 10));
console.log(`daieId appearing in more than one unit tab (summed): ${combined.length}`);
if (combined.length) console.table(combined);
console.log(`\nSaved to scripts/konvensyen_monthly_perancangan.json`);
