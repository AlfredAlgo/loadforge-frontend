import { z } from "zod"
import { eq } from "drizzle-orm"
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc"
import { settings } from "~/server/db/schema"
import { env } from "~/env"

// `settings` is a plain key/value table — each "section" below is a JSON
// blob under its own key, read/written as a whole rather than modeled as
// its own table, since there's only ever one row per key.
const GENERAL_KEY = "general"

const generalSchema = z.object({
  emailEnabled: z.boolean(),
  emailRecipient: z.string().email().or(z.literal("")),
  notificationsEnabled: z.boolean(),
  defaultDuration: z.number().positive(),
  defaultRampUp: z.number().min(0),
  defaultRampDown: z.number().min(0),
})
const defaultGeneral = {
  emailEnabled: false,
  emailRecipient: "",
  notificationsEnabled: true,
  defaultDuration: 300,
  defaultRampUp: 60,
  defaultRampDown: 60,
}

async function getJson<T>(db: typeof import("~/server/db").db, key: string, fallback: T): Promise<T> {
  const row = await db.query.settings.findFirst({ where: eq(settings.key, key) })
  if (!row) return fallback
  try {
    return { ...fallback, ...JSON.parse(row.value) } as T
  } catch {
    return fallback
  }
}

async function setJson(db: typeof import("~/server/db").db, key: string, value: unknown) {
  const json = JSON.stringify(value)
  await db
    .insert(settings)
    .values({ key, value: json })
    .onConflictDoUpdate({ target: settings.key, set: { value: json, updatedAt: new Date() } })
}

export const settingsRouter = createTRPCRouter({
  getGeneral: protectedProcedure.query(async ({ ctx }) => {
    return getJson(ctx.db, GENERAL_KEY, defaultGeneral)
  }),

  updateGeneral: protectedProcedure
    .input(generalSchema.partial())
    .mutation(async ({ ctx, input }) => {
      const current = await getJson(ctx.db, GENERAL_KEY, defaultGeneral)
      const next = { ...current, ...input }
      await setJson(ctx.db, GENERAL_KEY, next)
      return next
    }),

  // Live status, not a stored config — the real Microsoft Entra ID
  // credentials live in server environment variables (same as every other
  // secret in this app), not in this settings table, since better-auth
  // reads them once at startup. publicProcedure because the login page
  // needs this before any session exists, to decide whether to show the
  // "Continue with Microsoft" button. Never exposes the client secret
  // itself — just whether one is set, and which tenant.
  getSso: publicProcedure.query(() => {
    return {
      microsoftConfigured: !!(env.AZURE_CLIENT_ID && env.AZURE_CLIENT_SECRET),
      tenantId: env.AZURE_TENANT_ID ?? null,
    }
  }),
})
