import ExcelJS from "exceljs";

// Matches REPORT_COLORS.navy in pdf-report.ts, as an ARGB hex ExcelJS wants.
const NAVY_ARGB = "FF1B3A6B";
const WHITE_ARGB = "FFFFFFFF";
const ROW_ALT_ARGB = "FFF5F7FA";

/**
 * Builds a real multi-sheet, styled .xlsx — plain CSV can't do multiple
 * sheets or bold headers, which is what made the earlier CSV export look
 * like a messy wall of text when opened in Excel. Each `build` callback
 * gets the live workbook to add its own sheet(s) to.
 */
export async function buildAndDownloadWorkbook(
  filename: string,
  build: (wb: ExcelJS.Workbook) => void,
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "LoadForge";
  wb.created = new Date();
  build(wb);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * A "Summary" sheet of label/value pairs plus a few prose paragraphs
 * (narrative highlights, BRS context) — the part a plain CSV table dump
 * could never carry.
 */
export function addSummarySheet(
  wb: ExcelJS.Workbook,
  opts: {
    title: string;
    stats: Array<[string, string | number]>;
    notes?: Array<{ heading: string; lines: string[] }>;
  },
): ExcelJS.Worksheet {
  const sheet = wb.addWorksheet("Summary");
  sheet.columns = [{ width: 32 }, { width: 80 }];

  sheet.mergeCells("A1:B1");
  const titleCell = sheet.getCell("A1");
  titleCell.value = opts.title;
  titleCell.font = { bold: true, size: 14, color: { argb: NAVY_ARGB } };
  sheet.addRow([]);

  for (const [label, value] of opts.stats) {
    const row = sheet.addRow([label, value]);
    row.getCell(1).font = { bold: true };
    row.getCell(2).alignment = { wrapText: true };
  }

  for (const note of opts.notes ?? []) {
    sheet.addRow([]);
    const headingRow = sheet.addRow([note.heading]);
    headingRow.getCell(1).font = { bold: true, size: 12, color: { argb: NAVY_ARGB } };
    for (const line of note.lines) {
      const row = sheet.addRow(["", line]);
      row.getCell(2).alignment = { wrapText: true };
      row.getCell(2).font = { italic: false };
    }
  }

  return sheet;
}

/** A styled table sheet — bold white-on-navy header row, alternating row
 *  shading, auto column widths — the "looks proper in Excel" part. */
export function addTableSheet(
  wb: ExcelJS.Workbook,
  name: string,
  columns: Array<{ header: string; key: string; width?: number }>,
  rows: Array<Record<string, string | number>>,
): ExcelJS.Worksheet {
  const sheet = wb.addWorksheet(name);
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18 }));

  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: WHITE_ARGB } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY_ARGB } };
    cell.alignment = { vertical: "middle" };
  });

  rows.forEach((row, i) => {
    const added = sheet.addRow(row);
    if (i % 2 === 1) {
      added.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ROW_ALT_ARGB } };
      });
    }
  });

  if (rows.length === 0) {
    sheet.addRow(["No data for this run."]);
  }

  return sheet;
}
