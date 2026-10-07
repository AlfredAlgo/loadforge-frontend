import { eq, or, type SQL } from "drizzle-orm";
import { completeTests } from "~/server/db/schema";

/** The subset of a user's identity that every access check needs. Built
 *  once per request in trpc.ts (not from better-auth's session alone,
 *  since role/teamId live only in our own users table). */
export interface AccessUser {
  id: string;
  role: string;
  teamId: string | null;
}

export function isAdmin(user: AccessUser): boolean {
  return user.role === "admin";
}

/**
 * A test is visible to a user when: they created it, it belongs to their
 * team, or they're an admin (who sees everything — that's the point of the
 * "overview and auditing" role). Returns `undefined` for an admin, meaning
 * "no filter" — callers should treat `undefined` as "don't add a WHERE".
 */
export function testVisibilityWhere(user: AccessUser): SQL | undefined {
  if (isAdmin(user)) return undefined;
  if (user.teamId) {
    return or(eq(completeTests.user_id, user.id), eq(completeTests.team_id, user.teamId));
  }
  return eq(completeTests.user_id, user.id);
}

/** True if this specific test row is visible to this user — for the cases
 *  (testResults, testPhases, signOffs) where we look the test up first and
 *  then just need a yes/no, rather than a WHERE clause to attach. */
export function canViewTest(
  user: AccessUser,
  test: { user_id: string; team_id: string | null } | null | undefined,
): boolean {
  if (!test) return false;
  if (isAdmin(user)) return true;
  if (test.user_id === user.id) return true;
  if (user.teamId && test.team_id && test.team_id === user.teamId) return true;
  return false;
}
