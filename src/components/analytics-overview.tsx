"use client"

import { useSearchParams } from "next/navigation"
import { useState } from "react"
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card"
import { Badge } from "~/components/ui/badge"
import { AlertCircle, Activity, Clock, CheckCircle2, XCircle } from "lucide-react"
import Link from "next/link"
import { api } from "~/trpc/react"

const TABS = [
  { key: "total-tests",      label: "Total Tests",      icon: Activity },
  { key: "response-time",    label: "Avg Response Time", icon: Clock },
  { key: "success-rate",     label: "Success Rate",      icon: CheckCircle2 },
  { key: "failed-requests",  label: "Failed Requests",   icon: XCircle },
] as const

type TabKey = typeof TABS[number]["key"]

export function AnalyticsOverview() {
  const searchParams = useSearchParams()
  const initial = (searchParams.get("tab") ?? "total-tests") as TabKey
  const [activeTab, setActiveTab] = useState<TabKey>(initial)

  const { data, isLoading } = api.dashboard.getHistory.useQuery()

  const chartData = (data ?? []).map((r, i) => ({
    label: r.testName.length > 14 ? r.testName.slice(0, 14) + "…" : r.testName,
    testId: r.testId,
    testName: r.testName,
    avgResponseTime: r.avgResponseTime,
    successRate: r.successRate,
    failedRequests: r.failedRequests,
    totalRequests: r.totalRequests,
    index: i + 1,
    urlBreakdown: r.urlBreakdown,
  }))

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
        <p className="mt-1 text-sm text-gray-600">Detailed breakdown of your load testing metrics</p>
      </div>

      {/* Tab bar */}
      <div className="mb-6 flex gap-2 overflow-x-auto border-b border-gray-200 pb-0">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === key
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20 text-gray-500">Loading…</div>
      )}

      {!isLoading && data && (
        <>
          {activeTab === "total-tests" && <TotalTestsView data={chartData} />}
          {activeTab === "response-time" && <ResponseTimeView data={chartData} />}
          {activeTab === "success-rate" && <SuccessRateView data={chartData} />}
          {activeTab === "failed-requests" && <FailedRequestsView data={chartData} />}
        </>
      )}
    </main>
  )
}

/* ─── Total Tests ─────────────────────────────────────────────────────────── */
function TotalTestsView({ data }: { data: ReturnType<typeof buildChartData> }) {
  const byName = data.reduce<Record<string, number>>((acc, d) => {
    acc[d.label] = (acc[d.label] ?? 0) + 1
    return acc
  }, {})
  const barData = Object.entries(byName).map(([name, count]) => ({ name, count }))

  return (
    <div className="space-y-6">
      <SummaryCard
        title="Total Tests Run"
        value={String(data.length)}
        description="Across all time"
        icon={Activity}
        color="text-purple-600"
      />
      <Card>
        <CardHeader>
          <CardTitle>Tests by Name</CardTitle>
          <CardDescription>Number of runs per test target</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" stroke="#6b7280" tick={{ fontSize: 12 }} />
              <YAxis stroke="#6b7280" allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8 }} />
              <Bar dataKey="count" name="Runs" fill="#9333ea" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <TestHistoryTable data={data} />
    </div>
  )
}

/* ─── Response Time ───────────────────────────────────────────────────────── */
function ResponseTimeView({ data }: { data: ReturnType<typeof buildChartData> }) {
  const avg = data.length ? Math.round(data.reduce((s, d) => s + d.avgResponseTime, 0) / data.length) : 0
  return (
    <div className="space-y-6">
      <SummaryCard
        title="Average Response Time"
        value={`${avg}ms`}
        description="Mean across all tests"
        icon={Clock}
        color="text-blue-600"
      />
      <Card>
        <CardHeader>
          <CardTitle>Response Time Trend</CardTitle>
          <CardDescription>Avg response time (ms) per test run</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" stroke="#6b7280" tick={{ fontSize: 12 }} />
              <YAxis stroke="#6b7280" unit="ms" />
              <Tooltip contentStyle={{ borderRadius: 8 }} formatter={(v: any) => [`${v}ms`, "Avg Response"]} />
              <Line type="monotone" dataKey="avgResponseTime" name="Avg Response" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <TestHistoryTable data={data} />
    </div>
  )
}

