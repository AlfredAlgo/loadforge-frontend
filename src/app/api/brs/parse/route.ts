import { NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { auth } from "~/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024;
const URL_RE = /https?:\/\/[^\s"'<>)\]]+/g;

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
    const inline = /^title\s*:?\s*(.+)$/i.exec(line);
    if (inline?.[1] && !/^title$/i.test(inline[1].trim())) {
      return inline[1].trim();
    }
    if (/^title\s*:?$/i.test(line) && lines[i + 1]) {
      return lines[i + 1]!;
    }
  }
  return fallbackFilename.replace(/\.(pdf|txt)$/i, "").replace(/[_-]+/g, " ").trim();
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
  const isText = lowerName.endsWith(".txt") || file.type === "text/plain";
  if (!isPdf && !isText) {
    return NextResponse.json(
      { error: "Please upload a .pdf or .txt BRS document." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file too large (10MB cap)" }, { status: 413 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  let text: string;
  if (isPdf) {
    const parser = new PDFParse({ data: bytes });
    try {
      text = (await parser.getText()).text;
    } catch (error) {
      console.error("[brs/parse] PDF text extraction failed:", error);
      return NextResponse.json(
        { error: "Could not read this PDF — it may be scanned/image-only or corrupted." },
        { status: 422 },
      );
    } finally {
      await parser.destroy();
    }
  } else {
    text = bytes.toString("utf-8");
  }

  const testName = extractTestName(text, file.name);
  const urls = extractUrls(text);
  const summary =
    urls.length > 0
      ? `Found the title "${testName}" and ${urls.length} URL${urls.length === 1 ? "" : "s"} in the document.`
      : `Found the title "${testName}". No URLs were mentioned — standard BRS documents describe business requirements, not test targets, so you'll still need to add the URL(s) to test.`;

  return NextResponse.json({ test_name: testName, urls, summary });
}
