import LivePilotDashboard from "@/components/live-pilot/LivePilotDashboard";

export const metadata = {
  title: "Live Pilot · BTC Premium Trading Desk",
  description:
    "Small live perp pilot — strict caps, human approval, full journal. BTC options live unavailable.",
};

export default function LivePilotPage() {
  return (
    <main className="desk-root min-h-screen">
      <LivePilotDashboard />
    </main>
  );
}
