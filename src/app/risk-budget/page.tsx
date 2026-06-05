import RiskBudgetDashboard from "@/components/risk-budget/RiskBudgetDashboard";

export const metadata = {
  title: "Risk Budget | BTC Desk",
  description: "Portfolio-aware risk budget and position sizing optimizer.",
};

export default function RiskBudgetPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <RiskBudgetDashboard />
    </main>
  );
}
