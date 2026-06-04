import PublicSummaryDashboard from "@/components/trading-os/PublicSummaryDashboard";

export const metadata = {
  title: "Public summary · Trading Desk",
  description: "Public performance summary — no operator or incident detail.",
};

export default function SummaryPage() {
  return (
    <main className="min-h-full bg-zinc-950">
      <PublicSummaryDashboard />
    </main>
  );
}
