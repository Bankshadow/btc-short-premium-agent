import AnalyzeDashboard from "@/components/dashboard/AnalyzeDashboard";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-[1600px] px-2 py-3 sm:px-4 sm:py-4">
      <AnalyzeDashboard macroView="bearish" />
    </main>
  );
}
