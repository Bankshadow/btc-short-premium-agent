import WorkspaceDashboard from "@/components/trading-os/WorkspaceDashboard";

export const metadata = {
  title: "Workspace · Trading OS",
  description: "Desk profiles and environment modes for the AI Trading Desk OS.",
};

export default function WorkspacePage() {
  return (
    <main className="min-h-full bg-zinc-950">
      <WorkspaceDashboard />
    </main>
  );
}
