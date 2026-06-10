import AdvancedModuleLayout from "@/components/advanced/AdvancedModuleLayout";
import LedgerDashboard from "@/components/ledger/LedgerDashboard";

export const metadata = {
  title: "Trading Ledger · BTC Premium Trading Desk",
  description:
    "Unified trading ledger — decisions, orders, trades, risk, approvals, PnL, and learning outcomes.",
};

export default function LedgerPage() {
  return (
    <main className="min-h-full bg-zinc-950">
      <AdvancedModuleLayout moduleId="ledger">
        <LedgerDashboard />
      </AdvancedModuleLayout>
    </main>
  );
}
