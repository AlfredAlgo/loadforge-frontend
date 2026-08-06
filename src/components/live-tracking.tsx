"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Badge } from "~/components/ui/badge"
import { Progress } from "~/components/ui/progress"
import { Activity, Clock, TrendingUp, AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { useLiveTestTracking, type LiveTestData } from "~/hooks/useLiveTestTracking"

export function LiveTracking() {
  const { isConnected, isTestRunning, tests, runningTests, error } = useLiveTestTracking()

  const getStatusBadge = (status: LiveTestData["status"]) => {
    switch (status) {
      case "running":
        return (
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Running
          </Badge>
        )
      case "completed":
        return (
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Completed
          </Badge>
        )
      case "failed":
        return (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
            <AlertCircle className="mr-1 h-3 w-3" />
            Failed
          </Badge>
        )
      default:
        return (
          <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            Status Unknown
          </Badge>
        )
    }
  }

  const renderTestCard = (test: LiveTestData) => {
    const progress = test.currentPhase
      ? (test.currentPhase.phase / test.currentPhase.total_phases) * 100
      : test.status === "completed"
        ? 100
        : 0

    const currentPhaseLabel = test.currentPhase
      ? `Phase ${test.currentPhase.phase}/${test.currentPhase.total_phases}`
      : test.status === "completed"
        ? "Test Complete"
        : test.status === "failed"
          ? "Test Failed"
          : "Waiting for data..."

    const metrics = test.currentPhase
      ? {
          totalRequests: test.currentPhase.requests,
          successRate:
            test.currentPhase.requests > 0
              ? (test.currentPhase.success_count / test.currentPhase.requests) * 100
              : 0,
          avgResponseTime: test.currentPhase.percentiles.p50,
          currentConcurrency: test.currentPhase.concurrency,
        }
      : {
          totalRequests: 0,
          successRate: 0,
          avgResponseTime: 0,
          currentConcurrency: 0,
        }

    return (
      <Card key={test.test_id} className="border-gray-200">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-gray-900">
                {test.name || `Test ${test.test_id.slice(0, 8)}`}
              </CardTitle>
              <CardDescription className="mt-1 flex items-center gap-4 text-gray-600">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Started: {formatTime(test.startTime.toISOString())}
                </span>
                <span>Elapsed: {getElapsedTime(test.startTime.toISOString())}</span>
              </CardDescription>
            </div>
            {getStatusBadge(test.status)}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {test.error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {test.error}
            </div>
          )}
          <div>
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-gray-700">{currentPhaseLabel}</span>
              <span className="text-gray-600">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {test.currentPhase && (
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Activity className="h-4 w-4" />
                  Total Requests
                </div>
                <div className="mt-2 text-2xl font-bold text-gray-900">
                  {metrics.totalRequests.toLocaleString()}
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Success Rate
                </div>
                <div className="mt-2 text-2xl font-bold text-gray-900">
                  {metrics.successRate.toFixed(1)}%
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="h-4 w-4" />
                  Avg Response
                </div>
                <div className="mt-2 text-2xl font-bold text-gray-900">
                  {Math.round(metrics.avgResponseTime)}ms
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <TrendingUp className="h-4 w-4" />
                  Concurrency
                </div>
                <div className="mt-2 text-2xl font-bold text-gray-900">
                  {metrics.currentConcurrency}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    return date.toLocaleTimeString()
  }

  const getElapsedTime = (startTime: string) => {
    const elapsed = Date.now() - new Date(startTime).getTime()
    const seconds = Math.floor(elapsed / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Live Test Tracking</h1>
            <p className="mt-1 text-sm text-gray-600">Monitor your running load tests in real-time</p>
          </div>
          <div
            className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm ${
              isConnected
                ? "bg-green-50 text-green-700"
                : "bg-yellow-50 text-yellow-700"
            }`}
          >
            <div
              className={`h-2 w-2 rounded-full ${
                isConnected ? "bg-green-500" : "bg-yellow-500"
              }`}
            />
            {isConnected
              ? "Connected"
              : "Connecting..."}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {tests.length === 0 && !isTestRunning && !error ? (
        <Card className="border-gray-200">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Activity className="mb-4 h-12 w-12 text-gray-400" />
            <p className="text-lg font-medium text-gray-900">No tests running</p>
            <p className="mt-1 text-sm text-gray-600">Start a new test to see live tracking here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {tests.length > 0 && (
            <>
              {runningTests.length > 0 && (
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Running Tests ({runningTests.length})
                  </h2>
                </div>
              )}
              {tests
                .filter((t) => t.status === "running")
                .map((test) => renderTestCard(test))}

              {tests.filter((t) => t.status !== "running").length > 0 && (
                <div className="mt-8 mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Recent Tests ({tests.filter((t) => t.status !== "running").length})
                  </h2>
                </div>
              )}
              {tests
                .filter((t) => t.status !== "running")
                .map((test) => renderTestCard(test))}
            </>
          )}
          {tests.length === 0 && isTestRunning && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              <p className="ml-4 text-lg font-medium text-gray-900">
                Test is running, awaiting data...
              </p>
            </div>
          )}
        </div>
      )}
    </main>
  )
}
