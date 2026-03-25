import { TestConfiguration } from "~/components/test-configuration"
import { DashboardNav } from "~/components/dashboard-nav"

export default function TestPage() {
  return (
    <div className="min-h-screen">
      <DashboardNav />
      <TestConfiguration />
    </div>
  )
}
