import SimulationDashboard from "@/components/simulation/SimulationDashboard";

export const metadata = {
  title: "Simulation · BTC Premium Trading Desk",
  description: "Capital risk and rule impact simulators — advisory only.",
};

export default function SimulationPage() {
  return (
    <main className="desk-root min-h-screen">
      <SimulationDashboard />
    </main>
  );
}
