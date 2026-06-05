import AutomationDashboard from "@/components/automation/AutomationDashboard";

export const metadata = {
  title: "Automation · BTC Premium Trading Desk",
  description: "AI desk orchestrator — runs all ops modules in one cycle.",
};

export default function AutomationPage() {
  return (
    <main className="desk-root min-h-screen">
      <AutomationDashboard />
    </main>
  );
}
