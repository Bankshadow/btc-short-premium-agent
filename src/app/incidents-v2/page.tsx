import IncidentsV2Dashboard from "@/components/incidents-v2/IncidentsV2Dashboard";

export const metadata = {
  title: "Incidents V2 · BTC Premium Trading Desk",
  description:
    "Auto incident and anomaly detection for testnet/paper/live-prep operations.",
};

export default function IncidentsV2Page() {
  return (
    <main className="min-h-full bg-zinc-950">
      <IncidentsV2Dashboard />
    </main>
  );
}
