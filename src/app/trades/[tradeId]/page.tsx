import TradeLifecycleTimelinePage from "@/components/trades/TradeLifecycleTimelinePage";

export const metadata = {
  title: "Trade lifecycle timeline | Desk",
  description:
    "End-to-end trade timeline across AI signal, decision, preview, execution, close, PnL, and learning.",
};

export default async function TradeTimelinePage({
  params,
}: {
  params: Promise<{ tradeId: string }>;
}) {
  const { tradeId } = await params;
  return <TradeLifecycleTimelinePage tradeId={tradeId} />;
}
