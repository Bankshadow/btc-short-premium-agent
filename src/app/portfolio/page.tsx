import PortfolioDashboard from "@/components/portfolio/PortfolioDashboard";

export const metadata = {
  title: "Portfolio · BTC Premium Trading Desk",
  description:
    "Unified paper portfolio — BTC options and multi-asset perp positions with decision log traceability.",
};

export default function PortfolioPage() {
  return (
    <main className="desk-root min-h-screen">
      <PortfolioDashboard />
    </main>
  );
}
