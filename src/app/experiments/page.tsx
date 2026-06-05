import ExperimentsDashboard from "@/components/experiments/ExperimentsDashboard";

export const metadata = {
  title: "Experiment Lab · BTC Premium Trading Desk",
  description:
    "Isolated strategy experiment sandbox — replay and shadow mode only.",
};

export default function ExperimentsPage() {
  return (
    <main className="desk-root min-h-screen">
      <ExperimentsDashboard />
    </main>
  );
}
