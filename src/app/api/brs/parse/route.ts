import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import * as mammoth from "mammoth";
import { auth } from "~/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;
const URL_RE = /https?:\/\/[^\s"'<>)\]]+/g;
const MIN_READABLE_CHARS = 20;

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

// Other field labels from the standard Gauteng BRS/SRS template — if one of
// these shows up where a title's value should be, the table's cells almost
// certainly extracted out of row order, so treat it as "not found" rather
// than mistaking a neighboring label for the title.
const KNOWN_LABEL_RE =
  /^(system\s*id|date\s*prepared|requested\s*by|date\s*required|new\s*functionality|impacted\s*stakeholders|purpose|root\s*cause|current\s*process|requirement|additional\s*requirement|target\s*outcome|comments|impact\s*level|priority\s*level|approval|role|name|signature|date)\b/i;

function looksLikeUsableTitle(value: string | undefined): value is string {
  return !!value && /[a-z0-9]/i.test(value) && !KNOWN_LABEL_RE.test(value);
}

/**
 * Real Gauteng BRS/SRS documents follow one fixed template — a "Title:" row
 * near the top of a labeled table, followed by Purpose/Reason, Root Cause,
 * Current Process, Requirement Description, Target Outcome, etc. They
 * describe business/functional requirements, not test-execution parameters:
 * no target URLs, no concurrency levels, no durations. So this only pulls
 * what's actually there — a name for the test — rather than pretending to
 * find load-test config that isn't part of the template.
 */
function extractTestName(text: string, fallbackFilename: string): string {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    // Colon is required (not optional) here — otherwise a bare "Title:" line
    // with nothing after it lets the regex backtrack into capturing the
    // colon itself as the "value".
    const inline = /^title\s*:\s*(.+)$/i.exec(line);
    const inlineValue = inline?.[1]?.trim();
    if (looksLikeUsableTitle(inlineValue)) return inlineValue;

    if (/^title\s*:?\s*$/i.test(line)) {
      const next = lines[i + 1]?.trim();
      if (looksLikeUsableTitle(next)) return next;
    }
  }
  return fallbackFilename.replace(/\.(pdf|docx|txt)$/i, "").replace(/[_-]+/g, " ").trim();
}

/** Bonus, not the main point: some BRS variants do reference an endpoint. */
function extractUrls(text: string): string[] {
  const matches = text.match(URL_RE) ?? [];
  return [...new Set(matches.map((u) => u.replace(/[.,;]+$/, "")))];
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
  const summary =
    urls.length > 0
      ? `Found the title "${testName}" and ${urls.length} URL${urls.length === 1 ? "" : "s"} in the document.`
      : `Found the title "${testName}". No URLs were mentioned — standard BRS documents describe business requirements, not test targets, so you'll still need to add the URL(s) to test.`;

  return NextResponse.json({ test_name: testName, urls, summary });
}
