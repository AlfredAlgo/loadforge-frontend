import { z } from "zod";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { createTRPCRouter, protectedProcedure, adminProcedure } from "~/server/api/trpc";
import { teams, users } from "~/server/db/schema";

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
});
