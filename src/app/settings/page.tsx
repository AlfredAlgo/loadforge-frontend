import { SettingsPage } from "~/components/settings-page"
import { DashboardNav } from "~/components/dashboard-nav"

export default function Settings() {
  return (
    <div className="min-h-screen">
      <DashboardNav />
      <SettingsPage />
    </div>
  )
}
