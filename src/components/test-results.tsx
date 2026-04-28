"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { CheckCircle2, Clock, TrendingUp, AlertCircle, Download } from "lucide-react"
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
    }>;
    phaseMetrics: {
      rampUp: { avgResponseTime: number; successRate: number; };
      steady: { avgResponseTime: number; successRate: number; };
      rampDown: { avgResponseTime: number; successRate: number; };
    };
  };
}
export const TestResults: React.FC<TestResultsProps> = ({ results }) => {
  const [exporting, setExporting] = useState(false)

  const overallSuccessRate = results.totalRequests
    ? (results.successfulRequests / results.totalRequests) * 100
    : 0;
  const isSuccess = overallSuccessRate >= 99;

  const exportToPDF = async () => {
    setExporting(true)
    try {
      const { default: jsPDF } = await import("jspdf")
      const { default: autoTable } = await import("jspdf-autotable")

      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const pageW = doc.internal.pageSize.getWidth()
      const purple = [147, 51, 234] as [number, number, number]
      const darkGray = [31, 31, 31] as [number, number, number]
      const midGray = [107, 114, 128] as [number, number, number]

      // ── Header bar ──
      doc.setFillColor(...purple)
      doc.rect(0, 0, pageW, 22, "F")
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(16)
      doc.setFont("helvetica", "bold")
      doc.text("LoadForge", 14, 10)
      doc.setFontSize(9)
      doc.setFont("helvetica", "normal")
      doc.text("Performance Test Report", 14, 16)
      doc.text(`Generated: ${new Date().toLocaleString()}`, pageW - 14, 16, { align: "right" })

      // ── Test ID ──
      doc.setTextColor(...darkGray)
      doc.setFontSize(8)
      doc.setFont("helvetica", "normal")
      doc.text(`Test ID: ${results.testId ?? "N/A"}`, 14, 30)

      // ── Status badge ──
      doc.setFillColor(isSuccess ? 22 : 220, isSuccess ? 163 : 38, isSuccess ? 74 : 38)
      doc.roundedRect(pageW - 50, 24, 36, 8, 2, 2, "F")
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(8)
      doc.setFont("helvetica", "bold")
      doc.text(isSuccess ? "✓  SUCCESS" : "✗  FAILED", pageW - 32, 29.5, { align: "center" })

      // ── Section: Overview ──
      let y = 40
      doc.setTextColor(...purple)
      doc.setFontSize(11)
      doc.setFont("helvetica", "bold")
      doc.text("Overview", 14, y)
      doc.setDrawColor(...purple)
      doc.setLineWidth(0.4)
      doc.line(14, y + 2, pageW - 14, y + 2)
      y += 8

      autoTable(doc, {
        startY: y,
        head: [["Metric", "Value"]],
        body: [
          ["Total Requests", results.totalRequests.toLocaleString()],
          ["Successful Requests", results.successfulRequests.toLocaleString()],
          ["Failed Requests", results.failedRequests.toLocaleString()],
          ["Overall Success Rate", `${overallSuccessRate.toFixed(1)}%`],
          ["Requests / Second", results.requestsPerSecond.toLocaleString()],
        ],
        theme: "grid",
        headStyles: { fillColor: purple, textColor: 255, fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: darkGray },
        alternateRowStyles: { fillColor: [248, 245, 255] },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 70 } },
        margin: { left: 14, right: 14 },
      })

      // ── Section: Response Times ──
      y = (doc as any).lastAutoTable.finalY + 10
      doc.setTextColor(...purple)
      doc.setFontSize(11)
      doc.setFont("helvetica", "bold")
      doc.text("Response Times", 14, y)
      doc.setDrawColor(...purple)
      doc.line(14, y + 2, pageW - 14, y + 2)
      y += 8

      autoTable(doc, {
        startY: y,
        head: [["Percentile / Stat", "Value (ms)"]],
        body: [
          ["Average (P50)", `${results.avgResponseTime} ms`],
          ["P50", `${results.p50ResponseTime} ms`],
          ["P95", `${results.p95ResponseTime} ms`],
          ["P99", `${results.p99ResponseTime} ms`],
          ["Min", `${results.minResponseTime} ms`],
          ["Max", `${results.maxResponseTime} ms`],
        ],
        theme: "grid",
        headStyles: { fillColor: purple, textColor: 255, fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: darkGray },
        alternateRowStyles: { fillColor: [248, 245, 255] },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 70 } },
        margin: { left: 14, right: 14 },
      })

      // ── Section: Phase Metrics ──
      y = (doc as any).lastAutoTable.finalY + 10
      doc.setTextColor(...purple)
      doc.setFontSize(11)
      doc.setFont("helvetica", "bold")
      doc.text("Phase Performance", 14, y)
      doc.setDrawColor(...purple)
      doc.line(14, y + 2, pageW - 14, y + 2)
      y += 8

      autoTable(doc, {
        startY: y,
        head: [["Phase", "Avg Response Time", "Success Rate"]],
        body: [
          ["Ramp Up",   `${results.phaseMetrics.rampUp.avgResponseTime} ms`,   `${results.phaseMetrics.rampUp.successRate.toFixed(1)}%`],
          ["Steady",    `${results.phaseMetrics.steady.avgResponseTime} ms`,    `${results.phaseMetrics.steady.successRate.toFixed(1)}%`],
          ["Ramp Down", `${results.phaseMetrics.rampDown.avgResponseTime} ms`, `${results.phaseMetrics.rampDown.successRate.toFixed(1)}%`],
        ],
        theme: "grid",
        headStyles: { fillColor: purple, textColor: 255, fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: darkGray },
        alternateRowStyles: { fillColor: [248, 245, 255] },
        margin: { left: 14, right: 14 },
      })

      // ── Section: URL Breakdown ──
      y = (doc as any).lastAutoTable.finalY + 10
      if (y > 240) { doc.addPage(); y = 20 }

      doc.setTextColor(...purple)
      doc.setFontSize(11)
      doc.setFont("helvetica", "bold")
      doc.text("URL Breakdown", 14, y)
      doc.setDrawColor(...purple)
      doc.line(14, y + 2, pageW - 14, y + 2)
      y += 8

      const urlRows = Object.entries(results.urlBreakdown).map(([url, m]: [string, any]) => [
        url,
        (m.requests ?? 0).toLocaleString(),
        `${m.avgResponseTime ?? 0} ms`,
        `${Number(m.successRate ?? 0).toFixed(1)}%`,
      ])

      autoTable(doc, {
        startY: y,
        head: [["URL", "Requests", "Avg Response Time", "Success Rate"]],
        body: urlRows.length ? urlRows : [["No URL data available", "", "", ""]],
        theme: "grid",
        headStyles: { fillColor: purple, textColor: 255, fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: darkGray },
        alternateRowStyles: { fillColor: [248, 245, 255] },
        columnStyles: { 0: { cellWidth: 80 } },
        margin: { left: 14, right: 14 },
        didParseCell: (data: any) => {
          if (data.column.index === 3 && data.section === "body") {
            const val = parseFloat(data.cell.text[0])
            if (!isNaN(val) && val < 99) {
              data.cell.styles.textColor = [220, 38, 38]
              data.cell.styles.fontStyle = "bold"
            }
          }
        },
      })

      // ── Footer ──
      const totalPages = (doc as any).internal.getNumberOfPages()
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFontSize(7)
        doc.setTextColor(...midGray)
        doc.text(`LoadForge · Page ${i} of ${totalPages}`, pageW / 2, 292, { align: "center" })
      }

      doc.save(`loadforge-report-${results.testId ?? "export"}.pdf`)
    } finally {
      setExporting(false)
    }
  }

  const overviewMetrics = [
    { title: "Total Requests", value: results.totalRequests.toLocaleString(), icon: TrendingUp, color: "text-purple-600" },
    { title: "Avg Response Time", value: `${results.avgResponseTime}ms`, icon: Clock, color: "text-blue-600" },
    { title: "Success Rate", value: `${overallSuccessRate.toFixed(1)}%`, icon: CheckCircle2, color: "text-green-600" },
    { title: "Errors", value: results.failedRequests.toLocaleString(), icon: AlertCircle, color: "text-red-600" },
  ];

  // Data for the "Average Response Times by Phase" chart
  const performanceData = [
    { phase: "Ramp Up", avgTime: results.phaseMetrics.rampUp.avgResponseTime },
    { phase: "Steady", avgTime: results.phaseMetrics.steady.avgResponseTime },
    { phase: "Ramp Down", avgTime: results.phaseMetrics.rampDown.avgResponseTime },
  ];

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
     <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Test Results for Test ID: {results.testId || 'N/A'}</h1>
            <p className="mt-1 text-sm text-gray-600">Overview of performance metrics</p>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={isSuccess ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-100 text-red-700 hover:bg-red-200"}>
              {isSuccess ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <AlertCircle className="mr-1 h-3 w-3" />}
              {isSuccess ? "Success" : "Failed"}
            </Badge>
            <Button
              onClick={exportToPDF}
              disabled={exporting}
              className="bg-violet-600 hover:bg-violet-700 text-white"
              size="sm"
            >
              <Download className="mr-2 h-4 w-4" />
              {exporting ? "Exporting..." : "Export PDF"}
            </Button>
          </div>
        </div>
      </div>

     <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {overviewMetrics.map((metric) => {
          const Icon = metric.icon
          return (
            <Card key={metric.title} className="border-gray-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">{metric.title}</CardTitle>
                <Icon className={`h-4 w-4 ${metric.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">{metric.value}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

       <div className="mb-6">
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-gray-900">Average Response Times by Phase</CardTitle>
            <CardDescription className="text-gray-600">Performance metrics across test phases</CardDescription>
          </CardHeader>
          <CardContent>
            {performanceData.every(d => !d.avgTime) ? (
              <div className="flex h-[300px] items-center justify-center text-sm text-gray-400">
                No phase timing data available for this test
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={performanceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="phase" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" unit="ms" domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: "8px" }}
                    formatter={(value: number) => [`${value}ms`, "Average"]}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="avgTime" stroke="#9333ea" name="Average" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

    
      <Card className="border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-900">Performance by URL</CardTitle>
          <CardDescription className="text-gray-600">
            Breakdown of requests and response times per endpoint
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Check if urlBreakdown is an object with entries */}
            {typeof results.urlBreakdown === 'object' && 
             results.urlBreakdown !== null && 
             Object.keys(results.urlBreakdown).length > 0 ? (
              Object.entries(results.urlBreakdown).map(([url, urlMetric]: [string, any]) => (
                <div key={url} className="rounded-lg border border-gray-200 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <code className="text-sm font-medium text-gray-900">{url}</code>
                    <Badge
                      variant={urlMetric.successRate >= 99 ? "default" : "destructive"}
                      className={
                        urlMetric.successRate >= 99
                          ? "bg-green-100 text-green-700 hover:bg-green-200"
                          : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                      }
                    >
                      {Number(urlMetric.successRate).toFixed(1)}% success
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Requests:</span>
                      <span className="ml-2 font-medium text-gray-900">{urlMetric.requests?.toLocaleString() || 0}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Avg Time:</span>
                      <span className="ml-2 font-medium text-gray-900">{urlMetric.avgResponseTime || 0}ms</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-gray-500">No URL breakdown data available.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
