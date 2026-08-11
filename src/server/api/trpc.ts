import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { eventBind } from "../socket/events.bind";
import { onPhaseComplete } from "../socket/phase.complete";
import { onTestComplete } from "../socket/test.complete";
import { db } from "../db/index";
import { CreateWSSContextFnOptions } from "@trpc/server/adapters/ws";
import { type CreateNextContextOptions } from "@trpc/server/adapters/next";
import type { IncomingHttpHeaders } from "http";
import { auth } from "~/lib/auth";

eventBind();
onPhaseComplete();
onTestComplete();
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
export const createWSContext = async (opts: CreateWSSContextFnOptions) => {
  // Try to extract HTTP headers from available fields (req or connection), fallback to empty object
  const incomingHeaders: IncomingHttpHeaders =
    (opts as any)?.req?.headers ?? (opts as any)?.connection?.headers ?? {};
    const headers = toHeaders(incomingHeaders);
    const session = await auth.api.getSession({ headers });
  return {
    headers: incomingHeaders,
    db,
    session,
    user: session?.user || null,
  };
};
export const createTRPCContext = async (
  opts: CreateNextContextOptions | { headers?: any } = {}
) => {
  // Accept either the Next.js context (with req.headers) or a simple object with headers
  const incomingHeaders = (opts as any)?.req?.headers ?? (opts as any)?.headers ?? {};
  const headers = toHeaders(incomingHeaders);
  const session = await auth.api.getSession({ headers: incomingHeaders });

  return {
    headers: incomingHeaders,
    db,
    session,
    user: session?.user || null,
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


export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthed);