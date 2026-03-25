// loadforge/src/hooks/useLiveTestTracking.ts
import { useState, useEffect } from "react";
import { api } from "~/trpc/react";

export interface TestProgress {
  phase: number;
  total_phases: number;
  concurrency: number;
  requests: number;
  success_count: number;
  error_count: number;
  percentiles: { p50: number; p95: number; p99: number };
  test_id?: string;
}

export interface TestEvent {
  type:
    | "test_started"
    | "phase_complete"
    | "test_completed"
    | "error"
    | "connected";
  data: any;
}

export interface LiveTestData {
  test_id: string;
  name: string;
  status: "running" | "completed" | "failed";
  currentPhase: TestProgress | null;
  startTime: Date;
  error: string | null;
}

export function useLiveTestTracking() {
  const [isConnected, setIsConnected] = useState(false);
  const [tests, setTests] = useState<Map<string, LiveTestData>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const utils = api.useUtils();

  // Bootstrap from DB so the UI doesn't depend on catching websocket events
  const runningTestsQuery = api.test.getRunningTests.useQuery();
  
  // Get the latest phases for running tests to restore state on refresh
  const testIds = runningTestsQuery.data?.map((t) => t.id) ?? [];
  const latestPhasesQuery = api.test.getLatestPhases.useQuery(
    { testIds },
    { enabled: testIds.length > 0 }
  );

  useEffect(() => {
    const rows = runningTestsQuery.data;
    if (!rows || rows.length === 0) return;

    rows.sort(
    (a, b) =>
      new Date(b.createdAt ?? 0).getTime() -
      new Date(a.createdAt ?? 0).getTime()
  );

    setTests((prev) => {
      const next = new Map(prev);
      for (const row of rows) {
        const existing = next.get(row.id);
        // Find the latest phase for this test from the database
        const latestPhase = latestPhasesQuery.data?.find(
          (phase) => phase.test_id === row.id
        );
        
        next.set(row.id, {
          test_id: row.id,
          name: row.name ?? existing?.name ?? "",
          status: (row.status as LiveTestData["status"]) ?? existing?.status ?? "running",
          // Use the phase from DB if available and there's no existing phase from websocket
          currentPhase: existing?.currentPhase ?? (latestPhase ? {
            phase: latestPhase.phase,
            total_phases: latestPhase.total_phases,
            concurrency: latestPhase.concurrency,
            requests: latestPhase.requests,
            success_count: latestPhase.success_count,
            error_count: latestPhase.error_count,
            percentiles: latestPhase.percentiles,
            test_id: row.id,
          } : null),
          startTime: existing?.startTime ?? new Date(row.createdAt ?? Date.now()),
          error: existing?.error ?? null,
        });
      }
      return next;
    });
  }, [runningTestsQuery.data, latestPhasesQuery.data]);

  // Function to fetch test name
  const fetchTestName = async (testId: string) => {
    try {
      const result = await utils.test.getTestName.fetch({ testId });
      if (result?.name) {
        setTests((prev) => {
          const newMap = new Map(prev);
          const existing = newMap.get(testId);
          if (existing) {
            newMap.set(testId, {
              ...existing,
              name: result.name,
            });
          }
          return newMap;
        });
      }
    } catch (err) {
      console.error("Failed to fetch test name:", err);
    }
  };

  api.test.onProgress.useSubscription(undefined, {
    onStarted() {
      console.log("🔌 [CLIENT] Subscription started");
      setIsConnected(true);
    },
    onData(trackedData) {
      const data = trackedData.data as TestEvent;

      if (data.type === "test_started") {
        const testId = data.data.test_id;
        if (testId) {
          setTests((prev) => {
            const newMap = new Map(prev);
            newMap.set(testId, {
              test_id: testId,
              name: "", // Will be fetched
              status: "running",
              currentPhase: null,
              startTime: new Date(),
              error: null,
            });
            return newMap;
          });
          fetchTestName(testId);
          setError(null);
        }
      } else if (data.type === "phase_complete") {
        const testId = data.data.test_id;
        if (testId) {
          setTests((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(testId);
            if (existing) {
              newMap.set(testId, {
                ...existing,
                status: "running",
                currentPhase: {
                  ...data.data,
                  test_id: testId,
                },
              });
            } else {
              // If test doesn't exist yet, create it
              newMap.set(testId, {
                test_id: testId,
                name: "",
                status: "running",
                currentPhase: {
                  ...data.data,
                  test_id: testId,
                },
                startTime: new Date(),
                error: null,
              });
              fetchTestName(testId);
            }
            return newMap;
          });
        }
      } else if (data.type === "test_completed") {
        const testId = data.data.test_id;
        if (testId) {
          setTests((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(testId);
            if (existing) {
              newMap.set(testId, {
                ...existing,
                status: "completed",
                currentPhase: null,
              });
            }
            return newMap;
          });
        }
      } else if (data.type === "error") {
        const testId = data.data.test_id;
        const errorMessage = data.data.error || "An unknown error occurred";
        if (testId) {
          setTests((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(testId);
            if (existing) {
              newMap.set(testId, {
                ...existing,
                status: "failed",
                error: errorMessage,
              });
            }
            return newMap;
          });
        } else {
          setError(errorMessage);
        }
      }
    },
    onError(err) {
      console.error("❌ [CLIENT] Subscription error:", err);
      setIsConnected(false);
      setError(err.message || "An unknown error occurred");
    },
  });

  // Convert Map to array for easier consumption
  const testsArray = Array.from(tests.values());
  const runningTests = testsArray.filter((t) => t.status === "running");
  runningTests.reverse()
  const isTestRunning = runningTests.length > 0;

  return {
    isConnected,
    isTestRunning,
    tests: testsArray,
    runningTests,
    error,
  };
}
