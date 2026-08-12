"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import type {
  ScenarioFinalMetrics,
  ScenarioLabelMetric,
} from "~/hooks/useLiveScenarioTracking";

function ms(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value)} ms`;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function ScenarioResultsView({
  name,
  status,
  mode,
  metrics,
}: {
  name: string;
  status: string;
  mode: string | null;
  metrics: ScenarioFinalMetrics;
}) {
  const summary = metrics.summary ?? {};
  const perLabel: Record<string, ScenarioLabelMetric> =
    metrics.per_label_metrics ?? {};

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{name || "Scenario result"}</h1>
          <p className="mt-1 text-sm text-gray-600">Final metrics for this scenario run.</p>
        </div>
        <div className="flex items-center gap-2">
          {mode && <Badge variant="outline">{mode}</Badge>}
          <Badge>{status}</Badge>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Total samples" value={(summary.total_samples ?? 0).toLocaleString()} />
            <Stat
              label="Error rate"
              value={pct(summary.error_rate ?? 0)}
              accent={(summary.error_rate ?? 0) > 0 ? "danger" : "ok"}
            />
            <Stat label="Avg latency" value={ms(summary.avg_latency_ms)} />
            <Stat label="Throughput" value={`${(summary.throughput_per_sec ?? 0).toFixed(1)}/s`} />
            <Stat label="p50" value={ms(summary.percentiles?.p50)} />
            <Stat label="p95" value={ms(summary.percentiles?.p95)} />
            <Stat label="p99" value={ms(summary.percentiles?.p99)} />
            <Stat label="Duration" value={`${(summary.duration_seconds ?? 0).toFixed(1)}s`} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Per step</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="py-2 pr-4">Step</th>
                  <th className="py-2 pr-4">Samples</th>
                  <th className="py-2 pr-4">Success</th>
                  <th className="py-2 pr-4">Avg (ms)</th>
                  <th className="py-2 pr-4">p95 (ms)</th>
                  <th className="py-2 pr-4">Errors</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(perLabel).map(([label, m]) => (
                  <tr key={label} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-mono text-xs">{label}</td>
                    <td className="py-2 pr-4">{m.total_requests}</td>
                    <td className="py-2 pr-4">{m.success_rate.toFixed(1)}%</td>
                    <td className="py-2 pr-4">{m.average_time !== null ? Math.round(m.average_time) : "—"}</td>
                    <td className="py-2 pr-4">{m.percentiles?.p95 ? Math.round(m.percentiles.p95) : "—"}</td>
                    <td className="py-2 pr-4">
                      {m.errors.length === 0 ? (
                        <span className="text-gray-400">none</span>
                      ) : (
                        <span className="text-red-600">
                          {m.errors.reduce((sum, e) => sum + e.count, 0)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "ok" | "danger";
}) {
  const color =
    accent === "danger"
      ? "text-red-600"
      : accent === "ok"
        ? "text-green-600"
        : "text-gray-900";
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold ${color}`}>{value}</div>
    </div>
  );
}
