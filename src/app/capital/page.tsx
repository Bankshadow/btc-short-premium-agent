import AdvancedModuleLayout from "@/components/advanced/AdvancedModuleLayout";
import CapitalDashboard from "@/components/capital/CapitalDashboard";

export const metadata = {
  title: "Capital · BTC Premium Trading Desk",
  description:
    "MVP 12 capital stage manager — $1k to $20k mission planning and simulation only.",
};

export default function CapitalPage() {
  return (
    <main className="min-h-full bg-zinc-950">
      <AdvancedModuleLayout moduleId="capital">
        <CapitalDashboard />
      </AdvancedModuleLayout>
    </main>
  );
}
