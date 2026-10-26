import { z } from "zod";
import { eq, count } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "~/server/api/trpc";
import { teams, users, completeTests, signOffs, testClaims, environments } from "~/server/db/schema";
import { auth } from "~/lib/auth";

export const teamRouter = createTRPCRouter({
  // Who am I, for the nav bar / audit display — role + team name, so the
  // signed-in identity is visible on screen while demoing, not just in a
  // dropdown nobody opens.
  whoAmI: protectedProcedure.query(async ({ ctx }) => {
    const row = await ctx.db.query.users.findFirst({
      where: eq(users.id, ctx.user.id),
      columns: { id: true, name: true, email: true, role: true, teamId: true },
    });
    if (!row) return null;
    const team = row.teamId
      ? await ctx.db.query.teams.findFirst({ where: eq(teams.id, row.teamId) })
      : null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      team: team ? { id: team.id, name: team.name } : null,
    };
  }),

  // My teammates — so a tester can see who else shares visibility into
  // their tests, without needing admin access.
  getMyTeammates: protectedProcedure.query(async ({ ctx }) => {
    if (!ctx.user.teamId) return [];
    const rows = await ctx.db.query.users.findMany({
      where: eq(users.teamId, ctx.user.teamId),
      columns: { id: true, name: true, email: true, role: true },
    });
    return rows;
  }),

  // ── Admin-only: team management & auditing ─────────────────────────────
  listTeams: adminProcedure.query(async ({ ctx }) => {
    const allTeams = await ctx.db.query.teams.findMany({ orderBy: (t, { asc }) => [asc(t.name)] });
    const allUsers = await ctx.db.query.users.findMany({
      columns: { id: true, name: true, email: true, role: true, teamId: true },
    });
    return allTeams.map((team) => ({
      id: team.id,
      name: team.name,
      members: allUsers.filter((u) => u.teamId === team.id),
    }));
  }),

  listUnassignedUsers: adminProcedure.query(async ({ ctx }) => {
    const allUsers = await ctx.db.query.users.findMany({
      where: (u, { isNull }) => isNull(u.teamId),
      columns: { id: true, name: true, email: true, role: true },
    });
    return allUsers;
  }),

  listAllUsers: adminProcedure.query(async ({ ctx }) => {
    return ctx.db.query.users.findMany({
      columns: { id: true, name: true, email: true, role: true, teamId: true },
      orderBy: (u, { asc }) => [asc(u.name)],
    });
  }),

  createTeam: adminProcedure
    .input(z.object({ name: z.string().min(1).max(256) }))
    .mutation(async ({ ctx, input }) => {
      const id = uuidv4();
      await ctx.db.insert(teams).values({ id, name: input.name });
      return { id, name: input.name };
    }),

  deleteTeam: adminProcedure
    .input(z.object({ teamId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Un-assign members first — a deleted team shouldn't leave users
      // pointing at a dangling team_id.
      await ctx.db.update(users).set({ teamId: null }).where(eq(users.teamId, input.teamId));
      await ctx.db.delete(teams).where(eq(teams.id, input.teamId));
      return { success: true };
    }),

  setUserTeam: adminProcedure
    .input(z.object({ userId: z.string(), teamId: z.string().nullable() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(users).set({ teamId: input.teamId }).where(eq(users.id, input.userId));
      return { success: true };
    }),

  setUserRole: adminProcedure
    .input(z.object({ userId: z.string(), role: z.enum(["admin", "tester"]) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
      return { success: true };
    }),

  // Creates an email/password account directly — mainly for someone who
  // won't use SSO. SSO itself never needs this: better-auth auto-creates
  // a user the moment someone signs in with Microsoft for the first time,
  // the same way email signup does.
  createUser: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(256),
        email: z.string().email(),
        password: z.string().min(8).max(128),
        role: z.enum(["admin", "tester"]).default("tester"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const result = await auth.api.signUpEmail({
          body: { name: input.name, email: input.email, password: input.password },
        });
        if (input.role === "admin" && result.user?.id) {
          await ctx.db.update(users).set({ role: "admin" }).where(eq(users.id, result.user.id));
        }
        return { id: result.user?.id };
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: error instanceof Error ? error.message : "Failed to create user.",
        });
      }
    }),

  updateUser: adminProcedure
    .input(z.object({ userId: z.string(), name: z.string().min(1).max(256), email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.update(users).set({ name: input.name, email: input.email }).where(eq(users.id, input.userId));
        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Could not update user — that email may already be in use by another account.",
        });
      }
    }),

  // Deleting a user is blocked while they own any tests, sign-offs, claims
  // or environments — those are compliance-relevant records (test results,
  // audit trail, requirement claims), and a hard delete would either wipe
  // them or fail outright on the DB's own foreign-key constraints. Session/
  // account rows (the login mechanism itself) do cascade automatically, so
  // this safely removes a stray/unused account; a real tester's account
  // with history needs to be reassigned or just demoted/removed from their
  // team instead.
  deleteUser: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [testCount, signOffCount, claimCount, envCount] = await Promise.all([
        ctx.db.select({ n: count() }).from(completeTests).where(eq(completeTests.user_id, input.userId)),
        ctx.db.select({ n: count() }).from(signOffs).where(eq(signOffs.user_id, input.userId)),
        ctx.db.select({ n: count() }).from(testClaims).where(eq(testClaims.user_id, input.userId)),
        ctx.db.select({ n: count() }).from(environments).where(eq(environments.user_id, input.userId)),
      ]);
      const owned = (testCount[0]?.n ?? 0) + (signOffCount[0]?.n ?? 0) + (claimCount[0]?.n ?? 0) + (envCount[0]?.n ?? 0);
      if (owned > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Can't delete — this account owns ${owned} record${owned === 1 ? "" : "s"} (tests, sign-offs, claims, or saved environments). Remove them from their team instead, or reassign that data first.`,
        });
      }
      await ctx.db.delete(users).where(eq(users.id, input.userId));
      return { success: true };
    }),
});
