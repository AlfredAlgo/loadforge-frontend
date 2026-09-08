"use client";

import { useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { AlertCircle, CheckCircle2, FileDown } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { gautengLogoB64 } from "~/lib/gauteng-logo-b64";
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

// ── SVG → PNG helper (same approach as the load-test report) ────────────────
function svgToPng(svgEl: SVGSVGElement): Promise<string> {
  return new Promise((resolve, reject) => {
    const w = svgEl.clientWidth || Number(svgEl.getAttribute("width") ?? 600);
    const h = svgEl.clientHeight || Number(svgEl.getAttribute("height") ?? 200);

    let svgStr = new XMLSerializer().serializeToString(svgEl);
    if (!svgStr.includes("xmlns="))
      svgStr = svgStr.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');

    const blob = new Blob([svgStr], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = w * 2;
      canvas.height = h * 2;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(2, 2);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("svg load failed"));
    };
    img.src = url;
  });
}

async function captureChart(ref: React.RefObject<HTMLDivElement | null>): Promise<string | null> {
  if (!ref.current) return null;
  await new Promise((r) => setTimeout(r, 150));
  try {
    const svgEl = ref.current.querySelector("svg");
    if (!svgEl) return null;
    return await svgToPng(svgEl as SVGSVGElement);
  } catch {
    return null;
  }
}

