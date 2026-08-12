import { NextResponse } from "next/server";
import { auth } from "~/lib/auth";
import { env } from "~/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;

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
