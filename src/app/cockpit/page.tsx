import AnalyzeDashboard from "@/components/dashboard/AnalyzeDashboard";

export const metadata = {
  title: "Cockpit · BTC Premium Trading Desk",
  description:
    "Full multi-agent cockpit — bull/bear thesis, derivatives, risk veto, committee verdict. Advanced view.",
};

export default function CockpitPage() {
  return (
    <main className="mx-auto w-full max-w-[1600px] px-2 py-3 sm:px-4 sm:py-4">
      <AnalyzeDashboard macroView="bearish" />
    </main>
  );
}
