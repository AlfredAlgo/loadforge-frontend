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
      .where (and(eq(completeTests.status, "running"), eq(completeTests.user_id, userId)))
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
