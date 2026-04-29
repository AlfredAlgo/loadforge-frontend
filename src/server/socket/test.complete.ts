import { subscribe } from "./eventbus";
import { db } from "../db/index";
import { completeTests, testResults } from "../db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getAccumulatedErrors, clearUrlMetrics } from "./url-metrics-store";


// Helper function to convert seconds to milliseconds and round to integer
function secondsToMs(seconds: number): number {
  return Math.round(seconds * 1000);
}
export const onTestComplete = () => {
 
  return subscribe(async (event) => {
    if (event.type !== "test_completed") return;

    console.log("💾 [DB] Test completed event received");

    const testData = event.data;

    // Validate test_id exists
    if (!testData.test_id) {
      console.error("❌ [DB] test_id is missing from test_completed event");
      return;
    }

    try {
      const phaseSummaries = testData.phase_summaries || [];
      console.log(
        `📊 [DB] Processing ${phaseSummaries.length} phase summaries`
      );

      const totalRequests = testData.total_requests || 0;
      const successfulRequests = testData.success_count || 0;
      const failedRequests = testData.error_count || 0;
      const userId = testData.user_id || "unknown_user";

      const allPercentiles = phaseSummaries
        .map((p: any) => p.percentiles || {})
        .filter((p: any) => Object.keys(p).length > 0);

      // Convert percentiles from seconds to milliseconds
      const avgP50 =
        allPercentiles.length > 0
          ? secondsToMs(
              allPercentiles.reduce(
                (sum: number, p: any) => sum + (p.p50 || 0),
                0
              ) / allPercentiles.length
            )
          : 0;
      const avgP95 =
        allPercentiles.length > 0
          ? secondsToMs(
              allPercentiles.reduce(
                (sum: number, p: any) => sum + (p.p95 || 0),
                0
              ) / allPercentiles.length
            )
          : 0;
      const avgP99 =
        allPercentiles.length > 0
          ? secondsToMs(
              allPercentiles.reduce(
                (sum: number, p: any) => sum + (p.p99 || 0),
                0
              ) / allPercentiles.length
            )
          : 0;

      // Extract all response times and convert from seconds to milliseconds
      const allResponseTimes = phaseSummaries
        .flatMap((p: any) =>
          p.percentiles
            ? [p.percentiles.p50, p.percentiles.p95, p.percentiles.p99].filter(
                (t: any) => t != null
              )
            : []
        )
        .map((seconds: number) => secondsToMs(seconds));

      const minResponseTime =
        allResponseTimes.length > 0 ? Math.min(...allResponseTimes) : 0;
      const maxResponseTime =
        allResponseTimes.length > 0 ? Math.max(...allResponseTimes) : 0;
      const avgResponseTime = avgP50; // Use P50 as average

      // Calculate requests per second
      const phaseLength = phaseSummaries[0]?.phase_length || 60;
      const totalDuration = phaseSummaries.length * phaseLength;
      const requestsPerSecond =
        totalDuration > 0 ? Math.round(totalRequests / totalDuration) : 0;

      console.log(
        `🔄 [DB] Updating test status for test_id: ${testData.test_id}`
      );

      // Update test status
      await db
        .update(completeTests)
        .set({
          status: "completed",
          completed_at: new Date(),
        })
        .where(eq(completeTests.id, testData.test_id));

      console.log(`✅ [DB] Test status updated`);

      // Calculate URL breakdown from backend per_url_metrics.
      // Merge with phase-accumulated errors as a fallback — the test_completed
      // event sometimes omits the errors field even when phases had failures.
      const urlBreakdown: Record<string, any> = {};
      const perUrlMetrics = testData.per_url_metrics || {};
      const accumulatedErrors = getAccumulatedErrors(testData.test_id);

      console.log(`🔍 [TEST COMPLETE] per_url_metrics URLs: ${Object.keys(perUrlMetrics).length}`)
      console.log(`🔍 [TEST COMPLETE] accumulated errors keys: ${Object.keys(accumulatedErrors).length}`)
      for (const [url, m] of Object.entries(perUrlMetrics)) {
        const evtErrors = Array.isArray((m as any).errors) ? (m as any).errors : []
        const phaseErrors = accumulatedErrors[url] ?? []
        console.log(`🔍 [URL] ${url} — event errors: ${evtErrors.length}, phase-accumulated errors: ${phaseErrors.length}`)
        if (evtErrors.length > 0) console.log(`   event sample:`, JSON.stringify(evtErrors[0]))
        if (phaseErrors.length > 0) console.log(`   phase sample:`, JSON.stringify(phaseErrors[0]))
      }

      for (const [url, metrics] of Object.entries(perUrlMetrics)) {
        const urlMetric = metrics as any;

        const errorsFromEvent: any[] = Array.isArray(urlMetric.errors) ? urlMetric.errors : [];
        const errorsFromPhases = accumulatedErrors[url] ?? [];

        // Prefer errors from the event if present; fall back to phase-accumulated errors
        const rawErrors = errorsFromEvent.length > 0 ? errorsFromEvent : errorsFromPhases;

        urlBreakdown[url] = {
          url: url,
          requests: urlMetric.total_requests || 0,
          avgResponseTime: Math.round((urlMetric.average_time || 0) * 1000),
          successRate: Number((urlMetric.success_rate || 0).toFixed(1)),
          errors: rawErrors.map((e: any) => ({
            statusCode: e.status_code,
            message: e.error,
            count: e.count ?? 1,
          })),
        };
      }

      // Free accumulated phase data for this test
      clearUrlMetrics(testData.test_id);

      // Prepare phase metrics
      const phaseMetrics = {
        rampUp: phaseSummaries[0] || {},
        steady:
          phaseSummaries.length > 1
            ? phaseSummaries[Math.floor(phaseSummaries.length / 2)] || {}
            : {},
        rampDown:
          phaseSummaries.length > 0
            ? phaseSummaries[phaseSummaries.length - 1] || {}
            : {},
      };

      const test_result_id = uuidv4();
      console.log(`💾 [DB] Inserting test result with ID: ${test_result_id}`);

      await db.insert(testResults).values({
        id: test_result_id.toString(),
        user_id: userId,
        test_id: testData.test_id,
        total_requests: totalRequests,
        successful_requests: successfulRequests,
        failed_requests: failedRequests,
        avg_response_time: avgResponseTime,
        min_response_time: minResponseTime,
        max_response_time: maxResponseTime,
        p50_response_time: avgP50,
        p95_response_time: avgP95,
        p99_response_time: avgP99,
        requests_per_second: requestsPerSecond,
        url_breakdown: urlBreakdown,
        phase_metrics: phaseMetrics,
      });

      console.log(
        `✅ [DB] Test result saved successfully for test_id: ${testData.test_id}`
      );
    } catch (error: any) {
      console.error("❌ [DB] Failed to save test completion data:",);
      console.error("Error details:", {
        message: error?.message,
        code: error?.code,
        constraint: error?.constraint,
        detail: error?.detail,
        test_id: testData?.test_id,
      });

      if (error?.code === "23503") {
        console.error(
          `❌ [DB] Foreign key violation - test_id '${testData.test_id}' may not exist in completeTests table`
        );
      }
    }
  });
};