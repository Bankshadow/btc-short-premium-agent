import AutomationControlDashboard from "@/components/automation-control/AutomationControlDashboard";

export const metadata = {
  title: "Automation Control · BTC Premium Trading Desk",
  description:
    "P-MVP 4 automation control plane — scheduled desk jobs, failures, retry, and pause.",
};

export default function AutomationControlPage() {
  return (
    <main className="min-h-full bg-zinc-950">
      <AutomationControlDashboard />
    </main>
  );
}
