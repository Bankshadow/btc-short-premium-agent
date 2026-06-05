import MarketRegimeBrainDashboard from "@/components/market-regime-brain/MarketRegimeBrainDashboard";

export const metadata = {
  title: "Regime Brain · BTC Premium Trading Desk",
  description:
    "Market regime intelligence — classification, evidence, and strategy routing.",
};

export default function RegimeBrainPage() {
  return (
    <main className="desk-root min-h-screen">
      <MarketRegimeBrainDashboard />
    </main>
  );
}
