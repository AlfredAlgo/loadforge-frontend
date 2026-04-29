import { createTRPCRouter, protectedProcedure, publicProcedure } from "~/server/api/trpc";
import { z } from "zod";
import { eq } from "drizzle-orm"
import { completeTests, testResults } from "../../db/schema";


export const dashboardRouter = createTRPCRouter({
  // Get overview metrics
  getOverview: protectedProcedure.query(async ({ctx}) => {
    const userId = ctx.user.id;

    const tests = await ctx.db.query.completeTests.findMany({
      where: eq(completeTests.user_id, userId),
        orderBy: (t,{desc}) => [desc(t.created_at)],
    })
    const results = await ctx.db.query.testResults.findMany({
      where: eq(completeTests.user_id, userId),
    })


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
      return {
        id: t.id,
        name: t.name,
        status: t.status,
        duration: t.duration,
        requests: r?.total_requests ?? 0,
        successRate: r && r.total_requests ? Number(((r.successful_requests / r.total_requests) * 100).toFixed(1)) : null,
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

  getHistory: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    const allResults = await ctx.db.query.testResults.findMany({
      where: eq(testResults.user_id, userId),
      orderBy: (r, { asc }) => [asc(r.created_at)],
    });

    const allTests = await ctx.db.query.completeTests.findMany({
      where: eq(completeTests.user_id, userId),
    });

    return allResults.map((r) => {
      const test = allTests.find((t) => t.id === r.test_id);
      return {
        testId: r.test_id,
        testName: test?.name ?? "Unknown",
        date: r.created_at.toISOString(),
        avgResponseTime: r.avg_response_time,
        successRate: r.total_requests
          ? Number(((r.successful_requests / r.total_requests) * 100).toFixed(1))
          : 0,
        failedRequests: r.failed_requests,
        totalRequests: r.total_requests,
        urlBreakdown: r.url_breakdown as Record<string, { url: string; requests: number; avgResponseTime: number; successRate: number; errors?: Array<{ statusCode: number | string; message: string; count: number }> }>,
      };
    });
  }),
});