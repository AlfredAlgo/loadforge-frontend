// One-off admin recovery tool: resets an existing account's password
// directly in the database, bypassing the "forgot password" email flow
// (which isn't wired up to a real email provider yet — see auth.ts). Uses
// better-auth's own password hasher via its $context, so the resulting
// hash is byte-for-byte what a normal signup/password-change would store
// — this is not a custom/guessed hashing scheme.
//
// Usage (from the project root):
//   RESET_EMAIL='someone@example.com' RESET_PASSWORD='newpassword123' \
//     SKIP_ENV_VALIDATION=true DATABASE_URL='...' npx tsx scripts/reset-password.mjs
//
// Prefix the command with a space if your shell is configured to skip
// space-prefixed lines in its history (bash: `HISTCONTROL=ignorespace`).

import { eq, and } from "drizzle-orm";
import { users, account } from "../src/server/db/schema.ts";

const email = process.env.RESET_EMAIL;
const newPassword = process.env.RESET_PASSWORD;

if (!email || !newPassword) {
  console.error("Set RESET_EMAIL and RESET_PASSWORD environment variables before running this.");
  process.exit(1);
}
if (newPassword.length < 8) {
  console.error("Password must be at least 8 characters (better-auth's own minimum).");
  process.exit(1);
}

const { db } = await import("../src/server/db/index.ts");
const { auth } = await import("../src/lib/auth.ts");

const user = await db.query.users.findFirst({ where: eq(users.email, email) });
if (!user) {
  console.error(`No account found for ${email}.`);
  process.exit(1);
}

const existingAccount = await db.query.account.findFirst({
  where: and(eq(account.userId, user.id), eq(account.providerId, "credential")),
});

const ctx = await auth.$context;
const hash = await ctx.password.hash(newPassword);

if (existingAccount) {
  await db.update(account).set({ password: hash }).where(eq(account.id, existingAccount.id));
  console.log(`Password updated for ${email} (existing credential account).`);
} else {
  // Account exists (e.g. created via SSO) but has no email/password
  // credential row yet — add one so they can also log in with a password.
  const { v4: uuidv4 } = await import("uuid");
  await db.insert(account).values({
    id: uuidv4(),
    userId: user.id,
    accountId: user.id,
    providerId: "credential",
    password: hash,
  });
  console.log(`Password set for ${email} (new credential account — this account previously had no password).`);
}

process.exit(0);
