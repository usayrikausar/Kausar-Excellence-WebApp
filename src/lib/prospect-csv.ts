// Shared column schema for prospect CSV export/import, so both directions
// stay in lockstep — export always produces exactly what import expects,
// and import looks columns up BY NAME (not position), so reordering columns
// in Excel, or re-importing a file that's missing a column entirely, still
// works instead of silently reading the wrong field.

import {
  STAGE_LABELS,
  SOURCE_LABELS,
  PROFESSION_LABELS,
  GOVERNMENT_TAHAP_LABELS,
  INCOME_BRACKET_LABELS,
} from "@/lib/constants";
import {
  PIPPPAS_STAGES,
  PROSPECT_SOURCES,
  PROFESSION_TYPES,
  GOVERNMENT_TAHAP,
  INCOME_BRACKETS,
  type PipppasStage,
  type ProspectSource,
  type ProfessionType,
  type GovernmentTahap,
  type IncomeBracket,
  type ProspectStatus,
} from "@/lib/types";
import type { ProspectWithId } from "@/lib/data";

const STATUS_LABELS: Record<ProspectStatus, string> = {
  active: "Active",
  closed_won: "Closed (Won)",
  closed_lost: "Closed (Lost)",
};

export const PROSPECT_CSV_HEADERS = [
  "Prospect ID",
  "Name",
  "Phone",
  "Email",
  "Source",
  "Stage",
  "Status",
  "Next Follow-Up Date",
  "Age",
  "Birthdate",
  "Profession",
  "Profession (Other)",
  "Government Service Group",
  "Organization",
  "Income Bracket",
  "Important Date",
  "Important Date Label",
  "Faraid Notes",
  "Details",
] as const;

/** Builds a `labelText -> enumKey` reverse lookup, case/whitespace-insensitive, that also accepts the raw enum key itself (for a technical user editing the key instead of the label). */
function reverseLookup<K extends string>(labels: Record<K, string>): Map<string, K> {
  const map = new Map<string, K>();
  for (const key of Object.keys(labels) as K[]) {
    map.set(labels[key].trim().toLowerCase(), key);
    map.set(key.trim().toLowerCase(), key);
  }
  return map;
}

const STAGE_LOOKUP = reverseLookup(STAGE_LABELS);
const SOURCE_LOOKUP = reverseLookup(SOURCE_LABELS);
const STATUS_LOOKUP = reverseLookup(STATUS_LABELS);
const PROFESSION_LOOKUP = reverseLookup(PROFESSION_LABELS);
const GOVERNMENT_TAHAP_LOOKUP = reverseLookup(GOVERNMENT_TAHAP_LABELS);
const INCOME_BRACKET_LOOKUP = reverseLookup(INCOME_BRACKET_LABELS);

export function prospectToRow(p: ProspectWithId): string[] {
  return [
    p.id,
    p.name,
    p.phone ?? "",
    p.email ?? "",
    SOURCE_LABELS[p.source] ?? p.source,
    STAGE_LABELS[p.stage] ?? p.stage,
    STATUS_LABELS[p.status] ?? p.status,
    p.nextFollowUpDate ?? "",
    p.age != null ? String(p.age) : "",
    p.birthdate ?? "",
    p.profession ? (PROFESSION_LABELS[p.profession] ?? p.profession) : "",
    p.professionOther ?? "",
    p.governmentTahap ? (GOVERNMENT_TAHAP_LABELS[p.governmentTahap] ?? p.governmentTahap) : "",
    p.organizationName ?? "",
    p.incomeBracket ? (INCOME_BRACKET_LABELS[p.incomeBracket] ?? p.incomeBracket) : "",
    p.importantDate ?? "",
    p.importantDateLabel ?? "",
    p.faraidNotes ?? "",
    p.details ?? "",
  ];
}

export interface ParsedProspectFields {
  name: string;
  phone: string | null;
  email: string | null;
  source: ProspectSource;
  stage: PipppasStage;
  status: ProspectStatus;
  nextFollowUpDate: string | null;
  age: number | null;
  birthdate: string | null;
  profession: ProfessionType | null;
  professionOther: string | null;
  governmentTahap: GovernmentTahap | null;
  organizationName: string | null;
  incomeBracket: IncomeBracket | null;
  importantDate: string | null;
  importantDateLabel: string | null;
  faraidNotes: string | null;
  details: string | null;
}

export interface ParsedProspectRow {
  rowNumber: number; // 1-based, matches what a spreadsheet user sees (header = row 1)
  prospectId: string | null; // from the "Prospect ID" column, if present
  fields: ParsedProspectFields;
  warnings: string[];
}

export interface ProspectRowError {
  rowNumber: number;
  error: string;
}

function cell(row: string[], headerIndex: Map<string, number>, header: string): string {
  const idx = headerIndex.get(header.toLowerCase());
  return idx == null ? "" : (row[idx] ?? "").trim();
}