/* ─── Success Rate ────────────────────────────────────────────────────────── */
function SuccessRateView({ data }: { data: ReturnType<typeof buildChartData> }) {
  const avg = data.length ? Number((data.reduce((s, d) => s + d.successRate, 0) / data.length).toFixed(1)) : 0
  return (
    <div className="space-y-6">
      <SummaryCard
        title="Average Success Rate"
        value={`${avg}%`}
        description="Mean across all tests"
        icon={CheckCircle2}
        color="text-green-600"
      />
      <Card>
        <CardHeader>
          <CardTitle>Success Rate Trend</CardTitle>
          <CardDescription>Success % per test run</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" stroke="#6b7280" tick={{ fontSize: 12 }} />
              <YAxis stroke="#6b7280" unit="%" domain={[0, 100]} />
              <Tooltip contentStyle={{ borderRadius: 8 }} formatter={(v: any) => [`${v}%`, "Success Rate"]} />
              <Line type="monotone" dataKey="successRate" name="Success Rate" stroke="#22c55e" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
      <TestHistoryTable data={data} />
    </div>
  )
}

/* ─── Failed Requests ─────────────────────────────────────────────────────── */
function FailedRequestsView({ data }: { data: ReturnType<typeof buildChartData> }) {
  const total = data.reduce((s, d) => s + d.failedRequests, 0)
  return (
    <div className="space-y-6">
      <SummaryCard
        title="Total Failed Requests"
        value={total.toLocaleString()}
        description="Across all tests"
        icon={XCircle}
        color="text-red-600"
      />
      <Card>
        <CardHeader>
          <CardTitle>Failed Requests per Test</CardTitle>
          <CardDescription>Number of failed requests in each test run</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" stroke="#6b7280" tick={{ fontSize: 12 }} />
              <YAxis stroke="#6b7280" allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8 }} />
              <Bar dataKey="failedRequests" name="Failed" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* URL breakdown for tests that have failures */}
      {data.filter(d => d.failedRequests > 0).map(d => (
        <Card key={d.testId} className="border-red-100">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{d.testName}</CardTitle>
              <Link
                href={`/results/${d.testId}#url-breakdown`}
                className="text-sm text-purple-600 hover:underline"
              >
                View Full Results →
              </Link>
            </div>
            <CardDescription>{d.failedRequests} failed / {d.totalRequests} total</CardDescription>
          </CardHeader>
          <CardContent>
            {d.urlBreakdown && Object.keys(d.urlBreakdown).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(d.urlBreakdown).map(([url, metric]: [string, any]) => (
                  <div key={url} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex items-center justify-between">
                      <code className="text-xs text-gray-800 break-all">{url}</code>
                      <Badge className={metric.successRate >= 99 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                        {Number(metric.successRate).toFixed(1)}% success
                      </Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600">
                      <span>Requests: <strong>{metric.requests ?? 0}</strong></span>
                      <span>Avg Time: <strong>{metric.avgResponseTime ?? 0}ms</strong></span>
                    </div>
                    {Array.isArray(metric.errors) && metric.errors.length > 0 && (
                      <div className="mt-2 border-t border-gray-100 pt-2">
                        <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-red-700">
                          <AlertCircle className="h-3 w-3" /> Errors
                        </p>
                        <ul className="space-y-1">
                          {metric.errors.map((err: any, i: number) => (
                            <li key={i} className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-900">
                              {err.message} — <Badge className="bg-red-100 text-red-700 text-xs">{err.statusCode} × {err.count}</Badge>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No URL breakdown available.</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/* ─── Shared helpers ──────────────────────────────────────────────────────── */
function buildChartData(data: any[]) { return data }

function SummaryCard({ title, value, description, icon: Icon, color }: {
  title: string; value: string; description: string; icon: any; color: string
}) {
  return (
    <Card className="border-gray-200">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">{title}</CardTitle>
        <Icon className={`h-5 w-5 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-gray-900">{value}</div>
        <p className="mt-1 text-xs text-gray-500">{description}</p>
      </CardContent>
    </Card>
  )
}

function TestHistoryTable({ data }: { data: any[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>All Test Runs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-xs font-medium text-gray-500 uppercase">
                <th className="pb-2 pr-4">Test Name</th>
                <th className="pb-2 pr-4">Requests</th>
                <th className="pb-2 pr-4">Avg Response</th>
                <th className="pb-2 pr-4">Success Rate</th>
                <th className="pb-2 pr-4">Failures</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.map((d) => (
                <tr key={d.testId} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-2 pr-4 font-medium text-gray-900">{d.testName}</td>
                  <td className="py-2 pr-4 text-gray-600">{d.totalRequests.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-gray-600">{d.avgResponseTime}ms</td>
                  <td className="py-2 pr-4">
                    <span className={d.successRate >= 99 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                      {d.successRate}%
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-red-600 font-medium">{d.failedRequests}</td>
                  <td className="py-2">
                    <Link
                      href={`/results/${d.testId}#url-breakdown`}
                      className="text-purple-600 hover:underline"
                    >
                      Details →
                    </Link>
                  </td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">No test results yet</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
