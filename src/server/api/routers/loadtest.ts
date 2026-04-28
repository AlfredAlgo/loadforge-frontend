// loadforge/src/server/api/routers/loadtest.ts
import { z } from "zod"
import { createTRPCRouter, publicProcedure , protectedProcedure} from "~/server/api/trpc"
import { testResults, completeTests, testPhases } from "~/server/db/schema" // Import your schema tables
import { eq, and } from "drizzle-orm" // Import eq for equality comparisons

export const loadTestRouter = createTRPCRouter({

  // Get test results
  getResults: protectedProcedure.input(z.object({ testId: z.string() })).query(async ({ ctx, input }) => {
    const userId = ctx.user.id;
    // We expect testId to be a string, matching the varchar type in the schema
    const result = await ctx.db.query.testResults.findFirst({
      where: and(
        eq(testResults.test_id, input.testId),
        eq(testResults.user_id, userId)
      )
    });

    if (!result) {
      // Handle case where no results are found for the given testId
      throw new Error("Test results not found for the given test ID.");
    }

    // Since our database schema fields match the frontend interface,
    // we can directly return the result.
    // Drizzle will handle the mapping from snake_case (DB) to camelCase (JS) if configured,
    // otherwise, you might need to manually map. Assuming direct mapping for now.

    return {
      testId: result.test_id,
      totalRequests: result.total_requests,
      successfulRequests: result.successful_requests,
      failedRequests: result.failed_requests,
      avgResponseTime: result.avg_response_time,
      minResponseTime: result.min_response_time,
      maxResponseTime: result.max_response_time,
      p50ResponseTime: result.p50_response_time,
      p95ResponseTime: result.p95_response_time,
      p99ResponseTime: result.p99_response_time,
      requestsPerSecond: result.requests_per_second,
      urlBreakdown: result.url_breakdown as any, // Cast to any or define a more specific type if necessary
      phaseMetrics: result.phase_metrics as any, // Cast to any or define a more specific type if necessary
    };
  }),
  // Add to loadTestRouter
getTestPhases: protectedProcedure
  .input(z.object({ testId: z.string() }))
  .query(async ({ ctx, input }) => {
    const userId = ctx.user.id;
    const phases = await ctx.db
      .select()
      .from(testPhases)
      .where(
        and(
          eq(testPhases.test_id, input.testId),
          eq(testPhases.user_id, userId)
        )
      )
      .orderBy(testPhases.phase_number);

    return phases.map((phase) => ({
      phase: phase.phase_number,
      totalPhases: phase.total_phases,
      concurrency: phase.concurrency,
      requests: phase.requests,
      successCount: phase.success_count,
      errorCount: phase.error_count,
      percentiles: phase.percentile as { p50: number; p95: number; p99: number },
      successRate: phase.requests > 0 
        ? ((phase.success_count / phase.requests) * 100) 
        : 0,
    }));
  }),
})