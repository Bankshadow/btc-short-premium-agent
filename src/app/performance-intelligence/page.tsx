import PerformanceIntelligenceDashboard from "@/components/performance-intelligence/PerformanceIntelligenceDashboard";

export const metadata = {
  title: "Performance Intelligence · BTC Premium Trading Desk",
  description:
    "AI performance intelligence — improvement trends, version comparisons, and agent contribution.",
};

export default function PerformanceIntelligencePage() {
  return (
    <main className="desk-root min-h-screen">
      <PerformanceIntelligenceDashboard />
    </main>
  );
}
