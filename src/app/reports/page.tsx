import ReportsDashboard from "@/components/trading-os/ReportsDashboard";

export const metadata = {
  title: "Reports · Trading OS",
  description: "Export desk reports — daily, weekly, scoreboard, incidents.",
};

export default function ReportsPage() {
  return (
    <main className="min-h-full bg-zinc-950">
      <ReportsDashboard />
    </main>
  );
}
