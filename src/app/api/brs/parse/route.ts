import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import * as mammoth from "mammoth";
import { auth } from "~/lib/auth";
import { ocrPdf } from "~/lib/ocr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;
const URL_RE = /https?:\/\/[^\s"'<>)\]]+/g;
const MIN_READABLE_CHARS = 20;

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Other field labels seen across Gauteng BRS/SRS templates — if one of these
// shows up where a title's value should be, the table's cells almost
// certainly extracted out of row order, so treat it as "not found" rather
// than mistaking a neighboring label (or a bare "Title"/"Project" label
// itself, e.g. "Project Manager") for the title.
const KNOWN_LABEL_RE =
  /^(system\s*id|date\s*prepared|requested\s*by|date\s*required|new\s*functionality|impacted\s*stakeholders|purpose|root\s*cause|current\s*process|requirement|additional\s*requirement|target\s*outcome|comments|impact\s*level|priority\s*level|approval|role|name|signature|date|title|project)\b/i;

// Boilerplate seen on cover pages / headers across templates — never the
// system's name, even though it's often the very first readable text.
const BOILERPLATE_LINE_RE =
  /^(gauteng province|republic of south africa|e-government|e-govermment|unity in diversity|business\/?system requirements? specification|business requirement specification|department of [a-z ]+|page \d+ of \d+|rfc call number|date:|author:|functional unit:|prepared (for|by)|version:|requirement type:|change type:|brs\s|document (control|history|version control)|docusign envelope id)/i;

// Labels this project's title can appear under — different departments use
// different templates (see the real BRS samples this was built against).
const NAME_LABELS = ["title", "project"] as const;

function looksLikeUsableTitle(value: string | undefined): value is string {
  return !!value && /[a-z0-9]/i.test(value) && !KNOWN_LABEL_RE.test(value);
}

// The two checks below ("too long" / "ends like a full sentence") are
// right for extractTestName's fallback scan — a title shouldn't be a long
// sentence — but wrong for extractLabeledValue's continuation lines, where
// a full grammatical sentence is exactly the expected answer. Keeping them
// separate so fixing one doesn't break the other.
function isInstitutionalBoilerplate(line: string): boolean {
  if (BOILERPLATE_LINE_RE.test(line)) return true;
  if (/^\d{4}[/-]\d{2}[/-]\d{2}/.test(line)) return true; // date-first lines
  return false;
}

function isBoilerplateLine(line: string): boolean {
  if (isInstitutionalBoilerplate(line)) return true;
  if (line.length > 80) return true; // likely a sentence/paragraph, not a name
  if (/[.?!]\s*$/.test(line) && line.split(/\s+/).length > 6) return true; // sentence-like
  return false;
}

/**
 * Real Gauteng BRS/SRS documents don't share one fixed template — some use a
 * "Title:" row, some a "Project" row in a Document Control table, and some
 * (reports, non-BRS documents) have no labeled name field at all and just
 * put the system's name as the first line of the cover page. Try the
 * explicit labels first, then fall back to the first line of real content
 * (skipping institutional/boilerplate headers), then the filename.
 */
export function extractTestName(text: string, fallbackFilename: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    for (const label of NAME_LABELS) {
      // Colon is required (not optional) for the inline match — otherwise a
      // bare "Title:" line with nothing after it lets the regex backtrack
      // into capturing the colon itself as the "value".
      const inline = new RegExp(`^${label}\\s*:\\s*(.+)$`, "i").exec(line);
      const inlineValue = inline?.[1]?.trim();
      if (looksLikeUsableTitle(inlineValue)) return inlineValue;

      if (new RegExp(`^${label}\\s*:?\\s*$`, "i").test(line)) {
        const next = lines[i + 1]?.trim();
        if (looksLikeUsableTitle(next)) return next;
      }
    }
  }

  for (const line of lines) {
    if (isBoilerplateLine(line)) continue;
    if (looksLikeUsableTitle(line)) return line;
  }

  return fallbackFilename.replace(/\.(pdf|docx|txt)$/i, "").replace(/[_-]+/g, " ").trim();
}

/** Bonus, not the main point: some BRS variants do reference an endpoint. */
export function extractUrls(text: string): string[] {
  const matches = text.match(URL_RE) ?? [];
  return [...new Set(matches.map((u) => u.replace(/[.,;]+$/, "")))];
}

// Keyed the same as BRS_FIELD_LABELS in test-configuration.tsx / the manual
// entry form, so an uploaded doc and a manually-typed one produce the exact
// same shape — the report rendering code doesn't need to know which source
// a field came from. Each value is a set of label spellings seen across the
// real BRS/SRS templates this project was built against.
const BRS_CONTEXT_LABEL_PATTERNS: Record<string, string> = {
  requestedBy: "requested\\s*by",
  purpose: "purpose(?:\\s*/\\s*reason)?|reason",
  rootCause: "root\\s*cause",
  currentProcess: "current\\s*process",
  // Deliberately no bare "requirement" alternative — real documents have
  // lines like "Requirement Type: Enhancement" that would otherwise match
  // and get misread as the description itself.
  requirementDescription: "requirement\\s*description|new\\s*functionality",
  targetOutcome: "target\\s*outcome",
  priority: "priority\\s*level|impact\\s*level",
};
const MAX_FIELD_VALUE_CHARS = 500;

