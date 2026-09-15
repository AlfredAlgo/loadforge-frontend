import type { jsPDF } from "jspdf";

export type RGB = [number, number, number];

// Gauteng Provincial Government report palette, shared by the load-test and
// functional-test PDF exports so both read as one system.
export const REPORT_COLORS = {
  navy: [27, 58, 107] as RGB,
  gold: [200, 162, 50] as RGB,
  charcoal: [44, 44, 44] as RGB,
  rowAlt: [245, 247, 250] as RGB,
  white: [255, 255, 255] as RGB,
  green: [30, 122, 70] as RGB,
  greenBg: [231, 243, 236] as RGB,
  red: [179, 38, 30] as RGB,
  redBg: [251, 234, 233] as RGB,
  amber: [156, 107, 20] as RGB,
  amberBg: [251, 241, 223] as RGB,
  grey: [140, 140, 140] as RGB,
};

/**
 * Backend metrics have drifted in shape more than once on this project
 * (see the "type" column migration gap, and the scenario error-array
 * shape). Rather than assume one exact key spelling, try the common
 * variants before giving up — this is what actually fixes a table that
 * looks "blank" because the real field is named e.g. "P50" or "50"
 * instead of "p50".
 */
export function pickMetric(
  source: Record<string, unknown> | null | undefined,
  keys: string[],
): number | null {
  if (!source) return null;
  for (const k of keys) {
    const v = source[k];
    if (typeof v === "number" && !Number.isNaN(v)) return v;
  }
  return null;
}

export function pickPercentile(
  percentiles: Record<string, unknown> | null | undefined,
  p: 50 | 95 | 99,
): number | null {
  return pickMetric(percentiles, [`p${p}`, `P${p}`, `${p}`, `pct${p}`, `percentile_${p}`]);
}

/**
 * Success/error rates have shown up as both a 0-1 fraction and a 0-100
 * percentage depending on which part of the payload they came from. A
 * fraction plotted on a 0-100 axis renders as an invisible sliver, which
 * is what "blank chart" usually means in practice. Normalize once, here,
 * rather than trusting the scale at each call site.
 */
export function toPercent(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) return 0;
  return value > 0 && value <= 1 ? value * 100 : value;
}

export type Verdict = "healthy" | "degraded" | "failing" | "unknown";

export function verdictFor(successRatePct: number, sampleCount: number): { verdict: Verdict; label: string } {
  if (!sampleCount) return { verdict: "unknown", label: "No data" };
  if (successRatePct >= 99) return { verdict: "healthy", label: "Healthy" };
  if (successRatePct >= 90) return { verdict: "degraded", label: "Degraded" };
  return { verdict: "failing", label: "Failing" };
}

export function verdictColor(v: Verdict): RGB {
  if (v === "healthy") return REPORT_COLORS.green;
  if (v === "degraded") return REPORT_COLORS.amber;
  if (v === "failing") return REPORT_COLORS.red;
  return REPORT_COLORS.grey;
}

// ── SVG → PNG capture, used to embed Recharts output as PDF images ─────────
export function svgToPng(svgEl: SVGSVGElement): Promise<string> {
  return new Promise((resolve, reject) => {
    const w = svgEl.clientWidth || Number(svgEl.getAttribute("width") ?? 600);
    const h = svgEl.clientHeight || Number(svgEl.getAttribute("height") ?? 200);

    let svgStr = new XMLSerializer().serializeToString(svgEl);
    if (!svgStr.includes("xmlns="))
      svgStr = svgStr.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');

    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = w * 2;
      canvas.height = h * 2;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(2, 2);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("svg load failed"));
    };
    img.src = url;
  });
}

export async function captureChart(ref: React.RefObject<HTMLDivElement | null>): Promise<string | null> {
  if (!ref.current) return null;
  await new Promise((r) => setTimeout(r, 150));
  try {
    const svgEl = ref.current.querySelector("svg");
    if (!svgEl) return null;
    return await svgToPng(svgEl as SVGSVGElement);
  } catch {
    return null;
  }
}

