import LiveReadinessDashboard from "@/components/live-readiness/LiveReadinessDashboard";

export const metadata = {
  title: "Live Readiness · BTC Premium Trading Desk",
  description:
    "Pre-flight checklist for small live perp pilot — read-only, cannot enable live execution.",
};

export default function LiveReadinessPage() {
  return (
    <main className="desk-root min-h-screen">
      <LiveReadinessDashboard />
    </main>
  );
}
