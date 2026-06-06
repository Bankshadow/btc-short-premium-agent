import PoliciesDashboard from "@/components/policies/PoliciesDashboard";

export const metadata = {
  title: "Policies · BTC Premium Trading Desk",
  description:
    "P-MVP 5 risk and governance policy engine — rules, decisions, and blockers.",
};

export default function PoliciesPage() {
  return (
    <main className="min-h-full bg-zinc-950">
      <PoliciesDashboard />
    </main>
  );
}
