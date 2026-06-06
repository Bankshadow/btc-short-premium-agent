import ReportsView from "@/components/goal/ReportsView";

export const metadata = {
  title: "Reports · AI Profit Mission",
  description: "Daily and weekly summaries, goal progress, PnL, and AI recommendations.",
};

export default function ReportsPage() {
  return (
    <main className="desk-root min-h-screen">
      <ReportsView />
    </main>
  );
}
