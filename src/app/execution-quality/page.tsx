import ExecutionQualityDashboard from "@/components/execution-quality/ExecutionQualityDashboard";

export const metadata = {
  title: "Execution Quality · BTC Premium Trading Desk",
  description:
    "Monitor execution quality for Binance Testnet and live journal telemetry. Read-only.",
};

export default function ExecutionQualityPage() {
  return (
    <main className="desk-root min-h-screen">
      <ExecutionQualityDashboard />
    </main>
  );
}

