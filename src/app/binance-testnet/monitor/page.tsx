import TestnetMonitorDashboard from "@/components/testnet-monitor/TestnetMonitorDashboard";

export const metadata = {
  title: "Binance Testnet Monitor | Desk",
  description: "Alias for AI Testnet Trade Monitor — Binance USD-M Futures testnet.",
};

export default function BinanceTestnetMonitorPage() {
  return <TestnetMonitorDashboard activePath="/binance-testnet/monitor" />;
}
