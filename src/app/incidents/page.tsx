import IncidentsDashboard from "@/components/governance/IncidentsDashboard";

export const metadata = {
  title: "Incidents · BTC Premium Trading Desk",
  description: "MVP 14 incident review and post-mortems.",
};

export default function IncidentsPage() {
  return (
    <main className="min-h-full bg-zinc-950">
      <IncidentsDashboard />
    </main>
  );
}
