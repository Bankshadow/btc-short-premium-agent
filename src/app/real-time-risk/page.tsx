import RealTimeRiskDashboard from "@/components/real-time-risk/RealTimeRiskDashboard";

export const metadata = {
  title: "Real-Time Risk | BTC Desk",
  description:
    "Production real-time risk engine — exposure, margin, limits, and trade blocking.",
};

export default function RealTimeRiskPage() {
  return <RealTimeRiskDashboard />;
}
