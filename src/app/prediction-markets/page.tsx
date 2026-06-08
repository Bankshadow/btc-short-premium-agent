import PredictionMarketArbDashboard from "@/components/prediction-market-arbitrage/PredictionMarketArbDashboard";

export const metadata = {
  title: "Prediction Market Arb · AI Trading Desk",
  description:
    "Polymarket-style arbitrage scanner — binary and multi-outcome mispricing, depth, resolution risk, paper only.",
};

export default function PredictionMarketsPage() {
  return (
    <main className="desk-root min-h-screen">
      <PredictionMarketArbDashboard />
    </main>
  );
}
