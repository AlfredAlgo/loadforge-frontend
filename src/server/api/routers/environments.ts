import { z } from "zod";
import { eq, or } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { environments } from "~/server/db/schema";

// Saved base URL + headers so a tester doesn't retype the same target for
// every new test. Scoped to the creator's team when they have one (so
// teammates share the same saved list), otherwise personal.
export const environmentsRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    const rows = ctx.user.teamId
      ? await ctx.db.query.environments.findMany({
          where: or(eq(environments.user_id, ctx.user.id), eq(environments.team_id, ctx.user.teamId)),
          orderBy: (e, { asc }) => [asc(e.name)],
        })
      : await ctx.db.query.environments.findMany({
          where: eq(environments.user_id, ctx.user.id),
          orderBy: (e, { asc }) => [asc(e.name)],
        });
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      baseUrl: r.base_url,
      headers: (r.headers as Record<string, string> | null) ?? {},
    }));
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(256),
        baseUrl: z.string().url(),
        headers: z.record(z.string(), z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const id = uuidv4();
      await ctx.db.insert(environments).values({
        id,
        user_id: ctx.user.id,
        team_id: ctx.user.teamId,
        name: input.name,
        base_url: input.baseUrl,
        headers: input.headers ?? {},
      });
      return { id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(256),
        baseUrl: z.string().url(),
        headers: z.record(z.string(), z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Only the creator or (if shared via team) a teammate may edit —
      // mirrors the visibility rule used for tests.
      const existing = await ctx.db.query.environments.findFirst({ where: eq(environments.id, input.id) });
      const canEdit =
        existing &&
        (existing.user_id === ctx.user.id || (ctx.user.teamId && existing.team_id === ctx.user.teamId));
      if (!canEdit) throw new Error("Environment not found or not editable.");
      await ctx.db
        .update(environments)
        .set({ name: input.name, base_url: input.baseUrl, headers: input.headers ?? {} })
        .where(eq(environments.id, input.id));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.environments.findFirst({ where: eq(environments.id, input.id) });
      const canDelete =
        existing &&
        (existing.user_id === ctx.user.id || (ctx.user.teamId && existing.team_id === ctx.user.teamId));
      if (!canDelete) throw new Error("Environment not found or not deletable.");
      await ctx.db.delete(environments).where(eq(environments.id, input.id));
      return { success: true };
    }),
});
