import MortemDashboard from "@/components/mortem/MortemDashboard";

export const metadata = {
  title: "Pre-Mortem & Regret · BTC Premium Trading Desk",
  description:
    "Pre-mortem before TRADE, loss autopsy after losses, and regret tracking — analysis only.",
};

export default function MortemPage() {
  return (
    <main className="desk-root min-h-screen">
      <MortemDashboard />
    </main>
  );
}
