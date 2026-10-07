import { z } from "zod"
import { eq } from "drizzle-orm"
import { createTRPCRouter, protectedProcedure, adminProcedure } from "~/server/api/trpc"
import { settings } from "~/server/db/schema"

// `settings` is a plain key/value table — each "section" below is a JSON
// blob under its own key, read/written as a whole rather than modeled as
// its own table, since there's only ever one row per key.
const GENERAL_KEY = "general"
const SSO_KEY = "sso"

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

// SSO isn't wired up to an identity provider yet — this just persists the
// config a future integration will read, and the UI shows it as
// "Coming soon" with the actual enable switch disabled until then.
const ssoSchema = z.object({
  provider: z.enum(["azure_ad", "okta", "generic_oidc"]),
  clientId: z.string(),
  clientSecret: z.string(),
  issuerUrl: z.string(),
})
const defaultSso = {
  provider: "azure_ad" as const,
  clientId: "",
  clientSecret: "",
  issuerUrl: "",
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

  // Readable by anyone signed in (so non-admins see the "coming soon"
  // state too), but only an admin can change it.
  getSso: protectedProcedure.query(async ({ ctx }) => {
    const config = await getJson(ctx.db, SSO_KEY, defaultSso)
    // Never send the client secret back down to the browser.
    return { ...config, clientSecret: config.clientSecret ? "••••••••" : "" }
  }),

  updateSso: adminProcedure
    .input(ssoSchema.partial())
    .mutation(async ({ ctx, input }) => {
      const current = await getJson(ctx.db, SSO_KEY, defaultSso)
      // Keep the existing secret if the admin left the masked value alone.
      const nextSecret =
        input.clientSecret && input.clientSecret !== "••••••••" ? input.clientSecret : current.clientSecret
      const next = { ...current, ...input, clientSecret: nextSecret }
      await setJson(ctx.db, SSO_KEY, next)
      return { success: true }
    }),
})
