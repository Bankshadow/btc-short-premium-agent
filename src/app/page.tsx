import HomeDashboard from "@/components/dashboard/HomeDashboard";
import { getMockDashboardData } from "@/lib/mock/dashboard-data";

export default function Home() {
  const data = getMockDashboardData();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
      <HomeDashboard data={data} />
    </main>
  );
}
