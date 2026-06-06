import { Suspense } from "react";
import QuantBacktestDashboard from "@/components/strategy-lab/QuantBacktestDashboard";

export const metadata = {
  title: "Quant Backtest · Strategy Lab",
  description:
    "Backtest imported quant strategies on BTC/SOL historical data with fees and slippage.",
};

export default function StrategyLabBacktestPage() {
  return (
    <main className="desk-root min-h-screen">
      <Suspense fallback={<div className="p-8 text-sm text-zinc-500">Loading backtest lab…</div>}>
        <QuantBacktestDashboard />
      </Suspense>
    </main>
  );
}
