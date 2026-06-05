import CommandCenterDashboard from "@/components/command-center/CommandCenterDashboard";

export const metadata = {
  title: "Command Center | BTC Desk",
  description:
    "Production trading command center — desk status, blockers, and emergency controls.",
};

export default function CommandCenterPage() {
  return <CommandCenterDashboard />;
}
