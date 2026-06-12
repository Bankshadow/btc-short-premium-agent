import type { PolymarketMarket } from "./types";
import type { SweeperOpportunity, SweeperPaperTrade } from "./sweeper-types";

function newTradeId(): string {
  return `swptrade-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function simulateSweeperPaperTrade(input: {
  opportunity: SweeperOpportunity;
  market: PolymarketMarket;
}): SweeperPaperTrade {
  const { opportunity, market } = input;
  const now = new Date().toISOString();
  const spread = market.bestAskYes - market.bestBidYes;

  let entry = opportunity.suggestedPrice;
  let fillStatus: SweeperPaperTrade["fillStatus"] = "SIMULATED";
  let fillReason = "Simulated sweep fill at suggested price.";
  let size = opportunity.suggestedSizeSimulated;

  if (opportunity.strategy === "BINARY_UNDER_ONE_ARB" && opportunity.secondaryPrice != null) {
    entry = opportunity.suggestedPrice + opportunity.secondaryPrice;
    fillReason = `Simulated bundle sweep: YES @ ${opportunity.suggestedPrice.toFixed(3)} + NO @ ${opportunity.secondaryPrice.toFixed(3)}.`;
  }

  if (spread > 0.1 || market.liquidity < 500) {
    fillStatus = "PARTIAL";
    size *= 0.6;
    fillReason += " Partial fill due to spread/liquidity.";
  }

  if (size <= 0) {
    fillStatus = "REJECTED";
    fillReason = "Rejected — zero simulated size.";
  }

  const unrealized = opportunity.estimatedEdge * size;

  return {
    tradeId: newTradeId(),
    opportunityId: opportunity.opportunityId,
    marketId: opportunity.marketId,
    strategy: opportunity.strategy,
    side: opportunity.side,
    simulatedEntryPrice: Number(entry.toFixed(4)),
    simulatedSecondaryPrice: opportunity.secondaryPrice,
    simulatedSize: Number(size.toFixed(2)),
    estimatedEdgeAtEntry: opportunity.estimatedEdge,
    confidenceAtEntry: opportunity.confidence,
    fillStatus,
    fillReason,
    unrealizedPnl: Number(unrealized.toFixed(4)),
    realizedPnl: 0,
    status: fillStatus === "REJECTED" ? "CANCELLED" : "OPEN",
    createdAt: now,
    updatedAt: now,
  };
}