/**
 * Same "label: value" / "label on its own line" pattern extractTestName
 * uses, generalized to capture a value that can run multiple lines (real
 * answers on these forms are often short paragraphs, not one line) —
 * stopping at the next known label or boilerplate line so it doesn't run
 * on into an unrelated section.
 */
function extractLabeledValue(lines: string[], labelPattern: string): string | undefined {
  const labelRe = new RegExp(`^(?:${labelPattern})\\s*[:\\-]?\\s*(.*)$`, "i");
  for (let i = 0; i < lines.length; i++) {
    const match = labelRe.exec(lines[i]!);
    if (!match) continue;

    const collected: string[] = [];
    const inline = match[1]?.trim();
    if (inline) collected.push(inline);

    let j = i + 1;
    while (j < lines.length && collected.join(" ").length < MAX_FIELD_VALUE_CHARS) {
      const next = lines[j]!;
      // Stop at the next field's label or real institutional boilerplate —
      // NOT at "this line looks like a full sentence", since a full
      // sentence is exactly what a real answer looks like here.
      if (KNOWN_LABEL_RE.test(next) || isInstitutionalBoilerplate(next)) break;
      collected.push(next);
      j++;
    }

    const value = collected.join(" ").replace(/\s+/g, " ").trim();
    if (value) {
      return value.length > MAX_FIELD_VALUE_CHARS ? value.slice(0, MAX_FIELD_VALUE_CHARS) + "…" : value;
    }
  }
  return undefined;
}

/**
 * The "help populate the report" half of BRS upload: pulls whatever of the
 * standard BRS fields (purpose, root cause, target outcome, priority, ...)
 * it can find. Fields that aren't found are left out entirely rather than
 * guessed — the report only shows what the document actually said.
 */
export function extractBrsContext(text: string): Record<string, string> {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const context: Record<string, string> = {};
  for (const [key, pattern] of Object.entries(BRS_CONTEXT_LABEL_PATTERNS)) {
    const value = extractLabeledValue(lines, pattern);
    if (value) context[key] = value;
  }
  return context;
}

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const incoming = await request.formData();
  const file = incoming.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no file field" }, { status: 400 });
  }

  const lowerName = file.name.toLowerCase();
  const isPdf = lowerName.endsWith(".pdf") || file.type === "application/pdf";
  const isDocx = lowerName.endsWith(".docx") || file.type === DOCX_MIME;
  const isText = lowerName.endsWith(".txt") || file.type === "text/plain";
  if (!isPdf && !isDocx && !isText) {
    return NextResponse.json(
      { error: "Please upload a .pdf, .docx, or .txt BRS document." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file too large (10MB cap)" }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const cantReadMessage =
    "Could not find readable text in this file — it's likely a scanned image rather than a real document. " +
    "Try the Word (.docx) version if one exists, or use \"Enter manually\" below to type in the details yourself.";

  let text: string;
  let usedOcr = false;
  if (isPdf) {
    const parser = new PDFParse({ data: bytes });
    try {
      text = (await parser.getText()).text;
    } catch (error) {
      console.error("[brs/parse] PDF text extraction failed:", error);
      return NextResponse.json({ error: cantReadMessage }, { status: 422 });
    } finally {
      await parser.destroy();
    }

    // No text layer — likely a scanned image rather than a real PDF. Fall
    // back to OCR instead of failing outright. This is slower (several
    // seconds per page) and less accurate than the regular text path, so
    // it's a fallback, not the default.
    if (text.replace(/\s+/g, "").length < MIN_READABLE_CHARS) {
      try {
        text = await ocrPdf(bytes);
        usedOcr = true;
      } catch (error) {
        console.error("[brs/parse] OCR fallback failed:", error);
        return NextResponse.json({ error: cantReadMessage }, { status: 422 });
      }
    }
  } else if (isDocx) {
    try {
      text = (await mammoth.extractRawText({ buffer: bytes })).value;
    } catch (error) {
      console.error("[brs/parse] DOCX text extraction failed:", error);
      return NextResponse.json(
        { error: "Could not read this .docx file — it may be corrupted or password-protected." },
        { status: 422 },
      );
    }
  } else {
    text = bytes.toString("utf-8");
  }

  if (text.replace(/\s+/g, "").length < MIN_READABLE_CHARS) {
    return NextResponse.json({ error: cantReadMessage }, { status: 422 });
  }

  const testName = extractTestName(text, file.name);
  const urls = extractUrls(text);
  const brsContext = extractBrsContext(text);
  const fieldCount = Object.keys(brsContext).length;

  const summaryParts = [
    `Found the title "${testName}"`,
    urls.length > 0 ? `${urls.length} URL${urls.length === 1 ? "" : "s"}` : null,
    fieldCount > 0 ? `${fieldCount} requirement field${fieldCount === 1 ? "" : "s"} (for the report)` : null,
  ].filter(Boolean);
  let summary = summaryParts.join(", ") + ".";
  if (urls.length === 0) {
    summary += " No URLs were mentioned — standard BRS documents describe business requirements, not test targets, so you'll still need to add the URL(s) to test.";
  }
  if (usedOcr) {
    summary += " This was read with OCR (the document had no text layer) — double-check the fields below before starting the test.";
  }

  return NextResponse.json({ test_name: testName, urls, summary, brs_context: brsContext, used_ocr: usedOcr });
}
