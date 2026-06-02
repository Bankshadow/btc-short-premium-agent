import AnalyzeDashboard from "@/components/dashboard/AnalyzeDashboard";
import { runAnalysisEngine } from "@/lib/decision/analyze";

export default async function Home() {
  const initialData = await runAnalysisEngine({ macroView: "bearish" });

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-4 py-8 sm:px-6 lg:px-8">
      <AnalyzeDashboard initialData={initialData} macroView="bearish" />
    </main>
  );
}
