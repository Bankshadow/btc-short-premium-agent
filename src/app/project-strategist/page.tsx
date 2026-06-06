import ProjectStrategistDashboard from "@/components/project-strategist/ProjectStrategistDashboard";

export const metadata = {
  title: "Project Strategist · BTC Premium Trading Desk",
  description:
    "Daily AI project diagnosis, skill research, and one-day MVP planning with safety guards.",
};

export default function ProjectStrategistPage() {
  return (
    <main className="min-h-full bg-zinc-950">
      <ProjectStrategistDashboard />
    </main>
  );
}
