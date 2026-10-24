import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { testClaims, completeTests, users } from "~/server/db/schema";
import { canViewTest } from "~/server/api/access";
import { TRPCError } from "@trpc/server";

const VERDICTS = ["met", "partially_met", "not_met", "n_a"] as const;

async function requireViewableTest(db: typeof import("~/server/db").db, testId: string, user: Parameters<typeof canViewTest>[0]) {
  const test = await db.query.completeTests.findFirst({ where: eq(completeTests.id, testId) });
  if (!canViewTest(user, test)) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}

/**
 * Manual requirement claims — "the process owner confirms this test shows
 * requirement X was met" — written after a test completes and before the
 * report is generated. Unlike signOffs, these are editable/deletable by
 * anyone who can see the test (same team-wide access as everything else
 * about a test), since they're drafted report content, not a decision of
 * record.
 */
export const claimsRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ testId: z.string() }))
    .query(async ({ ctx, input }) => {
      await requireViewableTest(ctx.db, input.testId, ctx.user);
      const rows = await ctx.db
        .select({
          id: testClaims.id,
          requirement: testClaims.requirement,
          claim: testClaims.claim,
          verdict: testClaims.verdict,
          created_at: testClaims.created_at,
          updated_at: testClaims.updated_at,
          userName: users.name,
          userEmail: users.email,
        })
        .from(testClaims)
        .innerJoin(users, eq(testClaims.user_id, users.id))
        .where(eq(testClaims.test_id, input.testId))
        .orderBy(asc(testClaims.created_at));

      return rows.map((r) => ({
        id: r.id,
        requirement: r.requirement,
        claim: r.claim,
        verdict: r.verdict as (typeof VERDICTS)[number],
        createdAt: r.created_at.toISOString(),
        updatedAt: r.updated_at.toISOString(),
        userName: r.userName,
        userEmail: r.userEmail,
      }));
    }),

  create: protectedProcedure
    .input(
      z.object({
        testId: z.string(),
        requirement: z.string().min(1).max(512),
        claim: z.string().min(1).max(4000),
        verdict: z.enum(VERDICTS),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await requireViewableTest(ctx.db, input.testId, ctx.user);
      const id = uuidv4();
      await ctx.db.insert(testClaims).values({
        id,
        test_id: input.testId,
        user_id: ctx.user.id,
        requirement: input.requirement,
        claim: input.claim,
        verdict: input.verdict,
      });
      return { id };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        requirement: z.string().min(1).max(512),
        claim: z.string().min(1).max(4000),
        verdict: z.enum(VERDICTS),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.testClaims.findFirst({ where: eq(testClaims.id, input.id) });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await requireViewableTest(ctx.db, existing.test_id, ctx.user);
      await ctx.db
        .update(testClaims)
        .set({ requirement: input.requirement, claim: input.claim, verdict: input.verdict, updated_at: new Date() })
        .where(eq(testClaims.id, input.id));
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.query.testClaims.findFirst({ where: eq(testClaims.id, input.id) });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      await requireViewableTest(ctx.db, existing.test_id, ctx.user);
      await ctx.db.delete(testClaims).where(eq(testClaims.id, input.id));
      return { success: true };
    }),
});
