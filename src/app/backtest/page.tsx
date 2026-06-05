import HistoricalBacktestDashboard from "@/components/historical-backtest/HistoricalBacktestDashboard";

export const metadata = {
  title: "Historical Backtest | BTC Desk",
  description: "Server-side historical replay for strategy and rule validation — simulation only.",
};

export default function BacktestPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <HistoricalBacktestDashboard />
    </main>
  );
}
