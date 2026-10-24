import {betterAuth, email} from 'better-auth'
import { db } from '../server/db'
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from '../server/db/schema'
import{nextCookies} from 'better-auth/next-js';
import { env } from '~/env'

// better-auth always computes the OAuth redirect URI itself as
// `${baseURL}/api/auth/callback/microsoft` — there's no option to override
// it per-provider. AZURE_REDIRECT_URI can't change that, so this only
// checks the two agree and logs a loud warning if they don't — catching a
// misconfigured Azure App Registration (or a BETTER_AUTH_URL that's drifted
// from what's actually registered there) at startup instead of a confusing
// "redirect_uri_mismatch" the next time someone tries to log in.
if (env.AZURE_REDIRECT_URI) {
  const computed = `${env.BETTER_AUTH_URL}/api/auth/callback/microsoft`;
  if (env.AZURE_REDIRECT_URI !== computed) {
    console.warn(
      `[auth] AZURE_REDIRECT_URI ("${env.AZURE_REDIRECT_URI}") does not match the redirect URI this app will actually use ("${computed}"). ` +
      `Update the Redirect URI registered on the Azure AD App Registration to exactly "${computed}", or Microsoft sign-in will fail.`,
    );
  }
}

export const auth = betterAuth({
  // Microsoft Entra ID (Azure AD) SSO — only registered when both the
  // client ID and secret are actually set, so an environment without them
  // configured just doesn't offer the Microsoft button rather than
  // crashing on startup or registering a half-configured provider.
  // Scoping to a specific tenantId (rather than the "common" default)
  // means only accounts in this Azure directory can sign in via SSO —
  // what you want for a government tenant, not an open "any Microsoft
  // account" login.
  socialProviders:
    env.AZURE_CLIENT_ID && env.AZURE_CLIENT_SECRET
      ? {
          microsoft: {
            clientId: env.AZURE_CLIENT_ID,
            clientSecret: env.AZURE_CLIENT_SECRET,
            tenantId: env.AZURE_TENANT_ID,
          },
        }
      : undefined,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema : {
        ...schema,
        user: schema.users,
        session: schema.session,
        account: schema.account,  
        verification: schema.verification
    }
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    sendResetPassword: async ({user, url}) => {
      // Implement your email sending logic here using your preferred email service
      // For example, you could use nodemailer or any transactional email service API
      console.log(`Send password reset email to ${user.email} with token: ${url}`);
    }
  },
  plugins: [nextCookies()],
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [
    env.BETTER_AUTH_URL,
    env.NEXT_PUBLIC_APP_URL,
    "https://loadforge-frontend-prod.azurewebsites.net",
  ].filter(Boolean) as string[],
})