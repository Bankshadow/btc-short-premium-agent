import RiskReplayDashboard from "@/components/risk-replay/RiskReplayDashboard";

export const metadata = {
  title: "Risk Replay | BTC Desk",
  description:
    "Simulation-only what-if replay for closed PAPER/TESTNET trades under alternative risk and exit rules.",
};

export default async function RiskReplayPage({
  searchParams,
}: {
  searchParams: Promise<{ tradeId?: string }>;
}) {
  const params = await searchParams;
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <RiskReplayDashboard initialTradeId={params.tradeId} />
    </main>
  );
}
