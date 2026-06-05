import AdaptationDashboard from "@/components/adaptation/AdaptationDashboard";

export const metadata = {
  title: "Adaptation · BTC Premium Trading Desk",
  description:
    "Strategy adaptation engine — paper outcome analysis and human-approved registry changes.",
};

export default function AdaptationPage() {
  return (
    <main className="desk-root min-h-screen">
      <AdaptationDashboard />
    </main>
  );
}
