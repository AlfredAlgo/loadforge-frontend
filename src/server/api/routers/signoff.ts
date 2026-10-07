import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { signOffs, completeTests, users } from "~/server/db/schema";
import { canViewTest } from "~/server/api/access";
import { TRPCError } from "@trpc/server";

export const signoffRouter = createTRPCRouter({
  // Append-only audit trail for a test's deployment sign-off decisions.
  list: protectedProcedure
    .input(z.object({ testId: z.string() }))
    .query(async ({ ctx, input }) => {
      const test = await ctx.db.query.completeTests.findFirst({ where: eq(completeTests.id, input.testId) });
      if (!canViewTest(ctx.user, test)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const rows = await ctx.db
        .select({
          id: signOffs.id,
          decision: signOffs.decision,
          comment: signOffs.comment,
          created_at: signOffs.created_at,
          userName: users.name,
          userEmail: users.email,
        })
        .from(signOffs)
        .innerJoin(users, eq(signOffs.user_id, users.id))
        .where(eq(signOffs.test_id, input.testId))
        .orderBy(desc(signOffs.created_at));

      return rows.map((r) => ({
        id: r.id,
        decision: r.decision as "approved" | "approved_with_reservations" | "rejected",
        comment: r.comment,
        createdAt: r.created_at.toISOString(),
        userName: r.userName,
        userEmail: r.userEmail,
      }));
    }),

  create: protectedProcedure
    .input(
      z.object({
        testId: z.string(),
        decision: z.enum(["approved", "approved_with_reservations", "rejected"]),
        comment: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const test = await ctx.db.query.completeTests.findFirst({ where: eq(completeTests.id, input.testId) });
      if (!canViewTest(ctx.user, test)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const id = uuidv4();
      await ctx.db.insert(signOffs).values({
        id,
        test_id: input.testId,
        user_id: ctx.user.id,
        decision: input.decision,
        comment: input.comment ?? null,
      });
      return { id };
    }),
});
