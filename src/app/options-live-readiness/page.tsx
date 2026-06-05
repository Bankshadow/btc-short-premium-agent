import OptionsLiveReadinessDashboard from "@/components/options-execution/OptionsLiveReadinessDashboard";

export const metadata = {
  title: "Options Live Readiness · BTC Premium Trading Desk",
  description:
    "BTC options live preview and testnet preparation — real execution disabled.",
};

export default function OptionsLiveReadinessPage() {
  return (
    <main className="desk-root min-h-screen">
      <OptionsLiveReadinessDashboard />
    </main>
  );
}
