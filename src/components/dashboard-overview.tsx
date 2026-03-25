"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { Activity, Clock, TrendingUp, CheckCircle2, XCircle, Play } from "lucide-react"
import Link from "next/link"
import { api } from "../trpc/react"

export function DashboardOverview() {
  const { data, isLoading, isError } = api.dashboard.getOverview.useQuery()


  const metrics = data
    ? [
        { title: "Total Tests Run", value: String(data.metrics.totalTests), change: "", trend: "up", icon: Activity },
        { title: "Avg Response Time", value: `${data.metrics.avgResponseTime}ms`, change: "", trend: "down", icon: Clock },
        { title: "Success Rate", value: `${data.metrics.successRate}%`, change: "", trend: "up", icon: CheckCircle2 },
        { title: "Failed Requests", value: String(data.metrics.failedRequests), change: "", trend: "down", icon: XCircle },
      ]
    : [
        { title: "Total Tests Run", value: "—", change: "", trend: "up", icon: Activity },
        { title: "Avg Response Time", value: "—", change: "", trend: "down", icon: Clock },
        { title: "Success Rate", value: "—", change: "", trend: "up", icon: CheckCircle2 },
        { title: "Failed Requests", value: "—", change: "", trend: "down", icon: XCircle },
      ]

  const recentTests = data
    ? data.recentTests
    : [
        { id: 0, name: "Loading...", status: "pending", duration: "—", requests: "—", successRate: "—", createdAt: null },
      ]


  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-600">Monitor your load testing performance</p>
        </div>
        <Link href="/test">
          <Button className="bg-linear-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700">
            <Play className="mr-2 h-4 w-4" />
            New Test
          </Button>
        </Link>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon
          return (
            <Card key={metric.title} className="border-gray-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">{metric.title}</CardTitle>
                <Icon className="h-4 w-4 text-gray-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-900">{metric.value}</div>
                <p className="flex items-center text-xs text-gray-600">
                  <TrendingUp className={`mr-1 h-3 w-3 ${metric.trend === "up" ? "text-green-600" : "text-red-600"}`} />
                  <span className={metric.trend === "up" ? "text-green-600" : "text-red-600"}>{metric.change}</span>
                  <span className="ml-1">from last week</span>
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <Card className="border-gray-200">
        <CardHeader>
          <CardTitle className="text-gray-900">Recent Tests</CardTitle>
          <CardDescription className="text-gray-600">Your latest load testing runs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentTests.map((test) => (
              <div key={test.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
                <div className="flex items-center gap-4">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                      test.status === "completed" ? "bg-green-100" : "bg-red-100"
                    }`}
                  >
                    {test.status === "completed" ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{test.name}</p>
                    <p className="text-sm text-gray-600">
                       {test.duration} • {String(test.requests).toLocaleString()} requests •{" "}
                      {test.createdAt ? new Date(test.createdAt).toLocaleString() : "—"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant={test.status === "completed" ? "default" : "destructive"}
                    className={
                      test.status === "completed"
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-red-100 text-red-700 hover:bg-red-200"
                    }
                  >
                    {test.successRate !== null ? `${test.successRate}%` : "—"}
                  </Badge>
                  <Link href={`/results/${test.id}`}>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-purple-600 hover:bg-purple-50 hover:text-purple-700"
                    >
                      View Details
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
