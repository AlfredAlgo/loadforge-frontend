// loadforge/src/server/api/routers/loadtest.ts
import { z } from "zod"
import { createTRPCRouter, publicProcedure , protectedProcedure} from "~/server/api/trpc"
import { testResults, completeTests } from "~/server/db/schema" // Import your schema tables
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
})