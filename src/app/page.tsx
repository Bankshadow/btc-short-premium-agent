import GoalDashboard from "@/components/goal/GoalDashboard";

export const metadata = {
  title: "$1,000 → $10,000 · AI Trading Mission",
  description:
    "Goal-first AI trading dashboard. Track progress from $1,000 to $10,000, current equity, trades, win rate, and what the AI is doing.",
};

export default function Home() {
  return (
    <main className="desk-root min-h-screen">
      <GoalDashboard />
    </main>
  );
}
