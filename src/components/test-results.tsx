"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { CheckCircle2, Clock, TrendingUp, AlertCircle, ChevronDown, FileDown } from "lucide-react"

interface TestResultsProps {
  results: {
    testId: string | null;
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    avgResponseTime: number;
    minResponseTime: number;
    maxResponseTime: number;
    p50ResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    requestsPerSecond: number;
    urlBreakdown: Record<string, {
      url: string;
      requests: number;
      avgResponseTime: number;
      successRate: number;
      errors?: Array<{
        statusCode: number | string;
        message: string;
        count: number;
      }>;
    }>;
   phaseMetrics: {
  rampUp: { percentiles: { p50: number; p95: number; p99: number }; concurrency: number; requests: number; success_count: number; error_count: number; };
  steady: { percentiles: { p50: number; p95: number; p99: number }; concurrency: number; requests: number; success_count: number; error_count: number; };
  rampDown: { percentiles: { p50: number; p95: number; p99: number }; concurrency: number; requests: number; success_count: number; error_count: number; };
};
  };
   phases: Array<{
    phase: number;
    concurrency: number;
    requests: number;
    successCount: number;
    errorCount: number;
    percentiles: { p50: number; p95: number; p99: number };
    successRate: number;
  }>;
}
export const  TestResults: React.FC<TestResultsProps> = ({ results, phases }) => {
  const [activeMetric, setActiveMetric] = useState<string | null>(null)
  const [expandedUrls, setExpandedUrls] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)

  const overallSuccessRate = results.totalRequests
    ? (results.successfulRequests / results.totalRequests) * 100
    : 0;
  const isSuccess = overallSuccessRate >= 99;

  const toggleUrl = (url: string) => {
    setExpandedUrls(prev => {
      const next = new Set(prev)
      next.has(url) ? next.delete(url) : next.add(url)
      return next
    })
  }

  const exportToPDF = async () => {
    setExporting(true)
    try {
      const { jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF()

      const purple: [number, number, number] = [147, 51, 234]
      const gray: [number, number, number] = [75, 85, 99]

      // Header
      doc.setFillColor(...purple)
      doc.rect(0, 0, 210, 28, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('LoadForge Performance Report', 14, 12)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 20)
      doc.text(`Test ID: ${results.testId ?? 'N/A'}`, 14, 25)

      // Status badge
      const statusColor: [number, number, number] = isSuccess ? [22, 163, 74] : [220, 38, 38]
      doc.setFillColor(...statusColor)
      doc.roundedRect(160, 8, 36, 10, 3, 3, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text(isSuccess ? '✓ SUCCESS' : '✗ FAILED', 178, 14.5, { align: 'center' })

      // Overview metrics
      doc.setTextColor(...gray)
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('Overview', 14, 40)
      autoTable(doc, {
        startY: 44,
        head: [['Metric', 'Value']],
        body: [
          ['Total Requests', results.totalRequests.toLocaleString()],
          ['Successful Requests', results.successfulRequests.toLocaleString()],
          ['Failed Requests', results.failedRequests.toLocaleString()],
          ['Success Rate', `${overallSuccessRate.toFixed(1)}%`],
          ['Avg Response Time', `${results.avgResponseTime}ms`],
          ['Requests / Second', String(results.requestsPerSecond)],
        ],
        headStyles: { fillColor: purple },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        margin: { left: 14, right: 14 },
        tableWidth: 90,
      })

      // Response time percentiles
      const overviewEnd = (doc as any).lastAutoTable.finalY
      doc.setTextColor(...gray)
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('Response Time Percentiles', 115, 40)
      autoTable(doc, {
        startY: 44,
        head: [['Percentile', 'Time (ms)']],
        body: [
          ['Minimum', `${results.minResponseTime}ms`],
          ['P50 — Median', `${results.p50ResponseTime}ms`],
          ['P95', `${results.p95ResponseTime}ms`],
          ['P99', `${results.p99ResponseTime}ms`],
          ['Maximum', `${results.maxResponseTime}ms`],
        ],
        headStyles: { fillColor: purple },
        alternateRowStyles: { fillColor: [249, 250, 251] },
        margin: { left: 115, right: 14 },
        tableWidth: 81,
      })

      // Phase breakdown
      const afterOverview = Math.max(overviewEnd, (doc as any).lastAutoTable.finalY) + 10
      if (phases.length > 0) {
        doc.setTextColor(...gray)
        doc.setFontSize(13)
        doc.setFont('helvetica', 'bold')
        doc.text('Phase Breakdown', 14, afterOverview)
        autoTable(doc, {
          startY: afterOverview + 4,
          head: [['Phase', 'Concurrency', 'Requests', 'Success', 'Errors', 'Success Rate', 'P50', 'P95', 'P99']],
          body: phases.map(p => [
            `Phase ${p.phase}`,
            p.concurrency,
            p.requests,
            p.successCount,
            p.errorCount,
            `${p.successRate.toFixed(1)}%`,
            `${p.percentiles.p50}ms`,
            `${p.percentiles.p95}ms`,
            `${p.percentiles.p99}ms`,
          ]),
          headStyles: { fillColor: purple, fontSize: 8 },
          bodyStyles: { fontSize: 8 },
          alternateRowStyles: { fillColor: [249, 250, 251] },
          margin: { left: 14, right: 14 },
        })
      }

      // URL breakdown
      const urlEntries = Object.entries(results.urlBreakdown ?? {})
      if (urlEntries.length > 0) {
        doc.addPage()
        doc.setFillColor(...purple)
        doc.rect(0, 0, 210, 16, 'F')
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(13)
        doc.setFont('helvetica', 'bold')
        doc.text('Performance by URL', 14, 11)

        autoTable(doc, {
          startY: 22,
          head: [['URL', 'Requests', 'Avg Time', 'Success Rate']],
          body: urlEntries.map(([url, m]: any) => [
            url.length > 55 ? url.slice(0, 52) + '…' : url,
            m.requests ?? 0,
            `${m.avgResponseTime ?? 0}ms`,
            `${Number(m.successRate ?? 0).toFixed(1)}%`,
          ]),
          headStyles: { fillColor: purple },
          alternateRowStyles: { fillColor: [249, 250, 251] },
          columnStyles: { 0: { cellWidth: 90 } },
          margin: { left: 14, right: 14 },
        })

        // Error details section
        const urlsWithErrors = urlEntries.filter(([, m]: any) => Array.isArray(m.errors) && m.errors.length > 0)
        if (urlsWithErrors.length > 0) {
          let y = (doc as any).lastAutoTable.finalY + 12
          doc.setTextColor(...gray)
          doc.setFontSize(13)
          doc.setFont('helvetica', 'bold')
          doc.text('Error Details by URL', 14, y)
          y += 6

          for (const [url, m] of urlsWithErrors as any) {
            if (y > 260) { doc.addPage(); y = 20 }
            doc.setFontSize(9)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(...gray)
            doc.text(url.length > 80 ? url.slice(0, 77) + '…' : url, 14, y)
            y += 4
            autoTable(doc, {
              startY: y,
              head: [['Status Code', 'Error Message', 'Count']],
              body: (m as any).errors.map((e: any) => [e.statusCode, e.message, e.count]),
              headStyles: { fillColor: [220, 38, 38], fontSize: 8 },
              bodyStyles: { fontSize: 8 },
              margin: { left: 14, right: 14 },
            })
            y = (doc as any).lastAutoTable.finalY + 8
          }
        }
      }

      // Footer on each page
      const pageCount = doc.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFontSize(8)
        doc.setTextColor(156, 163, 175)
        doc.text(`LoadForge — Page ${i} of ${pageCount}`, 14, 290)
        doc.text('loadforge.azurewebsites.net', 196, 290, { align: 'right' })
      }

      doc.save(`loadforge-report-${(results.testId ?? 'export').slice(0, 8)}.pdf`)
    } finally {
      setExporting(false)
    }
  }

  const overviewMetrics = [
    { title: "Total Requests", value: results.totalRequests.toLocaleString(), icon: TrendingUp, color: "text-purple-600", hoverBorder: "hover:border-purple-300" },
    { title: "Avg Response Time", value: `${results.avgResponseTime}ms`, icon: Clock, color: "text-blue-600", hoverBorder: "hover:border-blue-300" },
    { title: "Success Rate", value: `${overallSuccessRate.toFixed(1)}%`, icon: CheckCircle2, color: "text-green-600", hoverBorder: "hover:border-green-300" },
    { title: "Errors", value: results.failedRequests.toLocaleString(), icon: AlertCircle, color: "text-red-600", hoverBorder: "hover:border-red-300" },
  ];

  // Data for the "Average Response Times by Phase" chart
  const performanceData = phases.length > 0 ? phases.map((phase) => ({
    phase: `Phase ${phase.phase}`,
    p50: phase.percentiles.p50, 
    p95: phase.percentiles.p95,
    p99: phase.percentiles.p99,
    concurrency: phase.concurrency,
    successRate: phase.successRate,
    requests: phase.requests,
  })) : [
 { 
  phase: "Ramp Up", 
  p50: results.phaseMetrics.rampUp.percentiles.p50, 
  p95: results.phaseMetrics.rampUp.percentiles.p95, 
  p99: results.phaseMetrics.rampUp.percentiles.p99, 
  concurrency: results.phaseMetrics.rampUp.concurrency, 
  requests: results.phaseMetrics.rampUp.requests 
},
{ 
  phase: "Steady", 
  p50: results.phaseMetrics.steady.percentiles.p50, 
  p95: results.phaseMetrics.steady.percentiles.p95, 
  p99: results.phaseMetrics.steady.percentiles.p99, 
  concurrency: results.phaseMetrics.steady.concurrency, 
  requests: results.phaseMetrics.steady.requests 
},
{ 
  phase: "Ramp Down", 
  p50: results.phaseMetrics.rampDown.percentiles.p50, 
  p95: results.phaseMetrics.rampDown.percentiles.p95, 
  p99: results.phaseMetrics.rampDown.percentiles.p99, 
  concurrency: results.phaseMetrics.rampDown.concurrency, 
  requests: results.phaseMetrics.rampDown.requests 
},
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
     <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Test Results for Test ID: {results.testId || 'N/A'}</h1>
            {/* If test name and completion time were available from the API, you'd use them here */}
            <p className="mt-1 text-sm text-gray-600">Overview of performance metrics</p>
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
            <Badge className={isSuccess ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-100 text-red-700 hover:bg-red-200"}>
              {isSuccess ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <AlertCircle className="mr-1 h-3 w-3" />}
              {isSuccess ? "Success" : "Failed"}
            </Badge>
          </div>
        </div>
      </div>

     <div className="mb-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {overviewMetrics.map((metric) => {
          const Icon = metric.icon
          const isOpen = activeMetric === metric.title
          return (
            <Card
              key={metric.title}
              onClick={() => setActiveMetric(isOpen ? null : metric.title)}
              className={`cursor-pointer border-gray-200 transition-all ${metric.hoverBorder} hover:shadow-md ${isOpen ? "ring-2 ring-offset-1 " + metric.color.replace("text-", "ring-") : ""}`}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">{metric.title}</CardTitle>
                <div className="flex items-center gap-1">
                  <Icon className={`h-4 w-4 ${metric.color}`} />
                  <ChevronDown className={`h-3 w-3 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">{metric.value}</div>
                <p className="mt-1 text-xs text-gray-400">Click to expand</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Expandable detail panel */}
      {activeMetric && (
        <div className="mb-8 rounded-xl border border-gray-200 bg-gray-50 p-6">
          {activeMetric === "Total Requests" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Requests per Phase</h3>
                <span className="text-sm text-gray-500">{results.requestsPerSecond} req/s overall</span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="text-xl font-bold text-purple-600">{results.totalRequests.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-xs text-gray-500">Successful</p>
                  <p className="text-xl font-bold text-green-600">{results.successfulRequests.toLocaleString()}</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-xs text-gray-500">Failed</p>
                  <p className="text-xl font-bold text-red-600">{results.failedRequests.toLocaleString()}</p>
                </div>
              </div>
              {phases.length > 0 && (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={phases.map(p => ({ phase: `Ph ${p.phase}`, requests: p.requests, concurrency: p.concurrency }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="phase" stroke="#6b7280" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#6b7280" />
                    <Tooltip contentStyle={{ borderRadius: 8 }} />
                    <Legend />
                    <Bar dataKey="requests" name="Requests" fill="#9333ea" radius={[4,4,0,0]} />
                    <Bar dataKey="concurrency" name="Concurrency" fill="#c4b5fd" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {activeMetric === "Avg Response Time" && (
            <div className="space-y-4">
              <h3 className="font-semibold text-gray-900">Response Time Breakdown</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  { label: "Min", value: results.minResponseTime, color: "text-green-600" },
                  { label: "P50 (Median)", value: results.p50ResponseTime, color: "text-blue-600" },
                  { label: "P95", value: results.p95ResponseTime, color: "text-yellow-600" },
                  { label: "P99", value: results.p99ResponseTime, color: "text-orange-600" },
                  { label: "Max", value: results.maxResponseTime, color: "text-red-600" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-lg border border-gray-200 bg-white p-3 text-center">
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className={`text-lg font-bold ${color}`}>{value}ms</p>
                  </div>
                ))}
              </div>
              {phases.length > 0 && (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={phases.map(p => ({ phase: `Ph ${p.phase}`, p50: p.percentiles.p50, p95: p.percentiles.p95, p99: p.percentiles.p99 }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="phase" stroke="#6b7280" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#6b7280" unit="ms" />
                    <Tooltip contentStyle={{ borderRadius: 8 }} formatter={(v: any) => [`${v}ms`]} />
                    <Legend />
                    <Line type="monotone" dataKey="p50" stroke="#22c55e" name="P50" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="p95" stroke="#f59e0b" name="P95" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="p99" stroke="#ef4444" name="P99" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {activeMetric === "Success Rate" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Success Rate per Phase</h3>
                <span className="text-sm text-gray-500">{results.successfulRequests.toLocaleString()} / {results.totalRequests.toLocaleString()} requests succeeded</span>
              </div>
              {phases.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={phases.map(p => ({ phase: `Ph ${p.phase}`, successRate: Number(p.successRate.toFixed(1)), errors: p.errorCount }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="phase" stroke="#6b7280" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#6b7280" unit="%" domain={[0, 100]} />
                    <Tooltip contentStyle={{ borderRadius: 8 }} formatter={(v: any, name: string) => [name === "successRate" ? `${v}%` : v, name === "successRate" ? "Success Rate" : "Errors"]} />
                    <Legend />
                    <Bar dataKey="successRate" name="Success Rate" fill="#22c55e" radius={[4,4,0,0]} />
                    <Bar dataKey="errors" name="Errors" fill="#ef4444" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-gray-500">No per-phase data available.</p>
              )}
            </div>
          )}

          {activeMetric === "Errors" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Error Breakdown</h3>
                <a href="#url-breakdown" className="text-sm text-purple-600 hover:underline">View URL breakdown ↓</a>
              </div>
              {results.failedRequests === 0 ? (
                <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">All {results.totalRequests.toLocaleString()} requests succeeded — no errors recorded.</span>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <div className="rounded-lg border border-red-100 bg-white p-3 text-center">
                      <p className="text-xs text-gray-500">Total Errors</p>
                      <p className="text-xl font-bold text-red-600">{results.failedRequests.toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
                      <p className="text-xs text-gray-500">Error Rate</p>
                      <p className="text-xl font-bold text-orange-600">{(100 - overallSuccessRate).toFixed(1)}%</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
                      <p className="text-xs text-gray-500">Affected URLs</p>
                      <p className="text-xl font-bold text-gray-700">
                        {Object.values(results.urlBreakdown).filter((u: any) => u.successRate < 100).length}
                      </p>
                    </div>
                  </div>
                  {phases.length > 0 && (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={phases.map(p => ({ phase: `Ph ${p.phase}`, errors: p.errorCount }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="phase" stroke="#6b7280" tick={{ fontSize: 12 }} />
                        <YAxis stroke="#6b7280" allowDecimals={false} />
                        <Tooltip contentStyle={{ borderRadius: 8 }} />
                        <Bar dataKey="errors" name="Errors" fill="#ef4444" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

       {/* <div className="mb-6">
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Average Response Times by Phase</CardTitle>
            <CardDescription className="text-gray-600">Performance metrics across test phases</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="phase" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip
                  contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                />
                <Legend />
                <Line type="monotone" dataKey="avgTime" stroke="#9333ea" name="Average" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div> */}

      <Card>
      <CardHeader>
        <CardTitle>Response Time Percentiles by Phase</CardTitle>
        <CardDescription>P50, P95, P99 latencies across all test phases</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={performanceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="phase" stroke="#6b7280" />
            <YAxis stroke="#6b7280" label={{ value: 'ms', angle: -90, position: 'insideLeft' }} />
            <Tooltip contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb", borderRadius: "8px" }} />
            <Legend />
            <Line type="monotone" dataKey="p50" stroke="#22c55e" name="P50" strokeWidth={2} />
            <Line type="monotone" dataKey="p95" stroke="#f59e0b" name="P95" strokeWidth={2} />
            <Line type="monotone" dataKey="p99" stroke="#ef4444" name="P99" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>

    
      <Card id="url-breakdown" className="border-gray-200 scroll-mt-8">
        <CardHeader>
          <CardTitle className="text-gray-900">Performance by URL</CardTitle>
          <CardDescription className="text-gray-600">
            Click any endpoint to see its error details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {typeof results.urlBreakdown === 'object' &&
             results.urlBreakdown !== null &&
             Object.keys(results.urlBreakdown).length > 0 ? (
              Object.entries(results.urlBreakdown).map(([url, urlMetric]: [string, any]) => {
                const isOpen = expandedUrls.has(url)
                const rate = Number(urlMetric.successRate ?? 0)
                const hasErrors = Array.isArray(urlMetric.errors) && urlMetric.errors.length > 0
                const totalReqs = urlMetric.requests ?? 0
                const successCount = Math.round((rate / 100) * totalReqs)
                const errorCount = totalReqs - successCount

                const badgeClass =
                  rate >= 99 ? "bg-green-100 text-green-700 hover:bg-green-200" :
                  rate >= 50 ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200" :
                               "bg-red-100 text-red-700 hover:bg-red-200"

                return (
                  <div
                    key={url}
                    className={`rounded-lg border transition-all ${isOpen ? "border-purple-300 bg-purple-50/30" : "border-gray-200 bg-white hover:border-purple-200"}`}
                  >
                    {/* Clickable header row */}
                    <button
                      onClick={() => toggleUrl(url)}
                      className="flex w-full items-center justify-between p-4 text-left"
                    >
                      <div className="flex items-center gap-3 overflow-hidden">
                        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                        <code className="truncate text-sm font-medium text-gray-900">{url}</code>
                      </div>
                      <div className="ml-4 flex shrink-0 items-center gap-3">
                        <span className="text-xs text-gray-500">{urlMetric.requests ?? 0} reqs · {urlMetric.avgResponseTime ?? 0}ms avg</span>
                        <Badge className={badgeClass}>{rate.toFixed(1)}% success</Badge>
                      </div>
                    </button>

                    {/* Expanded details */}
                    {isOpen && (
                      <div className="border-t border-gray-200 px-4 pb-4 pt-3">
                        {/* Stats row */}
                        <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                          <div className="rounded-lg border border-gray-200 bg-white p-3 text-center">
                            <p className="text-xs text-gray-500">Total Requests</p>
                            <p className="text-lg font-bold text-gray-900">{totalReqs.toLocaleString()}</p>
                          </div>
                          <div className="rounded-lg border border-green-100 bg-white p-3 text-center">
                            <p className="text-xs text-gray-500">Successful</p>
                            <p className="text-lg font-bold text-green-600">{successCount.toLocaleString()}</p>
                          </div>
                          <div className="rounded-lg border border-red-100 bg-white p-3 text-center">
                            <p className="text-xs text-gray-500">Failed</p>
                            <p className="text-lg font-bold text-red-600">{errorCount.toLocaleString()}</p>
                          </div>
                          <div className="rounded-lg border border-blue-100 bg-white p-3 text-center">
                            <p className="text-xs text-gray-500">Avg Response</p>
                            <p className="text-lg font-bold text-blue-600">{urlMetric.avgResponseTime ?? 0}ms</p>
                          </div>
                        </div>

                        {/* Errors */}
                        {hasErrors ? (
                          <div>
                            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-red-700">
                              <AlertCircle className="h-3.5 w-3.5" />
                              Errors detected on this endpoint
                            </p>
                            <ul className="space-y-2">
                              {urlMetric.errors.map((err: any, i: number) => (
                                <li key={i} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <span className="text-xs font-semibold text-red-800">HTTP {err.statusCode}</span>
                                      <p className="mt-0.5 break-all text-xs text-red-700">{err.message}</p>
                                    </div>
                                    <Badge className="shrink-0 bg-red-100 text-red-800 text-xs">
                                      {err.count}× occurred
                                    </Badge>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 text-sm text-green-700">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            {rate === 100
                              ? "All requests to this endpoint succeeded — no errors recorded."
                              : "No structured error details available yet. Check backend error logging for this endpoint."}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            ) : (
              <p className="text-gray-500">No URL breakdown data available.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  )
}