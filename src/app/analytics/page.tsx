"use client"

import { Suspense } from "react"
import { DashboardNav } from "~/components/dashboard-nav"
import { AnalyticsOverview } from "~/components/analytics-overview"

export default function AnalyticsPage() {
  return (
    <div className="min-h-screen">
      <DashboardNav />
      <Suspense fallback={<div className="flex items-center justify-center py-20 text-gray-500">Loading…</div>}>
        <AnalyticsOverview />
      </Suspense>
    </div>
  )
}