export function ScenarioResultsView({
  testId,
  name,
  status,
  mode,
  metrics,
}: {
  testId: string | null;
  name: string;
  status: string;
  mode: string | null;
  metrics: ScenarioFinalMetrics;
}) {
  const [exporting, setExporting] = useState(false);
  const pdfAvgTimeRef = useRef<HTMLDivElement>(null);
  const pdfSuccessRef = useRef<HTMLDivElement>(null);
  const pdfErrorsRef = useRef<HTMLDivElement>(null);

  const summary = metrics.summary ?? ({} as ScenarioFinalMetrics["summary"]);
  const perLabel: Record<string, ScenarioLabelMetric> =
    metrics.per_label_metrics ?? {};
  const stepEntries = Object.entries(perLabel);
  const stepsWithErrors = stepEntries.filter(([, m]) => m.errors && m.errors.length > 0);
  const isSuccess = (summary.error_rate ?? 0) === 0;

  const stepChartData = stepEntries.map(([label, m]) => ({
    step: label.length > 18 ? label.slice(0, 16) + "…" : label,
    fullLabel: label,
    avgTime: m.average_time ?? 0,
    successRate: Number((m.success_rate ?? 0).toFixed(1)),
    errors: m.errors?.reduce((sum, e) => sum + e.count, 0) ?? 0,
  }));

  // ─── PDF Export ─────────────────────────────────────────────────────────
  const exportToPDF = async () => {
    setExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = 210;

      const navy: [number, number, number] = [27, 58, 107];
      const gold: [number, number, number] = [200, 162, 50];
      const charcoal: [number, number, number] = [44, 44, 44];
      const rowAlt: [number, number, number] = [245, 247, 250];
      const white: [number, number, number] = [255, 255, 255];

      const [avgTimeImg, successImg, errorsImg] = await Promise.all([
        captureChart(pdfAvgTimeRef),
        captureChart(pdfSuccessRef),
        captureChart(pdfErrorsRef),
      ]);

      const sectionHeading = (text: string, y: number) => {
        doc.setTextColor(...navy);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(text, 14, y);
        doc.setDrawColor(...gold);
        doc.setLineWidth(0.6);
        doc.line(14, y + 1.5, pageW - 14, y + 1.5);
        doc.setTextColor(...charcoal);
      };

      const pageBand = (title: string) => {
        doc.setFillColor(...navy);
        doc.rect(0, 0, pageW, 12, "F");
        doc.setFillColor(...gold);
        doc.rect(0, 12, pageW, 1, "F");
        doc.setTextColor(...white);
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.text(title, 14, 8.5);
        doc.setTextColor(...charcoal);
      };

      const addChart = (img: string | null, x: number, y: number, w: number, h: number, title: string) => {
        doc.setTextColor(...navy);
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(title, x, y);
        doc.setDrawColor(...gold);
        doc.setLineWidth(0.5);
        doc.line(x, y + 1.5, x + w, y + 1.5);
        if (img) {
          doc.addImage(img, "PNG", x, y + 4, w, h);
        } else {
          doc.setFontSize(7.5);
          doc.setFont("helvetica", "italic");
          doc.setTextColor(160, 160, 160);
          doc.text("Chart unavailable", x + w / 2, y + h / 2 + 4, { align: "center" });
        }
        doc.setTextColor(...charcoal);
      };

      const modeLabel = mode === "functional" ? "Functional Test" : mode === "load" ? "Scenario Load Test" : "Scenario Test";

      // ════════════════════════════ PAGE 1 — COVER + SUMMARY ════════════════
      doc.setFillColor(...navy);
      doc.rect(0, 0, pageW, 44, "F");
      doc.setFillColor(...gold);
      doc.rect(0, 44, pageW, 1.5, "F");

      doc.addImage(gautengLogoB64, "PNG", 8, 4, 54, 34);

      doc.setDrawColor(...gold);
      doc.setLineWidth(0.4);
      doc.line(70, 6, 70, 40);

      doc.setTextColor(...white);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`${modeLabel} Report`, 143, 15, { align: "center" });
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text("Gauteng Provincial Government", 143, 21, { align: "center" });
      doc.setFontSize(7);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 143, 28, { align: "center" });
      doc.text(`Test ID: ${testId ?? "N/A"}`, 143, 34, { align: "center" });
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.text(
        isSuccess ? "COMPLETED — ALL SAMPLES PASSED" : "COMPLETED — SAMPLES WITH FAILURES",
        143, 40, { align: "center" },
      );

      sectionHeading("Test Overview", 53);

      autoTable(doc, {
        startY: 57,
        head: [["Metric", "Value"]],
        body: [
          ["Test Name", name || "—"],
          ["Mode", mode ?? "—"],
          ["Total Samples", (summary.total_samples ?? 0).toLocaleString()],
          ["Successful Samples", (summary.success_count ?? 0).toLocaleString()],
          ["Failed Samples", (summary.error_count ?? 0).toLocaleString()],
          ["Error Rate", pct(summary.error_rate ?? 0)],
          ["Throughput", `${(summary.throughput_per_sec ?? 0).toFixed(1)} req/s`],
          ["Duration", `${(summary.duration_seconds ?? 0).toFixed(1)}s`],
        ],
        headStyles: { fillColor: navy, textColor: white, fontStyle: "bold", fontSize: 8 },
        bodyStyles: { fontSize: 8, textColor: charcoal },
        alternateRowStyles: { fillColor: rowAlt },
        margin: { left: 14, right: 112 },
        tableWidth: 84,
      });

      autoTable(doc, {
        startY: 57,
        head: [["Percentile", "Time (ms)"]],
        body: [
          ["Avg latency", ms(summary.avg_latency_ms)],
          ["P50 — Median", ms(summary.percentiles?.p50)],
          ["P95", ms(summary.percentiles?.p95)],
          ["P99", ms(summary.percentiles?.p99)],
        ],
        headStyles: { fillColor: navy, textColor: white, fontStyle: "bold", fontSize: 8 },
        bodyStyles: { fontSize: 8, textColor: charcoal },
        alternateRowStyles: { fillColor: rowAlt },
        margin: { left: 112, right: 14 },
        tableWidth: 84,
      });

      const afterTables = (doc as any).lastAutoTable.finalY + 10;
      addChart(avgTimeImg, 14, afterTables, 182, 65, "Average Response Time per Step (ms)");

      // ════════════════════════ PAGE 2 — PER-STEP BREAKDOWN ═════════════════
      doc.addPage();
      pageBand("Per-Step Breakdown");

      if (stepEntries.length > 0) {
        autoTable(doc, {
          startY: 17,
          head: [["Step", "Samples", "Success", "Avg (ms)", "P95 (ms)", "Errors"]],
          body: stepEntries.map(([label, m]) => [
            label.length > 40 ? label.slice(0, 37) + "…" : label,
            m.total_requests ?? 0,
            `${(m.success_rate ?? 0).toFixed(1)}%`,
            m.average_time !== null ? Math.round(m.average_time) : "—",
            m.percentiles?.p95 ? Math.round(m.percentiles.p95) : "—",
            m.errors?.reduce((sum, e) => sum + e.count, 0) ?? 0,
          ]),
          headStyles: { fillColor: navy, textColor: white, fontStyle: "bold", fontSize: 7.5 },
          bodyStyles: { fontSize: 7.5, textColor: charcoal },
          alternateRowStyles: { fillColor: rowAlt },
          margin: { left: 14, right: 14 },
        });
      }

      const chartTop = stepEntries.length > 0 ? (doc as any).lastAutoTable.finalY + 10 : 20;
      addChart(successImg, 14, chartTop, 90, 55, "Success Rate per Step (%)");
      if ((summary.error_count ?? 0) > 0) {
        addChart(errorsImg, 112, chartTop, 84, 55, "Errors per Step");
      }

      // ═══════════════════════ PAGE 3 — ERROR DETAILS ═══════════════════════
      if (stepsWithErrors.length > 0) {
        doc.addPage();
        pageBand("Error Details by Step");

        let y = 20;
        for (const [label, m] of stepsWithErrors) {
          if (y > 265) {
            doc.addPage();
            pageBand("Error Details by Step — continued");
            y = 20;
          }
          doc.setFontSize(7.5);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...charcoal);
          doc.text(label.length > 95 ? label.slice(0, 92) + "…" : label, 14, y);
          y += 4;
          autoTable(doc, {
            startY: y,
            head: [["Status Code", "Error", "Count"]],
            body: m.errors.map((e) => [e.status_code, e.error, e.count]),
            headStyles: { fillColor: [80, 80, 80] as [number, number, number], textColor: white, fontSize: 7.5 },
            bodyStyles: { fontSize: 7.5, textColor: charcoal },
            alternateRowStyles: { fillColor: rowAlt },
            margin: { left: 14, right: 14 },
          });
          y = (doc as any).lastAutoTable.finalY + 8;
        }
      }

      // ── Footer ───────────────────────────────────────────────────────────
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(...navy);
        doc.rect(0, 291, pageW, 6, "F");
        doc.setTextColor(...white);
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.text(`Page ${i} of ${pageCount}`, pageW / 2, 295.5, { align: "center" });
        if (i === pageCount) {
          doc.setTextColor(180, 180, 180);
          doc.setFontSize(6);
          doc.text("powered by AlgoAtWork", 14, 295.5);
        }
      }

      doc.save(`functional-test-report-${(testId ?? "export").slice(0, 8)}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{name || "Scenario result"}</h1>
          <p className="mt-1 text-sm text-gray-600">Final metrics for this scenario run.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={exportToPDF}
            disabled={exporting}
            variant="outline"
            className="border-purple-200 text-purple-600 hover:bg-purple-50 hover:text-purple-700"
          >
            <FileDown className="mr-2 h-4 w-4" />
            {exporting ? "Exporting…" : "Export PDF"}
          </Button>
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

      <Card className="mb-6">
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
                {stepEntries.map(([label, m]) => (
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

      {/* Error Details by Step — mirrors the load test's per-URL error breakdown,
          so a failure's kind (status code + message) is always visible, not just a count. */}
      <Card id="error-breakdown" className="scroll-mt-8">
        <CardHeader>
          <CardTitle>Error details by step</CardTitle>
          <CardDescription>What kind of error occurred on each step, and how often.</CardDescription>
        </CardHeader>
        <CardContent>
          {stepsWithErrors.length === 0 ? (
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium">No errors recorded on any step.</span>
            </div>
          ) : (
            <div className="space-y-5">
              {stepsWithErrors.map(([label, m]) => (
                <div key={label}>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-red-700">
                    <AlertCircle className="h-3.5 w-3.5" />
                    <span className="font-mono">{label}</span>
                    {m.sample_url && <span className="font-normal text-gray-500">— {m.sample_url}</span>}
                  </p>
                  <ul className="space-y-2">
                    {m.errors.map((err, i) => (
                      <li key={i} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <span className="text-xs font-semibold text-red-800">{err.status_code}</span>
                            <p className="mt-0.5 break-all text-xs text-red-700">{err.error}</p>
                          </div>
                          <Badge className="shrink-0 bg-red-100 text-xs text-red-800">
                            {err.count}× occurred
                          </Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hidden chart containers for PDF capture */}
      <div style={{ position: "fixed", left: "-9999px", top: 0, pointerEvents: "none", zIndex: -1 }}>
        <div ref={pdfAvgTimeRef} style={{ background: "white", padding: "8px", width: "680px" }}>
          <BarChart width={660} height={175} data={stepChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="step" stroke="#6b7280" tick={{ fontSize: 10 }} />
            <YAxis stroke="#6b7280" unit="ms" tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: any) => [`${v}ms`]} />
            <Legend />
            <Bar dataKey="avgTime" name="Avg response time" fill="#1B3A6B" radius={[3, 3, 0, 0]} />
          </BarChart>
        </div>

        <div ref={pdfSuccessRef} style={{ background: "white", padding: "8px", width: "360px" }}>
          <BarChart width={344} height={165} data={stepChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="step" stroke="#6b7280" tick={{ fontSize: 10 }} />
            <YAxis stroke="#6b7280" unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: any) => [`${v}%`, "Success Rate"]} />
            <Legend />
            <Bar dataKey="successRate" name="Success Rate" fill="#1B3A6B" radius={[3, 3, 0, 0]} />
          </BarChart>
        </div>

        <div ref={pdfErrorsRef} style={{ background: "white", padding: "8px", width: "380px" }}>
          <BarChart width={364} height={165} data={stepChartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="step" stroke="#6b7280" tick={{ fontSize: 10 }} />
            <YAxis stroke="#6b7280" allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="errors" name="Errors" fill="#C8A232" radius={[3, 3, 0, 0]} />
          </BarChart>
        </div>
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
