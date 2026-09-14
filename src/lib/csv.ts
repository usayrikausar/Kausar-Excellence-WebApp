"use client";

// Client-only CSV export — opens natively in Excel (no extra dependency
// needed for that), which is what "print and cross-check against Wasiyyah's
// real records" actually calls for. Column values are pre-formatted to
// match exactly what's shown on screen (RM amounts, dates, status labels)
// so the printed sheet reads the same as the app.

function escapeCsvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Minimal RFC4180-ish CSV parser (quoted fields, escaped "" quotes, commas
 * and newlines inside quotes) — for importing a prospect list edited in
 * Excel back into the app. Character-by-character rather than a regex/split
 * because embedded newlines inside a quoted cell make line-based splitting
 * unreliable.
 */
export function parseCsv(text: string): string[][] {
  // Strip a UTF-8 BOM if present (downloadCsv writes one).
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\r") {
      // skip — the \n right after (or a lone \r) ends the row
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  // Final cell/row if the file doesn't end with a newline.
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

export function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  // ﻿ (UTF-8 BOM) so Excel on Windows renders non-ASCII names (e.g.
  // "Muhammad Fazli") correctly instead of guessing the wrong encoding.
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(","));
  const csv = "﻿" + lines.join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
