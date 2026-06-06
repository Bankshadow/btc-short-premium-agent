import TradesView from "@/components/goal/TradesView";

export const metadata = {
  title: "Trades · AI Trading Mission",
  description: "All AI trades across paper, testnet, and live (shown separately).",
};

export default function TradesPage() {
  return (
    <main className="desk-root min-h-screen">
      <TradesView />
    </main>
  );
}
