"use client"

import { useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import { CheckCircle2, Clock, TrendingUp, AlertCircle, ChevronDown, FileDown, Sheet } from "lucide-react"
import { gautengLogoB64 } from "~/lib/gauteng-logo-b64"
import { api } from "~/trpc/react"
import { SignOffPanel } from "~/components/sign-off-panel"
import { BrsContextCard } from "~/components/brs-context-card"
import {
  REPORT_COLORS, addChart, brsContextSection, captureChart, deploymentReadiness, drawFooter, narrativeBox,
  pageBand, readinessBanner, sectionHeading, signOffSection, suggestFix, textBlock, verdictCellStyler, verdictFor,
} from "~/lib/pdf-report"
import { BRS_FIELD_LABELS, BRS_REPORT_FIELD_ORDER } from "~/lib/brs-fields"

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
    brsContext?: Record<string, string> | null;
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

/** Auto-generated "what went right / what went wrong" narrative for the PDF,
 *  derived from the same metrics already on screen — no new data required. */
function buildLoadNarrative(
  results: TestResultsProps["results"],
  phases: TestResultsProps["phases"],
): { right: string[]; wrong: string[] } {
  const right: string[] = []
  const wrong: string[] = []
  const successRate = results.totalRequests
    ? (results.successfulRequests / results.totalRequests) * 100
    : 0

  if (results.totalRequests > 0) {
    right.push(
      `${results.successfulRequests.toLocaleString()} of ${results.totalRequests.toLocaleString()} requests (${successRate.toFixed(1)}%) completed successfully at an average of ${results.avgResponseTime}ms.`,
    )
  }

  if (phases.length > 0) {
    const best = [...phases].sort((a, b) => b.successRate - a.successRate)[0]!
    const worst = [...phases].sort((a, b) => a.successRate - b.successRate)[0]!
    if (best.successRate >= 99) {
      right.push(`Phase ${best.phase} held up best — ${best.concurrency} concurrent users at a ${best.successRate.toFixed(1)}% success rate, P95 of ${best.percentiles.p95}ms.`)
    }
    if (worst.successRate < 99) {
      wrong.push(`Phase ${worst.phase} was the weakest — ${worst.errorCount} failed request(s) out of ${worst.requests.toLocaleString()} at ${worst.concurrency} concurrent users (${worst.successRate.toFixed(1)}% success).`)
    } else {
      right.push(`Every phase stayed at or above a 99% success rate as concurrency scaled up to ${Math.max(...phases.map(p => p.concurrency))} users.`)
    }
  }

  if (results.p50ResponseTime > 0 && results.p99ResponseTime > results.p50ResponseTime * 3) {
    wrong.push(`Tail latency is elevated — P99 (${results.p99ResponseTime}ms) is ${(results.p99ResponseTime / results.p50ResponseTime).toFixed(1)}× the median (${results.p50ResponseTime}ms), suggesting inconsistent response times under load.`)
  } else if (results.p50ResponseTime > 0) {
    right.push(`Response times were consistent under load — P99 (${results.p99ResponseTime}ms) stayed within ${(results.p99ResponseTime / results.p50ResponseTime).toFixed(1)}× of the median.`)
  }

  const urlEntries = Object.entries(results.urlBreakdown ?? {})
  const failingUrls = urlEntries.filter(([, m]: any) => Number(m.successRate ?? 100) < 100)
  if (failingUrls.length > 0) {
    const [topUrl, topMetric] = [...failingUrls].sort(
      (a: any, b: any) => (b[1].errors?.reduce((s: number, e: any) => s + e.count, 0) ?? 0) - (a[1].errors?.reduce((s: number, e: any) => s + e.count, 0) ?? 0),
    )[0] as [string, any]
    const topErrCount = topMetric.errors?.reduce((s: number, e: any) => s + e.count, 0) ?? 0
    const topStatus = [...(topMetric.errors ?? [])].sort((a: any, b: any) => b.count - a.count)[0]
    wrong.push(
      `${topUrl} accounted for the most failures${results.failedRequests ? ` (${topErrCount} of ${results.failedRequests}, ${((topErrCount / results.failedRequests) * 100).toFixed(0)}%)` : ""}` +
      (topStatus ? `, most commonly HTTP ${topStatus.statusCode}.` : "."),
    )
  } else if (urlEntries.length > 0) {
    right.push(`All ${urlEntries.length} tested endpoint(s) returned a 100% success rate.`)
  }

  if (right.length === 0) right.push("No requests were recorded for this run.")
  if (wrong.length === 0) wrong.push("No issues were identified — every phase and endpoint stayed above the 99% success threshold.")

  return { right, wrong }
}

/** A short prose paragraph opening the report — what was tested and the
 *  headline outcome, so a reader can understand the result without first
 *  parsing every table. */
function buildExecutiveSummary(results: TestResultsProps["results"], phases: TestResultsProps["phases"]): string {
  const rate = results.totalRequests ? (results.successfulRequests / results.totalRequests) * 100 : 0
  const peakConcurrency = phases.length > 0 ? Math.max(...phases.map(p => p.concurrency)) : null
  const sentences: string[] = []

  sentences.push(
    `This performance test exercised the target system${phases.length > 0 ? ` across ${phases.length} load phase${phases.length === 1 ? '' : 's'}` : ''}` +
    `${peakConcurrency !== null ? `, ramping up to a peak of ${peakConcurrency} concurrent user${peakConcurrency === 1 ? '' : 's'}` : ''}.`,
  )
  sentences.push(
    `Of ${results.totalRequests.toLocaleString()} total request${results.totalRequests === 1 ? '' : 's'} sent, ${results.successfulRequests.toLocaleString()} ` +
    `(${rate.toFixed(1)}%) completed successfully, at an average response time of ${results.avgResponseTime}ms ` +
    `(P95: ${results.p95ResponseTime}ms, P99: ${results.p99ResponseTime}ms).`,
  )
  sentences.push(
    results.failedRequests > 0
      ? `${results.failedRequests.toLocaleString()} request${results.failedRequests === 1 ? '' : 's'} failed during the run — see the findings and the error breakdown later in this report for specifics and suggested fixes.`
      : `No failed requests were recorded during the run.`,
  )

  return sentences.join(' ')
}

/** Describes what was actually tested, in prose — the config a reader would
 *  otherwise have to reconstruct from the tables further down. */
function buildTestScope(results: TestResultsProps["results"], phases: TestResultsProps["phases"]): string {
  const urls = Object.keys(results.urlBreakdown ?? {})
  const urlList = urls.slice(0, 4).join(', ') + (urls.length > 4 ? `, and ${urls.length - 4} more` : '')
  const concurrencyProgression = phases.map(p => p.concurrency).join(' → ')
  const approxDurationSec = results.requestsPerSecond > 0 ? Math.round(results.totalRequests / results.requestsPerSecond) : null

  const parts: string[] = []
  parts.push(
    urls.length > 0
      ? `This test targeted ${urls.length} endpoint${urls.length === 1 ? '' : 's'}: ${urlList}.`
      : `This test targeted the endpoint(s) configured for the run.`,
  )
  if (phases.length > 0) {
    parts.push(
      `Concurrency was ramped through ${phases.length} phase${phases.length === 1 ? '' : 's'} (${concurrencyProgression} concurrent user${phases.length === 1 && phases[0]!.concurrency === 1 ? '' : 's'})` +
      `${approxDurationSec ? `, over an approximate total duration of ${approxDurationSec}s` : ''}.`,
    )
  }
  return parts.join(' ')
}

/** Concrete next steps, not generic filler — tied to this run's own verdict
 *  and whether there's anything to actually act on. */
function buildRecommendations(
  readinessVerdict: ReturnType<typeof deploymentReadiness>['verdict'],
  hasErrors: boolean,
): string[] {
  const recs: string[] = []
  recs.push(
    readinessVerdict === 'ready'
      ? 'No blocking issues were found in this run — proceed with confidence, and keep an eye on these endpoints under real traffic after release.'
      : 'Review the failing/degraded phases and endpoints in this report, apply the suggested fixes, and re-run this test before sign-off.',
  )
  if (hasErrors) {
    recs.push('See the "Suggested Fix" column on the error-detail pages for guidance specific to the failures recorded in this run.')
  }
  recs.push('Re-test after any change to the target environment, configuration, or deployed code — these results reflect a single point in time.')
  return recs
}

/** Tailwind classes for the four deployment-readiness tiers — mirrors the
 *  colors verdictColor() uses in the PDF so on-screen and on-paper agree. */
function readinessBadgeClass(verdict: ReturnType<typeof deploymentReadiness>['verdict']): string {
  if (verdict === 'ready') return 'bg-green-100 text-green-700 hover:bg-green-200'
  if (verdict === 'fixable') return 'bg-amber-100 text-amber-700 hover:bg-amber-200'
  if (verdict === 'acceptable') return 'bg-teal-100 text-teal-700 hover:bg-teal-200'
  return 'bg-red-100 text-red-700 hover:bg-red-200'
}

/** Same four tiers, applied to a single rate/sample pair (a phase or a
 *  URL row) rather than the overall run. */
function rateBadgeClass(rate: number, samples: number): string {
  const { verdict } = verdictFor(rate, samples)
  if (verdict === 'healthy') return 'bg-green-100 text-green-700 hover:bg-green-200'
  if (verdict === 'fixable') return 'bg-amber-100 text-amber-700 hover:bg-amber-200'
  if (verdict === 'acceptable') return 'bg-teal-100 text-teal-700 hover:bg-teal-200'
  if (verdict === 'failing') return 'bg-red-100 text-red-700 hover:bg-red-200'
  return 'bg-gray-100 text-gray-500 hover:bg-gray-200'
}

export const TestResults: React.FC<TestResultsProps> = ({ results, phases }) => {
  const [activeMetric, setActiveMetric] = useState<string | null>(null)
  const [expandedUrls, setExpandedUrls]  = useState<Set<string>>(new Set())
  const [exporting, setExporting]        = useState(false)

  // Shared between the PDF and Excel exports — computed once here.
  const narrative = buildLoadNarrative(results, phases)

  // Hidden chart refs for PDF capture
  const pdfResponseRef = useRef<HTMLDivElement>(null)   // P50/P95/P99 line chart
  const pdfRequestsRef = useRef<HTMLDivElement>(null)   // Requests per phase
  const pdfSuccessRef  = useRef<HTMLDivElement>(null)   // Success rate per phase
  const pdfErrorsRef   = useRef<HTMLDivElement>(null)   // Errors per phase

  const overallSuccessRate = results.totalRequests
    ? (results.successfulRequests / results.totalRequests) * 100
    : 0
  // Deployment readiness tiers (50 / 70 / 85), not a single 99%-or-fail
  // bar — computed once here so the on-screen badge, the cover page, and
  // the PDF's readiness banner all agree with each other.
  const failingPhases = phases.filter(p => verdictFor(p.successRate, p.requests).verdict === 'failing').length
  const degradedPhases = phases.filter(p => {
    const v = verdictFor(p.successRate, p.requests).verdict
    return v === 'fixable' || v === 'acceptable'
  }).length
  const readiness = deploymentReadiness(overallSuccessRate, failingPhases, degradedPhases)
  const isSuccess = readiness.verdict === 'ready'

  // Shared with the on-screen sign-off panel below — fetched once here so
  // the PDF export can include the same audit trail without a second round
  // trip, and refetched automatically whenever a teammate adds an entry.
  const { data: signOffs } = api.signoff.list.useQuery(
    { testId: results.testId ?? '' },
    { enabled: !!results.testId },
  )

  const toggleUrl = (url: string) => {
    setExpandedUrls(prev => {
      const next = new Set(prev)
      next.has(url) ? next.delete(url) : next.add(url)
      return next
    })
  }

  const performanceData = phases.length > 0
    ? phases.map(p => ({
        phase: `Phase ${p.phase}`,
        p50: p.percentiles.p50, p95: p.percentiles.p95, p99: p.percentiles.p99,
        concurrency: p.concurrency, requests: p.requests, successRate: p.successRate,
      }))
    : [
        { phase: "Ramp Up",   p50: results.phaseMetrics.rampUp.percentiles.p50,   p95: results.phaseMetrics.rampUp.percentiles.p95,   p99: results.phaseMetrics.rampUp.percentiles.p99,   concurrency: results.phaseMetrics.rampUp.concurrency,   requests: results.phaseMetrics.rampUp.requests,   successRate: 0 },
        { phase: "Steady",    p50: results.phaseMetrics.steady.percentiles.p50,    p95: results.phaseMetrics.steady.percentiles.p95,    p99: results.phaseMetrics.steady.percentiles.p99,    concurrency: results.phaseMetrics.steady.concurrency,    requests: results.phaseMetrics.steady.requests,    successRate: 0 },
        { phase: "Ramp Down", p50: results.phaseMetrics.rampDown.percentiles.p50, p95: results.phaseMetrics.rampDown.percentiles.p95, p99: results.phaseMetrics.rampDown.percentiles.p99, concurrency: results.phaseMetrics.rampDown.concurrency, requests: results.phaseMetrics.rampDown.requests, successRate: 0 },
      ]

  // ─── PDF Export ─────────────────────────────────────────────────────────────
  const exportToPDF = async () => {
    setExporting(true)
    try {
      const { jsPDF }           = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')

      const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW  = 210
      const { navy, gold, charcoal, rowAlt, white } = REPORT_COLORS

      // ── Capture all charts in parallel ──────────────────────────────────
      const [responseTimeImg, requestsImg, successImg, errorsImg] = await Promise.all([
        captureChart(pdfResponseRef),
        captureChart(pdfRequestsRef),
        captureChart(pdfSuccessRef),
        captureChart(pdfErrorsRef),
      ])

      // ══════════════════════════════════════════════════════════════════════
      // PAGE 1 — COVER + SUMMARY TABLES
      // ══════════════════════════════════════════════════════════════════════

      // Navy header
      doc.setFillColor(...navy)
      doc.rect(0, 0, pageW, 44, 'F')
      doc.setFillColor(...gold)
      doc.rect(0, 44, pageW, 1.5, 'F')

      // Logo (embedded base64 — no fetch needed)
      doc.addImage(gautengLogoB64, 'PNG', 8, 4, 54, 34)

      // Divider
      doc.setDrawColor(...gold)
      doc.setLineWidth(0.4)
      doc.line(70, 6, 70, 40)

      // Title block
      doc.setTextColor(...white)
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('Performance Test Report', 143, 15, { align: 'center' })
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'normal')
      doc.text('Gauteng Provincial Government', 143, 21, { align: 'center' })
      doc.setFontSize(7)
      doc.text(`Generated: ${new Date().toLocaleString()}`, 143, 28, { align: 'center' })
      doc.text(`Test ID: ${results.testId ?? 'N/A'}`, 143, 34, { align: 'center' })
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'bold')
      doc.text(
        `Status: ${isSuccess ? 'COMPLETED — ALL REQUESTS PASSED' : 'COMPLETED — REQUESTS WITH FAILURES'}`,
        143, 40, { align: 'center' }
      )

      // Executive Summary + Test Scope — submission-grade reports need prose
      // context before the numbers, not just tables and charts.
      const execSummary = buildExecutiveSummary(results, phases)
      const testScope = buildTestScope(results, phases)
      const afterExecSummary = textBlock(doc, 'Executive Summary', execSummary, 53)
      textBlock(doc, 'Test Scope', testScope, afterExecSummary)

      // Business Requirements Context — its own page only when there's
      // actually something to show, so a test with no BRS attached doesn't
      // get a blank page.
      const hasBrsContext = BRS_REPORT_FIELD_ORDER.some((key) => results.brsContext?.[key])
      if (hasBrsContext) {
        doc.addPage()
        pageBand(doc, 'Business Requirements Context')
        brsContextSection(doc, results.brsContext, 19)
      }

      // ══════════════════════════════════════════════════════════════════════
      // PAGE 2 — TEST OVERVIEW + NARRATIVE
      // ══════════════════════════════════════════════════════════════════════

      doc.addPage()
      pageBand(doc, 'Test Overview')

      autoTable(doc, {
        startY: 19,
        head: [['Metric', 'Value']],
        body: [
          ['Total Requests',      results.totalRequests.toLocaleString()],
          ['Successful Requests', results.successfulRequests.toLocaleString()],
          ['Failed Requests',     results.failedRequests.toLocaleString()],
          ['Success Rate',        `${overallSuccessRate.toFixed(1)}%`],
          ['Avg Response Time',   `${results.avgResponseTime} ms`],
          ['Requests / Second',   String(results.requestsPerSecond)],
          ['Test Status',         isSuccess ? 'Passed' : 'Failed'],
        ],
        headStyles: { fillColor: navy, textColor: white, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8, textColor: charcoal },
        alternateRowStyles: { fillColor: rowAlt },
        margin: { left: 14, right: 112 },
        tableWidth: 84,
      })

      autoTable(doc, {
        startY: 19,
        head: [['Percentile', 'Time (ms)']],
        body: [
          ['Minimum',      `${results.minResponseTime} ms`],
          ['P50 — Median', `${results.p50ResponseTime} ms`],
          ['P95',          `${results.p95ResponseTime} ms`],
          ['P99',          `${results.p99ResponseTime} ms`],
          ['Maximum',      `${results.maxResponseTime} ms`],
        ],
        headStyles: { fillColor: navy, textColor: white, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8, textColor: charcoal },
        alternateRowStyles: { fillColor: rowAlt },
        margin: { left: 112, right: 14 },
        tableWidth: 84,
      })

      // What went right / what went wrong — derived from the same metrics above
      const afterRight = narrativeBox(doc, 'What went right', narrative.right, (doc as any).lastAutoTable.finalY + 8, REPORT_COLORS.green)
      narrativeBox(doc, 'What went wrong', narrative.wrong, afterRight, REPORT_COLORS.red)

      // ══════════════════════════════════════════════════════════════════════
      // PAGE 3 — DEPLOYMENT READINESS + RECOMMENDATIONS + RESPONSE TIME CHART
      // ══════════════════════════════════════════════════════════════════════

      doc.addPage()
      pageBand(doc, 'Deployment Readiness & Recommendations')

      // Deployment readiness was already computed above (component scope) so
      // the on-screen badge and this PDF banner always agree.
      const afterReadiness = readinessBanner(doc, readiness.verdict, readiness.label, readiness.detail, 19)

      const recommendations = buildRecommendations(readiness.verdict, results.failedRequests > 0)
      const afterRecommendations = narrativeBox(doc, 'Recommendations', recommendations, afterReadiness + 4, REPORT_COLORS.navy)

      // Response time chart (full width)
      addChart(doc, responseTimeImg, 14, afterRecommendations + 4, 182, 55, 'Response Time by Phase — P50 / P95 / P99 (ms)')

      // ══════════════════════════════════════════════════════════════════════
      // PAGE 4 — SIGN-OFF / AUDIT TRAIL
      // ══════════════════════════════════════════════════════════════════════
      doc.addPage()
      pageBand(doc, 'Sign-Off / Audit Trail')
      signOffSection(doc, signOffs ?? [], 19)

      // ══════════════════════════════════════════════════════════════════════
      // PAGE 5 — PHASE BREAKDOWN + CHARTS
      // ══════════════════════════════════════════════════════════════════════

      doc.addPage()
      pageBand(doc, 'Phase Breakdown')
      doc.setFontSize(7.5)
      doc.setFont('helvetica', 'italic')
      doc.setTextColor(...REPORT_COLORS.grey)
      doc.text('Each phase is evaluated as a test case against a 99% success-rate target.', 14, 16)
      doc.setTextColor(...charcoal)

      if (phases.length > 0) {
        autoTable(doc, {
          startY: 19,
          head: [['Phase', 'Concurrency', 'Requests', 'Success', 'Errors', 'Success Rate', 'P50', 'P95', 'P99', 'Status']],
          body: phases.map(p => [
            `Phase ${p.phase}`, p.concurrency, p.requests, p.successCount, p.errorCount,
            `${p.successRate.toFixed(1)}%`,
            `${p.percentiles.p50} ms`, `${p.percentiles.p95} ms`, `${p.percentiles.p99} ms`,
            verdictFor(p.successRate, p.requests).label,
          ]),
          headStyles: { fillColor: navy, textColor: white, fontStyle: 'bold', fontSize: 7.5 },
          bodyStyles: { fontSize: 7.5, textColor: charcoal },
          alternateRowStyles: { fillColor: rowAlt },
          margin: { left: 14, right: 14 },
          didParseCell: verdictCellStyler((rowIndex) => {
            const p = phases[rowIndex]
            return p ? { rate: p.successRate, samples: p.requests } : null
          }),
        })
      }

      const chartTop = phases.length > 0 ? (doc as any).lastAutoTable.finalY + 10 : 22

      // Row 1: Requests (left) + Success Rate (right)
      addChart(doc, requestsImg,   14,  chartTop,      90, 55, 'Total Requests per Phase')
      addChart(doc, successImg,   112,  chartTop,      84, 55, 'Success Rate per Phase (%)')

      // Row 2: Errors (left, half width) — only if there were errors
      const row2Top = chartTop + 65
      if (results.failedRequests > 0) {
        addChart(doc, errorsImg, 14, row2Top, 90, 55, 'Errors per Phase')
      }

      // ══════════════════════════════════════════════════════════════════════
      // PAGE 6 — URL BREAKDOWN
      // ══════════════════════════════════════════════════════════════════════

      const urlEntries = Object.entries(results.urlBreakdown ?? {})
      if (urlEntries.length > 0) {
        doc.addPage()
        pageBand(doc, 'Performance by URL')

        autoTable(doc, {
          startY: 17,
          head: [['URL', 'Requests', 'Avg Response Time', 'Success Rate', 'Status']],
          body: urlEntries.map(([url, m]: any) => [
            url.length > 62 ? url.slice(0, 59) + '…' : url,
            m.requests ?? 0,
            `${m.avgResponseTime ?? 0} ms`,
            `${Number(m.successRate ?? 0).toFixed(1)}%`,
            verdictFor(Number(m.successRate ?? 0), Number(m.requests ?? 0)).label,
          ]),
          headStyles: { fillColor: navy, textColor: white, fontStyle: 'bold', fontSize: 8 },
          bodyStyles: { fontSize: 7.5, textColor: charcoal },
          alternateRowStyles: { fillColor: rowAlt },
          columnStyles: { 0: { cellWidth: 90 } },
          margin: { left: 14, right: 14 },
          didParseCell: verdictCellStyler((rowIndex) => {
            const entry = urlEntries[rowIndex]
            if (!entry) return null
            const m = entry[1] as any
            return { rate: Number(m.successRate ?? 0), samples: Number(m.requests ?? 0) }
          }),
        })

        // Error details
        const urlsWithErrors = urlEntries.filter(([, m]: any) => Array.isArray(m.errors) && m.errors.length > 0)
        if (urlsWithErrors.length > 0) {
          let y = (doc as any).lastAutoTable.finalY + 12
          sectionHeading(doc, 'Error Details by URL', y)
          y += 8

          for (const [url, m] of urlsWithErrors as any) {
            if (y > 265) {
              doc.addPage()
              pageBand(doc, 'Error Details by URL — continued')
              y = 20
            }
            doc.setFontSize(7.5)
            doc.setFont('helvetica', 'bold')
            doc.setTextColor(...charcoal)
            doc.text(url.length > 95 ? url.slice(0, 92) + '…' : url, 14, y)
            y += 4
            autoTable(doc, {
              startY: y,
              head: [['Status Code', 'Error Message', 'Count', 'Suggested Fix']],
              body: (m as any).errors.map((e: any) => [e.statusCode, e.message, e.count, suggestFix(e.statusCode, e.message)]),
              headStyles: { fillColor: [80,80,80] as [number,number,number], textColor: white, fontSize: 7.5 },
              bodyStyles: { fontSize: 7, textColor: charcoal },
              alternateRowStyles: { fillColor: rowAlt },
              columnStyles: { 1: { cellWidth: 55 }, 3: { cellWidth: 65 } },
              margin: { left: 14, right: 14 },
            })
            y = (doc as any).lastAutoTable.finalY + 8
          }
        }
      }

      drawFooter(doc)
      doc.save(`performance-report-${(results.testId ?? 'export').slice(0, 8)}.pdf`)
    } finally {
      setExporting(false)
    }
  }

  // ─── Raw data export — a real multi-sheet, styled .xlsx ───────────────────
  const exportToExcel = async () => {
    const { buildAndDownloadWorkbook, addSummarySheet, addTableSheet } = await import("~/lib/excel-export")

    const brsNotes = BRS_REPORT_FIELD_ORDER
      .filter((key) => results.brsContext?.[key])
      .map((key) => ({ heading: BRS_FIELD_LABELS[key] ?? key, lines: [results.brsContext![key]!] }))

    await buildAndDownloadWorkbook(`performance-report-${(results.testId ?? 'export').slice(0, 8)}.xlsx`, (wb) => {
      addSummarySheet(wb, {
        title: 'Performance Test Report — Summary',
        stats: [
          ['Test ID', results.testId ?? 'N/A'],
          ['Total Requests', results.totalRequests],
          ['Successful Requests', results.successfulRequests],
          ['Failed Requests', results.failedRequests],
          ['Success Rate (%)', overallSuccessRate.toFixed(1)],
          ['Avg Response Time (ms)', results.avgResponseTime],
          ['P50 (ms)', results.p50ResponseTime],
          ['P95 (ms)', results.p95ResponseTime],
          ['P99 (ms)', results.p99ResponseTime],
          ['Requests / Second', results.requestsPerSecond],
          ['Deployment Readiness', readiness.label],
        ],
        notes: [
          { heading: 'What went right', lines: narrative.right },
          { heading: 'What went wrong', lines: narrative.wrong },
          ...(brsNotes.length > 0 ? [{ heading: 'Business Requirements Context', lines: brsNotes.map(n => `${n.heading}: ${n.lines[0]}`) }] : []),
        ],
      })

      addTableSheet(
        wb, 'Phases',
        [
          { header: 'Phase', key: 'phase', width: 10 },
          { header: 'Concurrency', key: 'concurrency', width: 14 },
          { header: 'Requests', key: 'requests', width: 12 },
          { header: 'Successful', key: 'successful', width: 12 },
          { header: 'Errors', key: 'errors', width: 10 },
          { header: 'Success Rate (%)', key: 'rate', width: 16 },
          { header: 'P50 (ms)', key: 'p50', width: 12 },
          { header: 'P95 (ms)', key: 'p95', width: 12 },
          { header: 'P99 (ms)', key: 'p99', width: 12 },
          { header: 'Status', key: 'status', width: 26 },
        ],
        phases.map(p => ({
          phase: p.phase, concurrency: p.concurrency, requests: p.requests,
          successful: p.successCount, errors: p.errorCount, rate: Number(p.successRate.toFixed(1)),
          p50: p.percentiles.p50, p95: p.percentiles.p95, p99: p.percentiles.p99,
          status: verdictFor(p.successRate, p.requests).label,
        })),
      )

      addTableSheet(
        wb, 'URL Breakdown',
        [
          { header: 'URL', key: 'url', width: 50 },
          { header: 'Requests', key: 'requests', width: 12 },
          { header: 'Avg Response Time (ms)', key: 'avg', width: 20 },
          { header: 'Success Rate (%)', key: 'rate', width: 16 },
          { header: 'Errors', key: 'errors', width: 10 },
        ],
        Object.entries(results.urlBreakdown ?? {}).map(([url, m]: [string, any]) => ({
          url, requests: m.requests ?? 0, avg: m.avgResponseTime ?? 0,
          rate: Number((m.successRate ?? 0).toFixed(1)),
          errors: (m.errors ?? []).reduce((s: number, e: any) => s + e.count, 0),
        })),
      )
    })
  }

  // ─── UI ─────────────────────────────────────────────────────────────────────
  const overviewMetrics = [
    { title: "Total Requests",    value: results.totalRequests.toLocaleString(), icon: TrendingUp,  color: "text-purple-600",  hoverBorder: "hover:border-purple-300" },
    { title: "Avg Response Time", value: `${results.avgResponseTime}ms`,          icon: Clock,        color: "text-blue-600",    hoverBorder: "hover:border-blue-300"   },
    { title: "Success Rate",      value: `${overallSuccessRate.toFixed(1)}%`,      icon: CheckCircle2, color: "text-green-600",   hoverBorder: "hover:border-green-300"  },
    { title: "Errors",            value: results.failedRequests.toLocaleString(), icon: AlertCircle,  color: "text-red-600",     hoverBorder: "hover:border-red-300"    },
  ]

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Test Results for Test ID: {results.testId || 'N/A'}</h1>
            <p className="mt-1 text-sm text-gray-600">Overview of performance metrics</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => { void exportToExcel() }}
              variant="outline"
              className="border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-700"
            >
              <Sheet className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
            <Button
              onClick={exportToPDF}
              disabled={exporting}
              variant="outline"
              className="border-purple-200 text-purple-600 hover:bg-purple-50 hover:text-purple-700"
            >
              <FileDown className="mr-2 h-4 w-4" />
              {exporting ? "Exporting…" : "Export PDF"}
            </Button>
            <Badge className={readinessBadgeClass(readiness.verdict)}>
              {isSuccess ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <AlertCircle className="mr-1 h-3 w-3" />}
              {readiness.label}
            </Badge>
          </div>
        </div>
      </div>

      <div className="mb-8 space-y-6">
        <BrsContextCard context={results.brsContext} />
        <SignOffPanel testId={results.testId} signOffs={signOffs ?? []} />
      </div>

      {/* Metric cards */}
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
                    <Bar dataKey="requests"    name="Requests"    fill="#9333ea" radius={[4,4,0,0]} />
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
                  { label: "Min",        value: results.minResponseTime, color: "text-green-600"  },
                  { label: "P50 (Median)",value: results.p50ResponseTime, color: "text-blue-600"   },
                  { label: "P95",        value: results.p95ResponseTime, color: "text-yellow-600" },
                  { label: "P99",        value: results.p99ResponseTime, color: "text-orange-600" },
                  { label: "Max",        value: results.maxResponseTime, color: "text-red-600"    },
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
                    <Bar dataKey="errors"       name="Errors"       fill="#ef4444" radius={[4,4,0,0]} />
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

      {/* Response Time Percentiles chart */}
      <Card className="mb-6">
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

      {/* URL Breakdown */}
      <Card id="url-breakdown" className="border-gray-200 scroll-mt-8">
        <CardHeader>
          <CardTitle className="text-gray-900">Performance by URL</CardTitle>
          <CardDescription className="text-gray-600">Click any endpoint to see its error details</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {typeof results.urlBreakdown === 'object' &&
             results.urlBreakdown !== null &&
             Object.keys(results.urlBreakdown).length > 0 ? (
              Object.entries(results.urlBreakdown).map(([url, urlMetric]: [string, any]) => {
                const isOpen      = expandedUrls.has(url)
                const rate        = Number(urlMetric.successRate ?? 0)
                const hasErrors   = Array.isArray(urlMetric.errors) && urlMetric.errors.length > 0
                const totalReqs   = urlMetric.requests ?? 0
                const successCount = Math.round((rate / 100) * totalReqs)
                const errorCount  = totalReqs - successCount

                const badgeClass = rateBadgeClass(rate, totalReqs)

                return (
                  <div
                    key={url}
                    className={`rounded-lg border transition-all ${isOpen ? "border-purple-300 bg-purple-50/30" : "border-gray-200 bg-white hover:border-purple-200"}`}
                  >
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

                    {isOpen && (
                      <div className="border-t border-gray-200 px-4 pb-4 pt-3">
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

      {/* ── Hidden chart containers for PDF capture (always rendered, off-screen) ─ */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, pointerEvents: 'none', zIndex: -1 }}>

        {/* P50 / P95 / P99 response time line chart */}
        <div ref={pdfResponseRef} style={{ background: 'white', padding: '8px', width: '680px' }}>
          <LineChart width={660} height={175} data={performanceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="phase" stroke="#6b7280" tick={{ fontSize: 11 }} />
            <YAxis stroke="#6b7280" unit="ms" tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: any) => [`${v}ms`]} />
            <Legend />
            <Line type="monotone" dataKey="p50" stroke="#22c55e" name="P50" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="p95" stroke="#f59e0b" name="P95" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="p99" stroke="#ef4444" name="P99" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </div>

        {/* Requests per phase bar chart */}
        <div ref={pdfRequestsRef} style={{ background: 'white', padding: '8px', width: '380px' }}>
          <BarChart width={364} height={165} data={performanceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="phase" stroke="#6b7280" tick={{ fontSize: 11 }} />
            <YAxis stroke="#6b7280" tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="requests"    name="Requests"    fill="#1B3A6B" radius={[3,3,0,0]} />
            <Bar dataKey="concurrency" name="Concurrency" fill="#C8A232" radius={[3,3,0,0]} />
          </BarChart>
        </div>

        {/* Success rate per phase */}
        <div ref={pdfSuccessRef} style={{ background: 'white', padding: '8px', width: '360px' }}>
          <BarChart width={344} height={165} data={performanceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="phase" stroke="#6b7280" tick={{ fontSize: 11 }} />
            <YAxis stroke="#6b7280" unit="%" domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v: any) => [`${v}%`, 'Success Rate']} />
            <Legend />
            <Bar dataKey="successRate" name="Success Rate" fill="#1B3A6B" radius={[3,3,0,0]} />
          </BarChart>
        </div>

        {/* Errors per phase */}
        <div ref={pdfErrorsRef} style={{ background: 'white', padding: '8px', width: '380px' }}>
          <BarChart width={364} height={165} data={performanceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="phase" stroke="#6b7280" tick={{ fontSize: 11 }} />
            <YAxis stroke="#6b7280" allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="errorCount" name="Errors" fill="#C8A232" radius={[3,3,0,0]} />
          </BarChart>
        </div>

      </div>
    </main>
  )
}
