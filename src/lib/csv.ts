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
