import type { MispricingSignal, PaperTradeRecord, PolymarketMarket } from "./types";

function newTradeId(): string {
  return `ptrade-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function simulatePaperFill(input: {
  signal: MispricingSignal;
  market: PolymarketMarket;
}): PaperTradeRecord {
  const { signal, market } = input;
  const now = new Date().toISOString();
  const spread = market.bestAskYes - market.bestBidYes;
  const liquidityCap = market.liquidity * 0.02;
  const size = Math.min(signal.suggestedSizeSimulated, liquidityCap);

  let entry = signal.suggestedPrice;
  let fillStatus: PaperTradeRecord["fillStatus"] = "SIMULATED";
  let fillReason = "Simulated fill at suggested price.";

  if (spread > 0.06 || market.liquidity < 500) {
    fillStatus = "PARTIAL";
    entry = signal.side.includes("BUY")
      ? entry + spread * 0.25
      : entry - spread * 0.25;
    fillReason = "Partial fill — wide spread or low liquidity slippage applied.";
  }

  if (size <= 0) {
    fillStatus = "REJECTED";
    fillReason = "Rejected — insufficient simulated liquidity.";
  }

  const currentPrice = signal.side.includes("YES")
    ? (market.bestBidYes + market.bestAskYes) / 2
    : (market.bestBidNo + market.bestAskNo) / 2;

  const direction = signal.side.startsWith("BUY") ? 1 : -1;
  const unrealized =
    fillStatus === "REJECTED"
      ? 0
      : (currentPrice - entry) * direction * size;

  return {
    tradeId: newTradeId(),
    signalId: signal.signalId,
    marketId: signal.marketId,
    side: signal.side,
    simulatedEntryPrice: Number(entry.toFixed(4)),
    simulatedSize: Number(size.toFixed(2)),
    estimatedEdgeAtEntry: signal.estimatedEdge,
    confidenceAtEntry: signal.confidence,
    fillStatus,
    fillReason,
    exitPrice: null,
    currentPrice: Number(currentPrice.toFixed(4)),
    realizedPnl: 0,
    unrealizedPnl: Number(unrealized.toFixed(4)),
    status: fillStatus === "REJECTED" ? "CANCELLED" : "OPEN",
    createdAt: now,
    updatedAt: now,
  };
}

export function markPaperTradesToMarket(input: {
  trades: PaperTradeRecord[];
  markets: PolymarketMarket[];
}): PaperTradeRecord[] {
  const byId = new Map(input.markets.map((m) => [m.marketId, m]));
  const now = new Date().toISOString();
  return input.trades.map((t) => {
    if (t.status !== "OPEN") return t;
    const market = byId.get(t.marketId);
    if (!market) return t;
    const currentPrice = t.side.includes("YES")
      ? (market.bestBidYes + market.bestAskYes) / 2
      : (market.bestBidNo + market.bestAskNo) / 2;
    const direction = t.side.startsWith("BUY") ? 1 : -1;
    const unrealized = (currentPrice - t.simulatedEntryPrice) * direction * t.simulatedSize;
    return {
      ...t,
      currentPrice: Number(currentPrice.toFixed(4)),
      unrealizedPnl: Number(unrealized.toFixed(4)),
      updatedAt: now,
    };
  });
}

export function closePaperTrade(trade: PaperTradeRecord, exitPrice: number): PaperTradeRecord {
  const direction = trade.side.startsWith("BUY") ? 1 : -1;
  const realized = (exitPrice - trade.simulatedEntryPrice) * direction * trade.simulatedSize;
  return {
    ...trade,
    exitPrice: Number(exitPrice.toFixed(4)),
    currentPrice: Number(exitPrice.toFixed(4)),
    realizedPnl: Number(realized.toFixed(4)),
    unrealizedPnl: 0,
    status: "CLOSED",
    updatedAt: new Date().toISOString(),
  };
}
