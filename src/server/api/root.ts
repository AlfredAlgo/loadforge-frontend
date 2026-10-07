import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc"
import { loadTestRouter } from "~/server/api/routers/loadtest"
import { settingsRouter } from "~/server/api/routers/settings"
import { testsRouter } from "./routers/test.events"
import { dashboardRouter } from "./routers/dashboard"
import { teamRouter } from "~/server/api/routers/team"
import { environmentsRouter } from "~/server/api/routers/environments"
import { signoffRouter } from "~/server/api/routers/signoff"

export const appRouter = createTRPCRouter({
  loadTest: loadTestRouter,
  settings: settingsRouter,
  test: testsRouter,
  dashboard: dashboardRouter,
  team: teamRouter,
  environments: environmentsRouter,
  signoff: signoffRouter,
})

export type AppRouter = typeof appRouter

export const createCaller = createCallerFactory(appRouter)
