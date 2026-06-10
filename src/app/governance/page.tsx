import AdvancedModuleLayout from "@/components/advanced/AdvancedModuleLayout";
import GovernanceDashboard from "@/components/governance/GovernanceDashboard";

export const metadata = {
  title: "Governance · BTC Premium Trading Desk",
  description: "MVP 14 safety controls, kill switch, and operator override audit.",
};

export default function GovernancePage() {
  return (
    <main className="min-h-full bg-zinc-950">
      <AdvancedModuleLayout moduleId="governance">
        <GovernanceDashboard />
      </AdvancedModuleLayout>
    </main>
  );
}