// ── Shared drawing primitives ───────────────────────────────────────────────
const PAGE_W = 210;

export function sectionHeading(doc: jsPDF, text: string, y: number) {
  const { navy, gold, charcoal } = REPORT_COLORS;
  doc.setTextColor(...navy);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(text, 14, y);
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.6);
  doc.line(14, y + 1.5, PAGE_W - 14, y + 1.5);
  doc.setTextColor(...charcoal);
}

export function pageBand(doc: jsPDF, title: string) {
  const { navy, gold, white, charcoal } = REPORT_COLORS;
  doc.setFillColor(...navy);
  doc.rect(0, 0, PAGE_W, 12, "F");
  doc.setFillColor(...gold);
  doc.rect(0, 12, PAGE_W, 1, "F");
  doc.setTextColor(...white);
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 8.5);
  doc.setTextColor(...charcoal);
}

export function addChart(
  doc: jsPDF,
  img: string | null,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
) {
  const { navy, gold, charcoal } = REPORT_COLORS;
  doc.setTextColor(...navy);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(title, x, y);
  doc.setDrawColor(...gold);
  doc.setLineWidth(0.5);
  doc.line(x, y + 1.5, x + w, y + 1.5);
  if (img) {
    doc.addImage(img, "PNG", x, y + 4, w, h);
  } else {
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...REPORT_COLORS.grey);
    doc.text("Not enough data to chart", x + w / 2, y + h / 2 + 4, { align: "center" });
  }
  doc.setTextColor(...charcoal);
}

/**
 * A bordered callout box of bullet points — used for the "What went right" /
 * "What went wrong" narrative sections. Returns the Y position after the box
 * so callers can keep laying out content below it.
 */
export function narrativeBox(
  doc: jsPDF,
  title: string,
  bullets: string[],
  y: number,
  accent: RGB = REPORT_COLORS.gold,
): number {
  const { navy, charcoal, rowAlt } = REPORT_COLORS;
  const x = 14;
  const w = PAGE_W - 28;
  const pad = 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.3);
  const wrapped = bullets.map((b) => doc.splitTextToSize("•  " + b, w - pad * 2) as string[]);
  const totalLines = wrapped.reduce((n, arr) => n + arr.length, 0);
  const boxH = 10 + totalLines * 4.3 + pad;

  doc.setFillColor(...rowAlt);
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.4);
  doc.roundedRect(x, y, w, boxH, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...navy);
  doc.text(title, x + pad, y + 7);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.3);
  doc.setTextColor(...charcoal);
  let ly = y + 13;
  wrapped.forEach((lines) => {
    doc.text(lines, x + pad, ly);
    ly += lines.length * 4.3;
  });

  return y + boxH + 8;
}

export function drawFooter(doc: jsPDF) {
  const { navy, white } = REPORT_COLORS;
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...navy);
    doc.rect(0, 291, PAGE_W, 6, "F");
    doc.setTextColor(...white);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(`Page ${i} of ${pageCount}`, PAGE_W / 2, 295.5, { align: "center" });
    if (i === pageCount) {
      doc.setTextColor(180, 180, 180);
      doc.setFontSize(6);
      doc.text("powered by AlgoAtWork", 14, 295.5);
    }
  }
}

/** Colors a table cell by verdict — pass as a column's `didParseCell`. */
export function verdictCellStyler(getRatePct: (rowIndex: number) => { rate: number; samples: number } | null) {
  return (data: any) => {
    if (data.section !== "body") return;
    const info = getRatePct(data.row.index);
    if (!info) return;
    const { verdict } = verdictFor(info.rate, info.samples);
    data.cell.styles.textColor = verdictColor(verdict);
    data.cell.styles.fontStyle = "bold";
  };
}
