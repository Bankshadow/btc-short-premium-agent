import TestnetMonitorDashboard from "@/components/testnet-monitor/TestnetMonitorDashboard";

export const metadata = {
  title: "AI Testnet Trade Monitor | Desk",
  description:
    "Monitor Binance testnet positions, orders, PnL, and AI decision linkage. TESTNET only.",
};

export default function TestnetMonitorPage() {
  return <TestnetMonitorDashboard activePath="/testnet-monitor" />;
}
