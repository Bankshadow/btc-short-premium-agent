import MultiAssetDashboard from "@/components/multi-asset/MultiAssetDashboard";

export const metadata = {
  title: "Assets · BTC Premium Trading Desk",
  description:
    "Multi-asset perp directional scanner (BTC/SOL/WLD/LINK/DOGE) — paper-first, analysis-only.",
};

export default function AssetsPage() {
  return (
    <main className="desk-root min-h-screen">
      <MultiAssetDashboard />
    </main>
  );
}
