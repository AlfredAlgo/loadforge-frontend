import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { eventBind } from "../socket/events.bind";
import { onPhaseComplete } from "../socket/phase.complete";
import { onTestComplete } from "../socket/test.complete";
import { onScenarioComplete, onScenarioFailed } from "../socket/scenario.complete";
import { db } from "../db/index";
import { CreateWSSContextFnOptions } from "@trpc/server/adapters/ws";
import { type CreateNextContextOptions } from "@trpc/server/adapters/next";
import type { IncomingHttpHeaders } from "http";
import { auth } from "~/lib/auth";
import { eq } from "drizzle-orm";
import { users } from "../db/schema";

// Guard against Next.js dev-mode HMR re-running this module — each re-run
// would add another set of socket listeners and eventbus subscribers, so a
// single backend emit would be handled N times (duplicate DB writes etc.).
const globalForBindings = globalThis as unknown as { _bindingsRegistered?: boolean };
if (!globalForBindings._bindingsRegistered) {
  globalForBindings._bindingsRegistered = true;
  eventBind();
  onPhaseComplete();
  onTestComplete();
  onScenarioComplete();
  onScenarioFailed();
}
function toHeaders(headers: IncomingHttpHeaders): Headers {
  const result = new Headers();
  for (const [key, value] of Object.entries(headers)) {
    if (value) {
      if (Array.isArray(value)) {
        for (const v of value) {
          result.append(key, v);
        }
      } else {
        result.set(key, value);
      }
    }
  }
  return result;
}
// better-auth's session.user only carries the fields better-auth itself
// knows about (id/name/email/...) — role and teamId live in our own users
// table, so every request looks the row up to attach them. This is one
// extra indexed lookup per request, which is cheap at this app's scale.
async function withRoleAndTeam(sessionUser: { id: string } & Record<string, unknown> | null | undefined) {
  if (!sessionUser) return null;
  const row = await db.query.users.findFirst({
    where: eq(users.id, sessionUser.id),
    columns: { role: true, teamId: true },
  });
  return {
    ...sessionUser,
    role: row?.role ?? "tester",
    teamId: row?.teamId ?? null,
  };
}

export const createWSContext = async (opts: CreateWSSContextFnOptions) => {
  // Try to extract HTTP headers from available fields (req or connection), fallback to empty object
  const incomingHeaders: IncomingHttpHeaders =
    (opts as any)?.req?.headers ?? (opts as any)?.connection?.headers ?? {};
    const headers = toHeaders(incomingHeaders);
    const session = await auth.api.getSession({ headers });
    const user = await withRoleAndTeam(session?.user);
  return {
    headers: incomingHeaders,
    db,
    session,
    user,
  };
};
export const createTRPCContext = async (
  opts: CreateNextContextOptions | { headers?: any } = {}
) => {
  // Accept either the Next.js context (with req.headers) or a simple object with headers
  const incomingHeaders = (opts as any)?.req?.headers ?? (opts as any)?.headers ?? {};
  const headers = toHeaders(incomingHeaders);
  const session = await auth.api.getSession({ headers: incomingHeaders });
  const user = await withRoleAndTeam(session?.user);

  return {
    headers: incomingHeaders,
    db,
    session,
    user,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

const isAuthed = t.middleware(({ next, ctx }) => {
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      session: ctx.session,
      user: ctx.user,
    },
  });
});

const isAdmin = t.middleware(({ next, ctx }) => {
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required." });
  }
  return next({
    ctx: {
      session: ctx.session,
      user: ctx.user,
    },
  });
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthed);
// Site-wide admin only — team management, SSO config, cross-team auditing.
export const adminProcedure = t.procedure.use(isAuthed).use(isAdmin);