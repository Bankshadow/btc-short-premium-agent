import LearningDashboard from "@/components/learning/LearningDashboard";

export const metadata = {
  title: "Self-Learning · BTC Premium Trading Desk",
  description:
    "Post-trade agent evaluation engine — advisory only, cannot auto-change live trading.",
};

export default function LearningPage() {
  return (
    <main className="desk-root min-h-screen">
      <LearningDashboard />
    </main>
  );
}
