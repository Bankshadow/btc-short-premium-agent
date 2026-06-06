import StrategyHealthDashboard from "@/components/strategy-health/StrategyHealthDashboard";

export const metadata = {
  title: "Strategy Health | BTC Desk",
  description:
    "MVP 52 strategy health dashboard with PAPER/SHADOW/TESTNET/LIVE metrics and actionable recommendations.",
};

export default function StrategyHealthPage() {
  return <StrategyHealthDashboard />;
}
