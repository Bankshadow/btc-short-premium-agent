import StrategyShadowDashboard from "@/components/strategy-lab/StrategyShadowDashboard";

export const metadata = {
  title: "Strategy Shadow Mode · Strategy Lab",
  description:
    "Virtual shadow trades for quant strategies — no orders, evaluate before testnet.",
};

export default function StrategyLabShadowPage() {
  return (
    <main className="desk-root min-h-screen">
      <StrategyShadowDashboard />
    </main>
  );
}
