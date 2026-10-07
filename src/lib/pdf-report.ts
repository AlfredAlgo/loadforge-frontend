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
  teal: [21, 101, 115] as RGB,
  tealBg: [222, 240, 242] as RGB,
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

// Four tiers instead of a single 99%-or-fail bar — a run that's merely
// "not perfect" shouldn't read the same as one that's actually broken.
//   < 50%           → failing      — not acceptable
//   50% – 69.9%     → acceptable   — acceptable for further testing, not for deployment
//   70% – 84.9%     → fixable      — can deploy, but fixing issues first is recommended
//   >= 85%          → healthy      — ready
export type Verdict = "healthy" | "fixable" | "acceptable" | "failing" | "unknown";

export function verdictFor(successRatePct: number, sampleCount: number): { verdict: Verdict; label: string } {
  if (!sampleCount) return { verdict: "unknown", label: "No data" };
  if (successRatePct >= 85) return { verdict: "healthy", label: "Ready" };
  if (successRatePct >= 70) return { verdict: "fixable", label: "Deployable — fix recommended" };
  if (successRatePct >= 50) return { verdict: "acceptable", label: "Acceptable — not recommended" };
  return { verdict: "failing", label: "Not acceptable" };
}

export function verdictColor(v: Verdict): RGB {
  if (v === "healthy") return REPORT_COLORS.green;
  if (v === "fixable") return REPORT_COLORS.amber;
  if (v === "acceptable") return REPORT_COLORS.teal;
  if (v === "failing") return REPORT_COLORS.red;
  return REPORT_COLORS.grey;
}

export function verdictBg(v: Verdict): RGB {
  if (v === "healthy") return REPORT_COLORS.greenBg;
  if (v === "fixable") return REPORT_COLORS.amberBg;
  if (v === "acceptable") return REPORT_COLORS.tealBg;
  if (v === "failing") return REPORT_COLORS.redBg;
  return REPORT_COLORS.rowAlt;
}

export type ReadinessVerdict = "ready" | "fixable" | "acceptable" | "not_ready";

/**
 * A deployment-readiness call, derived only from this run's own numbers —
 * never a substitute for a human tester's judgment (risk likelihood,
 * business impact, etc.), just an honest read of what the metrics show.
 * Mirrors the four tiers in verdictFor above, applied to the overall rate.
 */
export function deploymentReadiness(
  overallSuccessRatePct: number,
  failingCount: number,
  degradedCount: number,
): { verdict: ReadinessVerdict; label: string; detail: string } {
  if (overallSuccessRatePct >= 85) {
    return {
      verdict: "ready",
      label: "Ready for deployment",
      detail: `Overall success rate was ${overallSuccessRatePct.toFixed(1)}%, at or above the 85% deployment bar. No blocking issues were identified in this run.`,
    };
  }
  if (overallSuccessRatePct >= 70) {
    const shortfall = failingCount + degradedCount;
    return {
      verdict: "fixable",
      label: "Can deploy — fixes recommended",
      detail: `Overall success rate was ${overallSuccessRatePct.toFixed(1)}%. This clears the 70% bar to deploy, but ${shortfall} item${shortfall === 1 ? "" : "s"} fell short of the 85% target — fixing these before go-live is recommended.`,
    };
  }
  if (overallSuccessRatePct >= 50) {
    return {
      verdict: "acceptable",
      label: "Acceptable — not recommended for deployment",
      detail: `Overall success rate was ${overallSuccessRatePct.toFixed(1)}%. This is acceptable for further testing, but falls short of the 70% bar to deploy — deployment is not recommended until this improves.`,
    };
  }
  return {
    verdict: "not_ready",
    label: "Not ready — blocking issues found",
    detail: `Overall success rate was ${overallSuccessRatePct.toFixed(1)}%, below the 50% floor, with ${failingCount} failing item${failingCount === 1 ? "" : "s"} in this run. Resolve the issues below before this result can support a go-live decision.`,
  };
}

/** A prominent readiness banner — the PDF equivalent of a report's "Conclusion". */
export function readinessBanner(
  doc: jsPDF,
  verdict: ReadinessVerdict,
  label: string,
  detail: string,
  y: number,
): number {
  const v: Verdict = verdict === "ready" ? "healthy" : verdict === "fixable" ? "fixable" : verdict === "acceptable" ? "acceptable" : "failing";
  const { navy, charcoal } = REPORT_COLORS;
  const x = 14;
  const w = PAGE_W - 28;
  const pad = 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.3);
  const wrapped = doc.splitTextToSize(detail, w - pad * 2) as string[];
  const boxH = 12 + wrapped.length * 4.3 + pad;

  doc.setFillColor(...verdictBg(v));
  doc.setDrawColor(...verdictColor(v));
  doc.setLineWidth(0.6);
  doc.roundedRect(x, y, w, boxH, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...verdictColor(v));
  doc.text(label.toUpperCase(), x + pad, y + 7.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.3);
  doc.setTextColor(...charcoal);
  doc.text(wrapped, x + pad, y + 14);

  doc.setTextColor(...navy);
  return y + boxH + 8;
}

