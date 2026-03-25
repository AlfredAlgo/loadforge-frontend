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
    }>;
    phaseMetrics: {
      rampUp: { avgResponseTime: number; successRate: number; };
      steady: { avgResponseTime: number; successRate: number; };
      rampDown: { avgResponseTime: number; successRate: number; };
    };
  };
}
export const  TestResults: React.FC<TestResultsProps> = ({ results }) => {
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

       <div className="mb-6">
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
