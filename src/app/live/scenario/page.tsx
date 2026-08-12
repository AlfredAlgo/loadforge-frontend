import { ScenarioLiveTracking } from "~/components/scenario-live-tracking";
import { DashboardNav } from "~/components/dashboard-nav";

export default function ScenarioLivePage() {
  return (
    <div className="min-h-screen">
      <DashboardNav />
      <ScenarioLiveTracking />
    </div>
  );
}
