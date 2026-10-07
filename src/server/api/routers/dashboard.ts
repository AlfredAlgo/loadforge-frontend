import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";
import { z } from "zod";
import { inArray } from "drizzle-orm"
import { completeTests, testResults } from "../../db/schema";
import { testVisibilityWhere } from "~/server/api/access";

export const dashboardRouter = createTRPCRouter({
  // Get overview metrics
  getOverview: protectedProcedure.query(async ({ctx}) => {
    const tests = await ctx.db.query.completeTests.findMany({
      where: testVisibilityWhere(ctx.user),
      orderBy: (t,{desc}) => [desc(t.created_at)],
    })
    const testIds = tests.map((t) => t.id);
    // Was previously filtered with completeTests.user_id against the
    // test_result table directly, which referenced a column from a table
    // not in this query's FROM clause — fixed by looking results up by
    // the already-visibility-filtered test IDs instead.
    const results = testIds.length
      ? await ctx.db.query.testResults.findMany({
          where: inArray(testResults.test_id, testIds),
        })
      : [];


     const totalTests = tests.length;
    const avgResponseTime = results.length
      ? Math.round(results.reduce((s, r) => s + r.avg_response_time, 0) / results.length)
      : 0;
    const totalRequests = results.reduce((s, r) => s + r.total_requests, 0);
    const successfulRequests = results.reduce((s, r) => s + r.successful_requests, 0);
    const failedRequests = results.reduce((s, r) => s + r.failed_requests, 0);
    const successRate = totalRequests ? Number(((successfulRequests / totalRequests) * 100).toFixed(1)) : 0;

    const recentTests = tests.slice(0, 5).map((t) => {
      const r = results.find((res) => res.test_id === t.id);
      // Scenarios store their metrics in completeTests.scenario_metrics, not
      // in the testResults table. Pull request / success counts from there
      // when present so scenario rows don't render as "— requests, —%".
      const scenarioSummary =
        (t.scenario_metrics as { summary?: { total_samples?: number; success_count?: number } } | null)?.summary;
      const scenarioRequests = scenarioSummary?.total_samples ?? null;
      const scenarioSuccessRate =
        scenarioSummary && scenarioSummary.total_samples
          ? Number(
              (((scenarioSummary.success_count ?? 0) / scenarioSummary.total_samples) * 100).toFixed(1),
            )
          : null;
      return {
        id: t.id,
        name: t.name,
        // 'url' = legacy CSV ramp test, 'scenario' = uploaded .jmx/.yaml
        type: t.type,
        status: t.status,
        duration: t.duration,
        requests: r?.total_requests ?? scenarioRequests ?? 0,
        successRate:
          r && r.total_requests
            ? Number(((r.successful_requests / r.total_requests) * 100).toFixed(1))
            : scenarioSuccessRate,
        createdAt: t.created_at?.toISOString?.() ?? null,
      };
    });
    return {
        metrics:{
        totalTests,
        avgResponseTime,
        successRate,
        failedRequests,
      },
      recentTests,
        }
   }),

  // Run-over-run trend for a given test name — success rate and avg
  // response time across every completed run sharing that name, oldest
  // first, so a line chart reads left-to-right as "getting better/worse
  // over time". Scoped by the same visibility rule as everything else.
  getTrend: protectedProcedure
    .input(z.object({ name: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const allTests = await ctx.db.query.completeTests.findMany({
        where: testVisibilityWhere(ctx.user),
        orderBy: (t, { asc }) => [asc(t.created_at)],
      });
      const completed = allTests.filter((t) => t.status === "completed");

      // Distinct test names, most-recently-run first, for the picker.
      const namesSeen = new Map<string, number>();
      for (const t of completed) {
        namesSeen.set(t.name, (t.created_at?.getTime?.() ?? 0));
      }
      const availableNames = [...namesSeen.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([name]) => name);

      const targetName = input.name ?? availableNames[0];
      if (!targetName) return { availableNames, points: [] };

      const runs = completed.filter((t) => t.name === targetName);
      const runIds = runs.map((t) => t.id);
      const results = runIds.length
        ? await ctx.db.query.testResults.findMany({ where: inArray(testResults.test_id, runIds) })
        : [];

      const points = runs.map((t) => {
        const r = results.find((res) => res.test_id === t.id);
        const scenarioSummary =
          (t.scenario_metrics as { summary?: { total_samples?: number; success_count?: number; avg_latency_ms?: number } } | null)
            ?.summary;
        const successRate = r && r.total_requests
          ? (r.successful_requests / r.total_requests) * 100
          : scenarioSummary && scenarioSummary.total_samples
            ? ((scenarioSummary.success_count ?? 0) / scenarioSummary.total_samples) * 100
            : null;
        const avgResponseTime = r?.avg_response_time ?? scenarioSummary?.avg_latency_ms ?? null;
        return {
          testId: t.id,
          date: t.created_at?.toISOString?.() ?? null,
          successRate: successRate !== null ? Number(successRate.toFixed(1)) : null,
          avgResponseTime: avgResponseTime !== null ? Math.round(avgResponseTime) : null,
        };
      });

      return { availableNames, points };
    }),
});
