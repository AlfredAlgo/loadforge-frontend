/**
 * Plain CSV, not a real .xlsx — this opens natively in Excel (and Sheets,
 * Numbers, etc.) without pulling in a spreadsheet-writing dependency, which
 * is the simplest thing that satisfies "export the raw data" for a report
 * that otherwise lives as a PDF.
 */
export function toCsv(rows: Array<Record<string, string | number>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h] ?? "")).join(",")),
  ];
  return lines.join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  // A UTF-8 BOM so Excel on Windows (the client's platform) doesn't mangle
  // the file into its default codepage and garble anything non-ASCII.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
