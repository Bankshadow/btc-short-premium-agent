import DeskManagerDashboard from "@/components/desk-manager/DeskManagerDashboard";

export const metadata = {
  title: "Desk Manager · BTC Premium Trading Desk",
  description:
    "Autonomous AI desk manager — coordinates learning and ops cycles without live execution.",
};

export default function DeskManagerPage() {
  return (
    <main className="desk-root min-h-screen">
      <DeskManagerDashboard />
    </main>
  );
}
