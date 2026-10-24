import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().url(),
    SOCKET_URL: z.string().url(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.string().url(),
    VERCEL_URL: z.string().optional(),
    // Microsoft Entra ID (Azure AD) single sign-on. All optional so the app
    // still starts in any environment where SSO hasn't been configured yet
    // — the login page simply doesn't show the Microsoft button.
    AZURE_CLIENT_ID: z.string().optional(),
    AZURE_CLIENT_SECRET: z.string().optional(),
    AZURE_TENANT_ID: z.string().optional(),
    // better-auth always computes the redirect URI itself as
    // `${BETTER_AUTH_URL}/api/auth/callback/microsoft` — it can't be
    // pointed at a different value. This one isn't read by the login
    // logic at all; it's only used as a startup sanity check (see
    // auth.ts) that warns loudly if it doesn't match what's actually
    // registered in the Azure AD App Registration, instead of failing
    // silently with a confusing redirect_uri_mismatch at login time.
    AZURE_REDIRECT_URI: z.string().optional(),
  },

  client: {
    NEXT_PUBLIC_APP_URL: z.string().url(),
    NEXT_PUBLIC_BETTER_AUTH_CALLBACK: z.string().url(),
  },

  runtimeEnv: {
    // Server
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    SOCKET_URL: process.env.SOCKET_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    VERCEL_URL: process.env.VERCEL_URL,
    AZURE_CLIENT_ID: process.env.AZURE_CLIENT_ID,
    AZURE_CLIENT_SECRET: process.env.AZURE_CLIENT_SECRET,
    AZURE_TENANT_ID: process.env.AZURE_TENANT_ID,
    AZURE_REDIRECT_URI: process.env.AZURE_REDIRECT_URI,

    // Client
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_BETTER_AUTH_CALLBACK: process.env.NEXT_PUBLIC_BETTER_AUTH_CALLBACK,
  },

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});