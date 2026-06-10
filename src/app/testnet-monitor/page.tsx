import AdvancedModuleLayout from "@/components/advanced/AdvancedModuleLayout";
import TestnetMonitorDashboard from "@/components/testnet-monitor/TestnetMonitorDashboard";

export const metadata = {
  title: "AI Testnet Trade Monitor | Desk",
  description:
    "Monitor Binance testnet positions, orders, PnL, and AI decision linkage. TESTNET only.",
};

export default function TestnetMonitorPage() {
  return (
    <main className="min-h-full bg-zinc-950">
      <AdvancedModuleLayout moduleId="debug">
        <TestnetMonitorDashboard activePath="/testnet-monitor" />
      </AdvancedModuleLayout>
    </main>
  );
}
