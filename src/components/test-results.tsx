"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Badge } from "~/components/ui/badge"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { CheckCircle2, Clock, TrendingUp, AlertCircle } from "lucide-react"

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
  const overallSuccessRate = results.totalRequests
    ? (results.successfulRequests / results.totalRequests) * 100
    : 0;
  const isSuccess = overallSuccessRate >= 99; // Define what constitutes "success"

  const overviewMetrics = [
    { title: "Total Requests", value: results.totalRequests.toLocaleString(), icon: TrendingUp, color: "text-purple-600" },
    { title: "Avg Response Time", value: `${results.avgResponseTime}ms`, icon: Clock, color: "text-blue-600" },
    { title: "Success Rate", value: `${overallSuccessRate.toFixed(1)}%`, icon: CheckCircle2, color: "text-green-600" },
    { title: "Errors", value: results.failedRequests.toLocaleString(), icon: AlertCircle, color: "text-red-600" },
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
          <Badge className={isSuccess ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-100 text-red-700 hover:bg-red-200"}>
            {isSuccess ? <CheckCircle2 className="mr-1 h-3 w-3" /> : <AlertCircle className="mr-1 h-3 w-3" />}
            {isSuccess ? "Success" : "Failed"}
          </Badge>
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
                  {Array.isArray(urlMetric.errors) && urlMetric.errors.length > 0 && (
                    <div className="mt-3 border-t border-gray-200 pt-3">
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-red-700">
                        <AlertCircle className="h-3 w-3" />
                        Errors
                      </div>
                      <ul className="space-y-1.5">
                        {urlMetric.errors.map((err: any, i: number) => (
                          <li key={i} className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs">
                            <div className="flex items-start justify-between gap-2">
                              <code className="break-all text-red-900">{err.message}</code>
                              <Badge variant="destructive" className="shrink-0 bg-red-100 text-red-700 hover:bg-red-200">
                                {err.statusCode} × {err.count}
                              </Badge>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
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