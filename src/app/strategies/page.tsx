import AdvancedModuleLayout from "@/components/advanced/AdvancedModuleLayout";
import StrategiesDashboard from "@/components/strategies/StrategiesDashboard";

export const metadata = {
  title: "Strategies · BTC Premium Trading Desk",
  description:
    "MVP 13 strategy skill registry — promote, demote, disable, and link draft rules.",
};

export default function StrategiesPage() {
  return (
    <main className="min-h-full bg-zinc-950">
      <AdvancedModuleLayout moduleId="strategy-registry">
        <StrategiesDashboard />
      </AdvancedModuleLayout>
    </main>
  );
}
