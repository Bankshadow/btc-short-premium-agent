import LiveEvidenceDashboard from "@/components/live-evidence/LiveEvidenceDashboard";

export const metadata = {
  title: "Live Evidence Pack · BTC Premium Trading Desk",
  description:
    "Evidence-based live readiness pack for micro pilot. Read-only recommendation report.",
};

export default function LiveEvidencePage() {
  return (
    <main className="desk-root min-h-screen">
      <LiveEvidenceDashboard />
    </main>
  );
}