function isoDateOrNull(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * Parses the full CSV (as returned by parseCsv) into per-row prospect
 * fields. Unrecognized stage/source values fall back to a safe default
 * (with a warning) rather than failing the whole row — a bulk import
 * shouldn't die on one typo'd cell.
 */
export function parseProspectCsv(rows: string[][]): { parsed: ParsedProspectRow[]; errors: ProspectRowError[] } {
  if (rows.length === 0) return { parsed: [], errors: [{ rowNumber: 1, error: "File is empty." }] };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const headerIndex = new Map(header.map((h, i) => [h, i]));

  const nameIdx = headerIndex.get("name");
  if (nameIdx == null) {
    return { parsed: [], errors: [{ rowNumber: 1, error: 'Missing required "Name" column.' }] };
  }

  const parsed: ParsedProspectRow[] = [];
  const errors: ProspectRowError[] = [];

  for (let i = 1; i < rows.length; i++) {
    const rowNumber = i + 1;
    const row = rows[i];
    const name = (row[nameIdx] ?? "").trim();
    if (!name) {
      errors.push({ rowNumber, error: "Missing Name — row skipped." });
      continue;
    }

    const warnings: string[] = [];
    const prospectId = cell(row, headerIndex, "Prospect ID") || null;

    const sourceRaw = cell(row, headerIndex, "Source").toLowerCase();
    const source = (sourceRaw && SOURCE_LOOKUP.get(sourceRaw)) || (PROSPECT_SOURCES.includes(sourceRaw as ProspectSource) ? (sourceRaw as ProspectSource) : null);
    if (sourceRaw && !source) warnings.push(`Unrecognized Source "${cell(row, headerIndex, "Source")}" — defaulted to "Other".`);

    const stageRaw = cell(row, headerIndex, "Stage").toLowerCase();
    const stage = (stageRaw && STAGE_LOOKUP.get(stageRaw)) || (PIPPPAS_STAGES.includes(stageRaw as PipppasStage) ? (stageRaw as PipppasStage) : null);
    if (stageRaw && !stage) warnings.push(`Unrecognized Stage "${cell(row, headerIndex, "Stage")}" — defaulted to "Prospecting".`);

    const statusRaw = cell(row, headerIndex, "Status").toLowerCase();
    const status = (statusRaw && STATUS_LOOKUP.get(statusRaw)) || null;
    if (statusRaw && !status) warnings.push(`Unrecognized Status "${cell(row, headerIndex, "Status")}" — defaulted to "Active".`);

    const professionRaw = cell(row, headerIndex, "Profession").toLowerCase();
    const profession = (professionRaw && PROFESSION_LOOKUP.get(professionRaw)) || (PROFESSION_TYPES.includes(professionRaw as ProfessionType) ? (professionRaw as ProfessionType) : null);
    if (professionRaw && !profession) warnings.push(`Unrecognized Profession "${cell(row, headerIndex, "Profession")}" — left blank.`);

    const govRaw = cell(row, headerIndex, "Government Service Group").toLowerCase();
    const governmentTahap = (govRaw && GOVERNMENT_TAHAP_LOOKUP.get(govRaw)) || (GOVERNMENT_TAHAP.includes(govRaw as GovernmentTahap) ? (govRaw as GovernmentTahap) : null);
    if (govRaw && !governmentTahap) warnings.push(`Unrecognized Government Service Group "${cell(row, headerIndex, "Government Service Group")}" — left blank.`);

    const incomeRaw = cell(row, headerIndex, "Income Bracket").toLowerCase();
    const incomeBracket = (incomeRaw && INCOME_BRACKET_LOOKUP.get(incomeRaw)) || (INCOME_BRACKETS.includes(incomeRaw as IncomeBracket) ? (incomeRaw as IncomeBracket) : null);
    if (incomeRaw && !incomeBracket) warnings.push(`Unrecognized Income Bracket "${cell(row, headerIndex, "Income Bracket")}" — left blank.`);

    const ageRaw = cell(row, headerIndex, "Age");
    const age = ageRaw && !Number.isNaN(Number(ageRaw)) ? Number(ageRaw) : null;

    parsed.push({
      rowNumber,
      prospectId,
      warnings,
      fields: {
        name,
        phone: cell(row, headerIndex, "Phone") || null,
        email: cell(row, headerIndex, "Email") || null,
        source: source ?? "other",
        stage: stage ?? "prospecting",
        status: status ?? "active",
        nextFollowUpDate: isoDateOrNull(cell(row, headerIndex, "Next Follow-Up Date")),
        age,
        birthdate: isoDateOrNull(cell(row, headerIndex, "Birthdate")),
        profession,
        professionOther: profession === "others" ? cell(row, headerIndex, "Profession (Other)") || null : null,
        governmentTahap,
        organizationName: cell(row, headerIndex, "Organization") || null,
        incomeBracket,
        importantDate: isoDateOrNull(cell(row, headerIndex, "Important Date")),
        importantDateLabel: cell(row, headerIndex, "Important Date Label") || null,
        faraidNotes: cell(row, headerIndex, "Faraid Notes") || null,
        details: cell(row, headerIndex, "Details") || null,
      },
    });
  }

  return { parsed, errors };
}