export interface SignOffEntry {
  decision: "approved" | "approved_with_reservations" | "rejected";
  comment: string | null;
  createdAt: string;
  userName: string;
  userEmail: string;
}

function signOffDecisionLabel(decision: SignOffEntry["decision"]): string {
  if (decision === "approved") return "Approved";
  if (decision === "approved_with_reservations") return "Approved with reservations";
  return "Rejected";
}

function signOffDecisionColor(decision: SignOffEntry["decision"]): RGB {
  if (decision === "approved") return REPORT_COLORS.green;
  if (decision === "approved_with_reservations") return REPORT_COLORS.amber;
  return REPORT_COLORS.red;
}

/**
 * Sign-off is the audit trail a government submission needs: who reviewed
 * this result, their decision, and when — not just the system's own
 * automated readiness verdict above it. Renders as part of the PDF so the
 * record travels with the document, not just inside the app.
 */
export function signOffSection(doc: jsPDF, entries: SignOffEntry[], y: number): number {
  const { charcoal, grey, rowAlt } = REPORT_COLORS;
  sectionHeading(doc, "Sign-Off / Audit Trail", y);
  let cursor = y + 9;

  if (entries.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.3);
    doc.setTextColor(...grey);
    doc.text("No sign-off has been recorded for this test yet.", 14, cursor);
    doc.setTextColor(...charcoal);
    return cursor + 6;
  }

  const x = 14;
  const w = PAGE_W - 28;
  for (const entry of entries) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    const wrapped = entry.comment ? (doc.splitTextToSize(entry.comment, w - 10) as string[]) : [];
    const boxH = 12 + wrapped.length * 4;

    doc.setFillColor(...rowAlt);
    doc.setDrawColor(...signOffDecisionColor(entry.decision));
    doc.setLineWidth(0.5);
    doc.roundedRect(x, cursor, w, boxH, 1.5, 1.5, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.3);
    doc.setTextColor(...signOffDecisionColor(entry.decision));
    doc.text(signOffDecisionLabel(entry.decision), x + 4, cursor + 6);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...grey);
    doc.text(
      `${entry.userName} (${entry.userEmail}) — ${new Date(entry.createdAt).toLocaleString()}`,
      x + w - 4,
      cursor + 6,
      { align: "right" },
    );

    if (wrapped.length > 0) {
      doc.setTextColor(...charcoal);
      doc.text(wrapped, x + 4, cursor + 11);
    }

    cursor += boxH + 3;
  }
  doc.setTextColor(...charcoal);
  return cursor + 4;
}

/**
 * Rule-based remediation guidance keyed off the status code / message a
 * failure actually carried — not a model guess, just a lookup over the same
 * categories classifyBackendError already uses for live error display.
 */
export function suggestFix(statusCode: string | number, message: string | null | undefined): string {
  const code = String(statusCode);
  const text = (message ?? "").toLowerCase();

  if (/^5\d{2}$/.test(code)) {
    return "Server-side error — check the target's application logs and resource usage (CPU/memory/DB connections) around the time of these failures.";
  }
  if (code === "429" || text.includes("rate limit")) {
    return "Rate-limited — confirm the test's request rate doesn't exceed the target's configured limits.";
  }
  if (/^4\d{2}$/.test(code)) {
    return "Client-side error — verify the request payloads, auth tokens, and headers the test sends are still valid for this environment.";
  }
  if (text.includes("timeout") || text.includes("timed out")) {
    return "Requests did not complete in time — investigate slow downstream dependencies, or increase target capacity before re-testing.";
  }
  if (text.includes("econnrefused") || (text.includes("connect") && !text.includes("connection established"))) {
    return "Target was unreachable — confirm the service was running and the network path was correct for the full test duration.";
  }
  if (text.includes("enotfound") || text.includes("dns")) {
    return "DNS resolution failed — confirm the hostname is correct and resolvable from the test environment.";
  }
  return "Review the target's server-side logs for the exact cause of this failure.";
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

/** A heading + wrapped prose paragraph — plain report text, as opposed to
 *  narrativeBox's bordered callout. Returns the Y position after the block. */
export function textBlock(doc: jsPDF, title: string, paragraph: string, y: number): number {
  const { charcoal } = REPORT_COLORS;
  sectionHeading(doc, title, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...charcoal);
  const wrapped = doc.splitTextToSize(paragraph, PAGE_W - 28) as string[];
  doc.text(wrapped, 14, y + 7);
  return y + 7 + wrapped.length * 4.3 + 6;
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
