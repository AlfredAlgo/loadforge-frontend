import { ScenarioConfiguration } from "~/components/scenario-configuration";
import { DashboardNav } from "~/components/dashboard-nav";

export default function ScenarioPage() {
  return (
    <div className="min-h-screen">
      <DashboardNav />
      <ScenarioConfiguration />
    </div>
  );
}
