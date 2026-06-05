import RuleDiscoveryDashboard from "@/components/rule-discovery/RuleDiscoveryDashboard";

export const metadata = {
  title: "Rule Discovery · BTC Premium Trading Desk",
  description:
    "Auto rule discovery from historical outcomes — proposals require human approval.",
};

export default function RuleDiscoveryPage() {
  return (
    <main className="desk-root min-h-screen">
      <RuleDiscoveryDashboard />
    </main>
  );
}
