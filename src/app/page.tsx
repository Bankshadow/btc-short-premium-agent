import GoalDashboard from "@/components/goal/GoalDashboard";

export const metadata = {
  title: "AI Profit Mission · $1,000 → $10,000",
  description:
    "Goal-only dashboard. Track equity, progress %, trades, win rate, PnL, and what the AI is doing now.",
};

export default function Home() {
  return (
    <main className="desk-root min-h-screen">
      <GoalDashboard />
    </main>
  );
}
