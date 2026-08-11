"use client";

import { useParams } from "next/navigation";
import { DashboardNav } from "~/components/dashboard-nav";
import { ScenarioResultsView } from "~/components/scenario-results-view";
import { api } from "~/trpc/react";
import type { ScenarioFinalMetrics } from "~/hooks/useLiveScenarioTracking";

export default function ScenarioResultsPage() {
  const params = useParams();
  const testId = params.testId as string;

  const { data, isLoading, isError } = api.test.getScenarioMetrics.useQuery(
    { testId },
    { enabled: !!testId },
  );

  if (!testId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl text-red-600">Missing test ID.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <DashboardNav />
        <div className="mx-auto max-w-5xl px-4 py-8 text-gray-700">Loading…</div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen">
        <DashboardNav />
        <div className="mx-auto max-w-5xl px-4 py-8 text-red-600">
          Could not load scenario results for ID <code>{testId}</code>.
        </div>
      </div>
    );
  }

  const metrics = data.scenario_metrics as ScenarioFinalMetrics | null;

  return (
    <div className="min-h-screen">
      <DashboardNav />
      {metrics ? (
        <ScenarioResultsView
          name={data.name ?? ""}
          status={data.status ?? "unknown"}
          mode={data.mode ?? null}
          metrics={metrics}
        />
      ) : (
        <div className="mx-auto max-w-5xl px-4 py-8 text-gray-700">
          Scenario <strong>{data.name ?? testId}</strong> is currently{" "}
          <em>{data.status}</em>. Final metrics will appear here once it completes.
        </div>
      )}
    </div>
  );
}
