import QuantStrategyImporterDashboard from "@/components/strategy-lab/QuantStrategyImporterDashboard";

export const metadata = {
  title: "Quant Strategy Imports · Strategy Lab",
  description:
    "Research-only importer for external quant strategies — no live execution.",
};

export default function StrategyLabImportsPage() {
  return (
    <main className="desk-root min-h-screen">
      <QuantStrategyImporterDashboard />
    </main>
  );
}
