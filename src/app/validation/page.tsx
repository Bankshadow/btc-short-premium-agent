import ValidationDashboard from "@/components/validation/ValidationDashboard";

export const metadata = {
  title: "Validation · BTC Premium Trading Desk",
  description:
    "MVP 10 strategy performance matrix, capital allocation, and kill switch — measurement only.",
};

export default function ValidationPage() {
  return (
    <main className="min-h-full bg-zinc-950">
      <ValidationDashboard />
    </main>
  );
}
