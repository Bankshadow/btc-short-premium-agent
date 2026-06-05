import MemoryGraphDashboard from "@/components/memory-graph/MemoryGraphDashboard";

export const metadata = {
  title: "Memory Graph · BTC Premium Trading Desk",
  description:
    "Structured agent memory graph from decisions, outcomes, and reflections — advisory only.",
};

export default function MemoryGraphPage() {
  return (
    <main className="desk-root min-h-screen">
      <MemoryGraphDashboard />
    </main>
  );
}
