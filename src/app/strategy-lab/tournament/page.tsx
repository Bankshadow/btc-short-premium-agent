import StrategyTournamentDashboard from "@/components/strategy-lab/StrategyTournamentDashboard";

export const metadata = {
  title: "Strategy Tournament · Strategy Lab",
  description:
    "Rank imported quant strategies on the same BTC/SOL historical dataset.",
};

export default function StrategyLabTournamentPage() {
  return (
    <main className="desk-root min-h-screen">
      <StrategyTournamentDashboard />
    </main>
  );
}
