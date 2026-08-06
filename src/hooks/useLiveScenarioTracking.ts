// loadforge/src/hooks/useLiveScenarioTracking.ts
import { useEffect, useState } from "react";
import { api } from "~/trpc/react";

export interface ScenarioProgress {
  samples: number;
  success: number;
  errors: number;
  error_rate: number;
  avg_latency_ms: number | null;
  p95_latency_ms_rolling: number | null;
  throughput_per_sec: number;
  elapsed_seconds: number;
}

export interface ScenarioLabelMetric {
  total_requests: number;
  successful_requests: number;
  average_time: number | null;
  success_rate: number;
  percentiles: Record<string, number>;
  errors: Array<{ status_code: string; error: string; count: number }>;
  sample_url: string;
}

export interface ScenarioFinalMetrics {
  run_id: string;
  mode: "functional" | "load";
  summary: {
    total_samples: number;
    success_count: number;
    error_count: number;
    error_rate: number;
    avg_latency_ms: number | null;
    percentiles: Record<string, number>;
    throughput_per_sec: number;
    duration_seconds: number;
  };
  per_label_metrics: Record<string, ScenarioLabelMetric>;
}

export interface ScenarioEvent {
  type:
    | "scenario_started"
    | "scenario_progress"
    | "scenario_completed"
    | "error"
    | "connected";
  data: any;
}

export interface LiveScenarioData {
  test_id: string;
  name: string;
  status: "running" | "completed" | "failed";
  mode: "functional" | "load" | null;
  progress: ScenarioProgress | null;
  finalMetrics: ScenarioFinalMetrics | null;
  startTime: Date;
  error: string | null;
}

export function useLiveScenarioTracking() {
  const [isConnected, setIsConnected] = useState(false);
  const [scenarios, setScenarios] = useState<Map<string, LiveScenarioData>>(new Map());
  const [error, setError] = useState<string | null>(null);

  // Bootstrap running scenarios from DB so refreshing the live page doesn't lose them.
  const runningQuery = api.test.getRunningScenarios.useQuery();

  useEffect(() => {
    const rows = runningQuery.data;
    if (!rows || rows.length === 0) return;
    setScenarios((prev) => {
      const next = new Map(prev);
      for (const row of rows) {
        if (next.has(row.id)) continue;
        next.set(row.id, {
          test_id: row.id,
          name: row.name ?? "",
          status: (row.status as LiveScenarioData["status"]) ?? "running",
          mode: (row.mode as LiveScenarioData["mode"]) ?? null,
          progress: null,
          finalMetrics: null,
          startTime: new Date(row.createdAt ?? Date.now()),
          error: null,
        });
      }
      return next;
    });
  }, [runningQuery.data]);

  api.test.onProgress.useSubscription(undefined, {
    onStarted() {
      setIsConnected(true);
    },
    onData(trackedData) {
      const event = trackedData.data as ScenarioEvent;

      if (event.type === "scenario_started") {
        const runId = event.data.run_id;
        if (!runId) return;
        setScenarios((prev) => {
          const next = new Map(prev);
          const existing = next.get(runId);
          next.set(runId, {
            test_id: runId,
            name: existing?.name ?? "",
            status: "running",
            mode: event.data.mode ?? null,
            progress: null,
            finalMetrics: null,
            startTime: existing?.startTime ?? new Date(),
            error: null,
          });
          return next;
        });
      } else if (event.type === "scenario_progress") {
        const runId = event.data.run_id;
        if (!runId) return;
        setScenarios((prev) => {
          const next = new Map(prev);
          const existing = next.get(runId);
          const progress: ScenarioProgress = {
            samples: event.data.samples ?? 0,
            success: event.data.success ?? 0,
            errors: event.data.errors ?? 0,
            error_rate: event.data.error_rate ?? 0,
            avg_latency_ms: event.data.avg_latency_ms ?? null,
            p95_latency_ms_rolling: event.data.p95_latency_ms_rolling ?? null,
            throughput_per_sec: event.data.throughput_per_sec ?? 0,
            elapsed_seconds: event.data.elapsed_seconds ?? 0,
          };
          if (existing) {
            next.set(runId, { ...existing, status: "running", progress });
          } else {
            next.set(runId, {
              test_id: runId,
              name: "",
              status: "running",
              mode: null,
              progress,
              finalMetrics: null,
              startTime: new Date(),
              error: null,
            });
          }
          return next;
        });
      } else if (event.type === "scenario_completed") {
        const runId = event.data.run_id;
        if (!runId) return;
        const finalMetrics: ScenarioFinalMetrics = {
          run_id: runId,
          mode: event.data.mode,
          summary: event.data.summary,
          per_label_metrics: event.data.per_label_metrics ?? {},
        };
        setScenarios((prev) => {
          const next = new Map(prev);
          const existing = next.get(runId);
          if (existing) {
            next.set(runId, {
              ...existing,
              status: "completed",
              finalMetrics,
            });
          }
          return next;
        });
      } else if (event.type === "error") {
        const runId = event.data?.run_id;
        const message = event.data?.error || event.data?.reason || "Unknown error";
        if (runId) {
          setScenarios((prev) => {
            const next = new Map(prev);
            const existing = next.get(runId);
            if (existing) {
              next.set(runId, {
                ...existing,
                status: "failed",
                error: message,
              });
            }
            return next;
          });
        } else {
          setError(message);
        }
      }
    },
    onError(err) {
      setIsConnected(false);
      setError(err.message || "Subscription error");
    },
  });

  return { isConnected, scenarios, error };
}
