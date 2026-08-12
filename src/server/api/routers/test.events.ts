import { subscribe } from "../../socket/eventbus";
import { tracked } from "@trpc/server";
import { getSocket } from "../../socket/engine.socket";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import { z } from "zod";
import { completeTests, testPhases, testResults } from "../../db/schema";
import { v4 as uuidv4 } from "uuid";
import { eq, inArray, and } from "drizzle-orm";

export const testsRouter = createTRPCRouter({
  getRunningTests: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id
    const tests = await ctx.db
      .select({
        id: completeTests.id,
        name: completeTests.name,
        status: completeTests.status,
        created_at: completeTests.created_at,
      })
      .from(completeTests)
      .where(
        and(
          eq(completeTests.status, "running"),
          eq(completeTests.user_id, userId),
          // URL/CSV ramp tests only. Scenario rows have their own page
          // and their own /live/scenario bootstrap query.
          eq(completeTests.type, "url"),
        ),
      )
      .limit(50);

    return tests.map((t) => ({
      id: t.id,
      name: t.name,
      status: t.status,
      createdAt: t.created_at?.toISOString?.() ?? null,
    }));
  }),
  getLatestPhases: protectedProcedure.input(z.object({ testIds: z.array(z.string()) })).query(async ({ ctx, input }) => {
      if (input.testIds.length === 0) return [];

      // Get all phases for the requested tests
      const phases = await ctx.db
        .select()
        .from(testPhases)
        .where(inArray(testPhases.test_id, input.testIds));

      // Get the latest phase for each test
      const latestPhases = new Map<string, typeof testPhases.$inferSelect>();
      for (const phase of phases) {
        const existing = latestPhases.get(phase.test_id);
        if (!existing || phase.phase_number > existing.phase_number) {
          latestPhases.set(phase.test_id, phase);
        }
      }

      return Array.from(latestPhases.values()).map((phase) => ({
        test_id: phase.test_id,
        phase: phase.phase_number,
        total_phases: phase.total_phases,
        concurrency: phase.concurrency,
        requests: phase.requests,
        success_count: phase.success_count,
        error_count: phase.error_count,
        percentiles: phase.percentile as { p50: number; p95: number; p99: number },
      }));
    }),
  startTest: protectedProcedure.input(
      z.object({
        urls: z.array(z.string().url()),
        concurrency: z.array(z.number().positive()),
        phase_length: z.number().positive(),
        ramp_up_time: z.number().min(0),
        ramp_down_time: z.number().min(0),
        hold_duration: z.number().min(0),
        total_duration: z.number().positive(),
        name: z.string().optional(),
      })
    ).mutation(async ({ input, ctx }) => {
      const socket = getSocket();
      const userId = ctx.user.id;

      if (!socket.connected) {
        throw new Error(
          "Socket not connected. Please ensure the backend is running."
        );
      }
      console.log(
        "🔌 [MUTATION] Socket ID:",
        socket.id,
        "Connected:",
        socket.connected
      );
      const id = uuidv4();

      try {
        await ctx.db.insert(completeTests).values({
          id: id.toString(),
          user_id: userId,
          name: input.name || "Load test for now",
          urls: input.urls,
          concurrency_pattern: input.concurrency,
          duration: input.total_duration,
          ramp_up_time: input.ramp_up_time,
          ramp_down_time: input.ramp_down_time,
          status: "running",
        });

        socket.emit("start_test", {
          urls: input.urls,
          concurrency: input.concurrency,
          phase_length: input.phase_length,
          test_id: id,
          user_id: userId,
        });

        return {
          status: "Test Started",
          test_id: id,
        };
      } catch (error) {
        console.log("Failed to start test");
        throw new Error(
          "Failed to start test. Please check db connection or socket connection"
        );
      }

      return { status: "Test started" };
    }),
  startScenario: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        file_id: z.string().min(1),
        jmx_filename: z.string().optional(),
        mode: z.enum(["functional", "load"]),
        users: z.number().int().positive().optional(),
        rampup: z.number().int().nonnegative().optional(),
        duration: z.number().int().positive().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const socket = getSocket();
      const userId = ctx.user.id;

      if (!socket.connected) {
        throw new Error(
          "Socket not connected. Please ensure the backend is running.",
        );
      }

      const id = uuidv4();
      const users = input.mode === "functional" ? 1 : input.users ?? 5;
      const rampup = input.mode === "functional" ? 1 : input.rampup ?? 5;
      const duration = input.mode === "functional" ? 0 : input.duration ?? 60;

      try {
        await ctx.db.insert(completeTests).values({
          id,
          user_id: userId,
          name: input.name,
          type: "scenario",
          mode: input.mode,
          users,
          ramp_up_time: rampup,
          duration,
          file_id: input.file_id,
          jmx_filename: input.jmx_filename ?? null,
          status: "running",
        });

        socket.emit("start_scenario", {
          file_id: input.file_id,
          mode: input.mode,
          users,
          rampup,
          duration,
          test_id: id,
          user_id: userId,
        });

        return { status: "Scenario started", test_id: id };
      } catch (error) {
        console.log("Failed to start scenario:", error);
        throw new Error(
          "Failed to start scenario. Please check db connection or socket connection",
        );
      }
    }),
  getRunningScenarios: protectedProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: completeTests.id,
        name: completeTests.name,
        status: completeTests.status,
        mode: completeTests.mode,
        created_at: completeTests.created_at,
      })
      .from(completeTests)
      .where(
        and(
          eq(completeTests.type, "scenario"),
          eq(completeTests.status, "running"),
          eq(completeTests.user_id, ctx.user.id),
        ),
      )
      .limit(50);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      mode: r.mode,
      createdAt: r.created_at?.toISOString?.() ?? null,
    }));
  }),
  getScenarioMetrics: protectedProcedure
    .input(z.object({ testId: z.string() }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.db
        .select({
          id: completeTests.id,
          name: completeTests.name,
          status: completeTests.status,
          mode: completeTests.mode,
          scenario_metrics: completeTests.scenario_metrics,
          created_at: completeTests.created_at,
          completed_at: completeTests.completed_at,
        })
        .from(completeTests)
        .where(
          and(
            eq(completeTests.id, input.testId),
            eq(completeTests.user_id, ctx.user.id),
          ),
        )
        .limit(1);
      return row[0] ?? null;
    }),
  onProgress: publicProcedure.subscription(async function* (opts) {
    console.log("🔌 [TRPC] Client subscribed to events");

    // Create a promise-based queue
    let pendingResolve: ((value: any) => void) | null = null;
    const queue: any[] = [];

    const unsubscribe = subscribe((event) => {
      // If someone is waiting, resolve immediately
      if (pendingResolve) {
        console.log("📤 [TRPC] Resolving pending promise with event");
        pendingResolve(event);
        pendingResolve = null;
      } else {
        // Otherwise add to queue
        console.log(
          "📦 [TRPC] Adding to queue, queue length:",
          queue.length + 1
        );
        queue.push(event);
      }
    });

    console.log("✅ [TRPC] Event listener registered");

    try {
      while (!opts.signal?.aborted) {
        // Get event from queue or wait for next one
        let event: any;

        if (queue.length > 0) {
          event = queue.shift()!;
          console.log(
            "📤 [TRPC] Got event from queue, remaining:",
            queue.length
          );
        } else {
          console.log("⏳ [TRPC] Waiting for next event...");
          event = await new Promise<any>((resolve) => {
            pendingResolve = resolve;

            // Handle abort while waiting
            if (opts.signal?.aborted) {
              resolve(null);
            }
          });
        }

        if (!event || opts.signal?.aborted) {
          console.log("🛑 [TRPC] Stopping subscription");
          break;
        }

        const eventId = event.id || `${event.type}-${Date.now()}`;
        console.log("✅ [TRPC] Yielding event to client:", eventId);
        yield tracked(eventId, event);
      }
    } finally {
      unsubscribe();
      console.log("🔌 [TRPC] Unsubscribed from event bus");
    }
  }),
  getTestName: publicProcedure
    .input(z.object({ testId: z.string() }))
    .query(async ({ ctx, input }) => {
      const test = await ctx.db
        .select({
          id: completeTests.id,
          name: completeTests.name,
          status: completeTests.status,
        })
        .from(completeTests)
        .where(eq(completeTests.id, input.testId))
        .limit(1);
      return test[0] ? { name: test[0].name, status: test[0].status } : null;
    }),
});
