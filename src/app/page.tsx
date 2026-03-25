import { DashboardOverview } from "~/components/dashboard-overview"
import { DashboardNav } from "~/components/dashboard-nav"

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <DashboardNav />
      <DashboardOverview />
    </div>
  )
}
