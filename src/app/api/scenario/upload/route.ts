import { NextResponse } from "next/server";
import { auth } from "~/lib/auth";
import { env } from "~/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;

/**
 * A file with the right extension can still be useless to run — an empty
 * or gutted .jmx with no HTTP samplers, or a Taurus .yaml with no request
 * steps under any scenario. The backend accepts those (they're structurally
 * valid, just empty) and then never reports progress or completion for
 * them, leaving the run stuck at "running" forever. Catching that here,
 * before the file ever reaches the backend, is cheap and gives an
 * actionable message instead of a run nobody can diagnose.
 */
function findUploadIssue(filename: string, text: string): string | null {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".jmx")) {
    if (!/<jmeterTestPlan[\s>]/.test(text)) {
      return "This doesn't look like a JMeter test plan — no <jmeterTestPlan> root element was found. Export it again from JMeter (File → Save Test Plan As).";
    }
    // Enabled defaults to true when the attribute is omitted, so only an
    // explicit enabled="false" on the opening tag counts as disabled.
    const samplerTags = text.match(/<HTTPSamplerProxy\b[^>]*>/g) ?? [];
    const hasEnabledSampler = samplerTags.some((tag) => !/enabled\s*=\s*"false"/.test(tag));
    if (!hasEnabledSampler) {
      return samplerTags.length > 0
        ? "Every HTTP Request sampler in this test plan is disabled, so the run would never send a single request. Enable at least one sampler and re-export."
        : "This test plan has no HTTP Request samplers in it, so there's nothing for LoadForge to run. Record or add at least one HTTP request and re-export.";
    }
  } else if (lower.endsWith(".yaml") || lower.endsWith(".yml")) {
    if (!/^\s*scenarios\s*:/m.test(text)) {
      return "This doesn't look like a Taurus/BlazeMeter scenario file — no top-level \"scenarios:\" key was found.";
    }
    // Heuristic, not a full YAML parse: a "requests:" key is only useful if
    // followed by at least one list item (either a "- " block entry, or a
    // non-empty inline [...] array) somewhere after it.
    const hasRequests = /requests\s*:\s*(\n\s*-\s+\S|\[[^\]\s][^\]]*\])/.test(text);
    if (!hasRequests) {
      return "No request steps were found under any scenario in this file, so the run would have nothing to send. Add at least one request to a scenario's \"requests:\" list and re-upload.";
    }
  }

  return null;
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
  const name = file.name.toLowerCase();
  const accepted = [".jmx", ".yaml", ".yml"];
  if (!accepted.some((ext) => name.endsWith(ext))) {
    return NextResponse.json(
      { error: "expected a .jmx, .yaml, or .yml file" },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file too large (5MB cap)" }, { status: 413 });
  }

  const text = await file.text();
  const issue = findUploadIssue(file.name, text);
  if (issue) {
    return NextResponse.json({ error: issue }, { status: 422 });
  }

  const forwarded = new FormData();
  forwarded.append("file", file, file.name);

  let backendRes: Response;
  try {
    backendRes = await fetch(`${env.SOCKET_URL}/scenario/upload`, {
      method: "POST",
      body: forwarded,
    });
  } catch (exc) {
    console.error("[scenario/upload] backend unreachable:", exc);
    return NextResponse.json(
      { error: "backend unreachable" },
      { status: 502 },
    );
  }

  const body = await backendRes.json().catch(() => ({ error: "invalid backend response" }));
  return NextResponse.json(body, { status: backendRes.status });
}
