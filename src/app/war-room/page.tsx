import WarRoomDashboard from "@/components/war-room/WarRoomDashboard";

export const metadata = {
  title: "War Room · BTC Premium Trading Desk",
  description: "Operator discipline, scenario drills, and emergency playbook.",
};

export default function WarRoomPage() {
  return (
    <main className="desk-root min-h-screen">
      <WarRoomDashboard />
    </main>
  );
}
