import type { PolymarketConfig } from "./config-types";
import { timeRemainingSeconds } from "./market-discovery";
import type {
  FairProbabilityResult,
  MispricingOpportunity,
  MispricingSignal,
  PolymarketMarket,
  SignalSide,
} from "./types";

function newSignalId(): string {
  return `psig-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function buildMispricingOpportunity(input: {
  market: PolymarketMarket;
  fair: FairProbabilityResult;
  now?: number;
}): MispricingOpportunity {
  const { market, fair } = input;
  const midYes = (market.bestBidYes + market.bestAskYes) / 2;
  const spreadYes = market.bestAskYes - market.bestBidYes;
  const fairYes = fair.fairProbabilityYes;

  const edgeToBuyYes = fairYes - market.bestAskYes;
  const edgeToSellYes = market.bestBidYes - fairYes;
  const edgeToBuyNo = fair.fairProbabilityNo - market.bestAskNo;

  const liquidityScore = Math.min(1, market.liquidity / 5000);
  const spreadPenalty = Math.max(0, 1 - spreadYes / 0.12);
  const executionScore = liquidityScore * 0.6 + spreadPenalty * 0.4;

  const timeRem = timeRemainingSeconds(market, input.now);
  const latencyRiskScore =
    timeRem < 300 ? 0.7 : timeRem < 900 ? 0.4 : 0.2;

  const bestEdge = Math.max(edgeToBuyYes, edgeToSellYes, edgeToBuyNo, 0);
  const overallOpportunityScore =
    bestEdge * fair.confidenceScore * executionScore * (1 - latencyRiskScore * 0.3);

  return {
    marketId: market.marketId,
    fairProbabilityYes: fairYes,
    bestBidYes: market.bestBidYes,
    bestAskYes: market.bestAskYes,
    midPriceYes: Number(midYes.toFixed(4)),
    spreadYes: Number(spreadYes.toFixed(4)),
    edgeToBuyYes: Number(edgeToBuyYes.toFixed(4)),
    edgeToSellYes: Number(edgeToSellYes.toFixed(4)),
    edgeToBuyNo: Number(edgeToBuyNo.toFixed(4)),
    liquidityScore: Number(liquidityScore.toFixed(4)),
    executionScore: Number(executionScore.toFixed(4)),
    latencyRiskScore: Number(latencyRiskScore.toFixed(4)),
    overallOpportunityScore: Number(overallOpportunityScore.toFixed(4)),
    timeRemainingSeconds: timeRem,
  };
}

function pickBestSide(opp: MispricingOpportunity): {
  side: SignalSide;
  edge: number;
  suggestedPrice: number;
} | null {
  const candidates: { side: SignalSide; edge: number; suggestedPrice: number }[] = [
    { side: "BUY_YES", edge: opp.edgeToBuyYes, suggestedPrice: opp.bestAskYes },
    { side: "SELL_YES", edge: opp.edgeToSellYes, suggestedPrice: opp.bestBidYes },
    { side: "BUY_NO", edge: opp.edgeToBuyNo, suggestedPrice: 1 - opp.bestBidYes },
  ];
  const best = candidates.sort((a, b) => b.edge - a.edge)[0];
  if (!best || best.edge <= 0) return null;
  return best;
}

export function detectMispricingSignals(input: {
  markets: PolymarketMarket[];
  fairPrices: FairProbabilityResult[];
  config: PolymarketConfig;
}): { opportunities: MispricingOpportunity[]; signals: MispricingSignal[] } {
  const fairById = new Map(input.fairPrices.map((f) => [f.marketId, f]));
  const opportunities: MispricingOpportunity[] = [];
  const signals: MispricingSignal[] = [];

  for (const market of input.markets) {
    const fair = fairById.get(market.marketId);
    if (!fair) continue;
    const opp = buildMispricingOpportunity({ market, fair });
    opportunities.push(opp);

    const best = pickBestSide(opp);
    if (!best) continue;
    if (best.edge < input.config.minEdgeThreshold) continue;
    if (fair.confidenceScore < input.config.minConfidenceScore) continue;
    if (opp.spreadYes > input.config.maxSpread) continue;
    if (market.liquidity < input.config.minLiquidity) continue;
    if (opp.timeRemainingSeconds < input.config.minTimeRemainingSeconds) continue;

    const riskFlags: string[] = [];
    if (opp.latencyRiskScore > 0.5) riskFlags.push("LATENCY_RISK");
    if (opp.spreadYes > input.config.maxSpread * 0.75) riskFlags.push("WIDE_SPREAD");
    if (market.liquidity < input.config.minLiquidity * 2) riskFlags.push("LOW_LIQUIDITY");

    signals.push({
      signalId: newSignalId(),
      marketId: market.marketId,
      side: best.side,
      suggestedPrice: Number(best.suggestedPrice.toFixed(4)),
      fairPrice: best.side.includes("NO")
        ? fair.fairProbabilityNo
        : fair.fairProbabilityYes,
      estimatedEdge: Number(best.edge.toFixed(4)),
      confidence: fair.confidenceScore,
      suggestedSizeSimulated: Math.min(
        input.config.maxExposurePerMarket,
        market.liquidity * 0.01,
      ),
      reason: `${best.side} edge ${(best.edge * 100).toFixed(1)}% vs fair ${(best.side.includes("NO") ? fair.fairProbabilityNo : fair.fairProbabilityYes).toFixed(2)}`,
      riskFlags,
      status: "OPEN",
      createdAt: new Date().toISOString(),
    });
  }

  return { opportunities, signals };
}
