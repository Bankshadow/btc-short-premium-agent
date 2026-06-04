import CouncilDashboard from "@/components/council/CouncilDashboard";

export const metadata = {
  title: "Strategy Council · BTC Premium Trading Desk",
  description:
    "AI Strategy Council — self-improving desk proposals for the $1k to $20k mission.",
};

export default function CouncilPage() {
  return (
    <main className="desk-root min-h-screen">
      <CouncilDashboard />
    </main>
  );
}
