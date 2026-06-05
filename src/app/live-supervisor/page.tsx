import LiveSupervisorDashboard from "@/components/live-supervisor/LiveSupervisorDashboard";

export const metadata = {
  title: "Live Supervisor | BTC Desk",
  description:
    "Monitor open live positions with thesis, risk, and actionable recommendations — human approval required.",
};

export default function LiveSupervisorPage() {
  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <LiveSupervisorDashboard />
    </main>
  );
}
