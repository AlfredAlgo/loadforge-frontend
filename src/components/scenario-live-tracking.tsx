"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { useLiveScenarioTracking } from "~/hooks/useLiveScenarioTracking";
import { Activity, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";

function formatMs(value: number | null): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value)} ms`;
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function ScenarioLiveTracking() {
  const { isConnected, scenarios, error } = useLiveScenarioTracking();
  const items = Array.from(scenarios.values()).sort(
    (a, b) => b.startTime.getTime() - a.startTime.getTime(),
  );

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Live scenarios</h1>
          <p className="mt-1 text-sm text-gray-600">
            Streaming JMeter samples from the backend as they're written.
          </p>
        </div>
        <Badge variant={isConnected ? "default" : "secondary"}>
          {isConnected ? "Connected" : "Disconnected"}
        </Badge>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {items.length === 0 && (
        <div className="rounded-md border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">
          No live scenarios yet. Start one from the{" "}
          <Link href="/test" className="text-blue-600 underline">
            scenario page
          </Link>
          .
        </div>
      )}

      <div className="space-y-4">
        {items.map((s) => (
          <Card key={s.test_id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  {s.status === "running" && <Loader2 className="h-5 w-5 animate-spin text-blue-500" />}
                  {s.status === "completed" && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                  {s.status === "failed" && <XCircle className="h-5 w-5 text-red-500" />}
                  {s.name || s.test_id}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {s.mode && <Badge variant="outline">{s.mode}</Badge>}
                  <Badge>{s.status}</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {s.progress ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <Stat label="Samples" value={s.progress.samples.toLocaleString()} />
                  <Stat
                    label="Error rate"
                    value={formatPct(s.progress.error_rate)}
                    accent={s.progress.error_rate > 0 ? "danger" : "ok"}
                  />
                  <Stat label="Throughput" value={`${s.progress.throughput_per_sec.toFixed(1)}/s`} />
                  <Stat label="p95 (rolling)" value={formatMs(s.progress.p95_latency_ms_rolling)} />
                  <Stat label="Avg latency" value={formatMs(s.progress.avg_latency_ms)} />
                  <Stat label="Success" value={s.progress.success.toLocaleString()} />
                  <Stat label="Errors" value={s.progress.errors.toLocaleString()} />
                  <Stat label="Elapsed" value={`${Math.round(s.progress.elapsed_seconds)}s`} />
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Activity className="h-4 w-4" />
                  Waiting for first samples…
                </div>
              )}

              {s.status === "completed" && s.finalMetrics && (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-gray-700">Final summary</div>
                    <Link
                      href={`/results/scenario/${s.test_id}`}
                      className="text-xs text-blue-600 underline"
                    >
                      Permanent results page →
                    </Link>
                  </div>
                  <div>
                    <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <Stat label="Total samples" value={s.finalMetrics.summary.total_samples.toLocaleString()} />
                      <Stat
                        label="Error rate"
                        value={formatPct(s.finalMetrics.summary.error_rate)}
                        accent={s.finalMetrics.summary.error_rate > 0 ? "danger" : "ok"}
                      />
                      <Stat label="Avg latency" value={formatMs(s.finalMetrics.summary.avg_latency_ms)} />
                      <Stat label="Throughput" value={`${s.finalMetrics.summary.throughput_per_sec.toFixed(1)}/s`} />
                      <Stat label="p50" value={formatMs(s.finalMetrics.summary.percentiles?.p50 ?? null)} />
                      <Stat label="p95" value={formatMs(s.finalMetrics.summary.percentiles?.p95 ?? null)} />
                      <Stat label="p99" value={formatMs(s.finalMetrics.summary.percentiles?.p99 ?? null)} />
                      <Stat label="Duration" value={`${s.finalMetrics.summary.duration_seconds.toFixed(1)}s`} />
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-700">Per step</div>
                    <div className="mt-2 overflow-x-auto">
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
                          {Object.entries(s.finalMetrics.per_label_metrics).map(([label, m]) => (
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
                  </div>
                </div>
              )}
              {s.error && (
                <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {s.error}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
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
