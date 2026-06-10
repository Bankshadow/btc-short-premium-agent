import EngineHealthDashboard from "@/components/advanced/EngineHealthDashboard";

export const metadata = {
  title: "Engine Health · Advanced",
  description:
    "MVP 87 — central analysis engine health: inputs, writability, and source-of-truth alignment.",
};

export default function EngineHealthPage() {
  return <EngineHealthDashboard />;
}
