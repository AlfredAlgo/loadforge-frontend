import { subscribe } from "./eventbus";
import { db } from "../db/index";
import { completeTests } from "../db/schema";
import { eq } from "drizzle-orm";

export const onScenarioComplete = () => {
  return subscribe(async (event) => {
    if (event.type !== "scenario_completed") return;

    const data = event.data ?? {};
    const runId = data.run_id;
    if (!runId) {
      console.error("❌ [DB] scenario_completed missing run_id");
      return;
    }

    try {
      const metrics = {
        run_id: runId,
        mode: data.mode,
        summary: data.summary,
        per_label_metrics: data.per_label_metrics,
      };
      await db
        .update(completeTests)
        .set({
          status: "completed",
          completed_at: new Date(),
          scenario_metrics: metrics,
        })
        .where(eq(completeTests.id, runId));
      console.log(`✅ [DB] Scenario ${runId} metrics persisted`);
    } catch (error: any) {
      console.error("❌ [DB] Failed to persist scenario metrics:", {
        run_id: runId,
        message: error?.message,
        code: error?.code,
      });
    }
  });
};

export const onScenarioFailed = () => {
  return subscribe(async (event) => {
    if (event.type !== "error") return;
    const data = event.data ?? {};
    const runId = data.run_id;
    if (!runId) return; // not a scenario error
    try {
      await db
        .update(completeTests)
        .set({
          status: "failed",
          completed_at: new Date(),
        })
        .where(eq(completeTests.id, runId));
      console.log(`⚠️  [DB] Scenario ${runId} marked failed`);
    } catch (error: any) {
      console.error("❌ [DB] Failed to mark scenario failed:", error?.message);
    }
  });
};
