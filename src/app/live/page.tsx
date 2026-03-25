import { LiveTracking } from "~/components/live-tracking"
import { DashboardNav } from "~/components/dashboard-nav"

export default function LivePage() {
  return (
    <div className="min-h-screen">
      <DashboardNav />
      <LiveTracking />
    </div>
  )
}
