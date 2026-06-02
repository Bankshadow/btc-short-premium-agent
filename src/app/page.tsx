import AnalyzeDashboard from "@/components/dashboard/AnalyzeDashboard";
import { getMockDashboardData } from "@/lib/mock/dashboard-data";

export default function Home() {
  const initialData = getMockDashboardData();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
      <AnalyzeDashboard initialData={initialData} macroView="bearish" />
    </main>
  );
}
