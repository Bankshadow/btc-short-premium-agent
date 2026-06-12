import type { PolymarketConfig } from "./config-types";
import type { CryptoPriceSnapshot, PaperTradeRecord, PolymarketMarket } from "./types";
import type {
  BlockedSweeperRecord,
  SweeperOpportunity,
  SweeperPaperTrade,
  SweeperRiskCheck,
} from "./sweeper-types";

function newBlockedId(): string {
  return `swpblk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function checkSweeperOpportunityRisk(input: {
  opportunity: SweeperOpportunity;
  market: PolymarketMarket;
  config: PolymarketConfig;
  btc: CryptoPriceSnapshot;
  eth: CryptoPriceSnapshot;
  paperTrades: (PaperTradeRecord | SweeperPaperTrade)[];
  dailySimulatedLoss: number;
}): SweeperRiskCheck {
  const { opportunity, market, config } = input;
  const ruleCodes: string[] = [];
  const riskFlags = [...opportunity.riskFlags];

  if (config.killSwitchActive) {
    ruleCodes.push("KILL_SWITCH");
    return block("Kill switch active — sweeper blocked.", ruleCodes, riskFlags);
  }
  if (!config.paperTradingEnabled) {
    ruleCodes.push("PAPER_TRADING_DISABLED");
    return block("Paper trading disabled.", ruleCodes, riskFlags);
  }
  if (config.realTradingEnabled) {
    ruleCodes.push("REAL_TRADING_FORBIDDEN");
    return block("Real trading forbidden in MVP 21.1.", ruleCodes, riskFlags);
  }

  const crypto = market.asset === "ETH" ? input.eth : input.btc;
  const ageSec = (Date.now() - Date.parse(crypto.timestamp)) / 1000;
  if (ageSec > config.staleDataThresholdSeconds || crypto.quality === "STALE") {
    ruleCodes.push("STALE_CRYPTO_DATA");
    return block("Stale crypto data.", ruleCodes, riskFlags);
  }

  if (opportunity.estimatedEdge < config.minEdgeThreshold) {
    ruleCodes.push("MIN_EDGE");
    return block("Edge below threshold.", ruleCodes, riskFlags);
  }
  if (opportunity.confidence < config.minConfidenceScore) {
    ruleCodes.push("MIN_CONFIDENCE");
    return block("Confidence below threshold.", ruleCodes, riskFlags);
  }
  if (market.liquidity < config.minLiquidity) {
    ruleCodes.push("MIN_LIQUIDITY");
    return block("Insufficient market liquidity.", ruleCodes, riskFlags);
  }
  if (opportunity.timeRemainingSeconds < config.minTimeRemainingSeconds) {
    ruleCodes.push("MIN_TIME_REMAINING");
    return block("Too close to expiry.", ruleCodes, riskFlags);
  }

  const spread = market.bestAskYes - market.bestBidYes;
  if (
    opportunity.strategy !== "WIDE_SPREAD_CAPTURE" &&
    opportunity.strategy !== "NEAR_EXPIRY_LIQUIDITY_GAP" &&
    spread > config.maxSpread
  ) {
    ruleCodes.push("MAX_SPREAD");
    return block("Spread too wide.", ruleCodes, riskFlags);
  }

  const marketExposure = input.paperTrades
    .filter((t) => t.marketId === market.marketId && t.status === "OPEN")
    .reduce((s, t) => s + ("simulatedSize" in t ? t.simulatedSize : 0), 0);
  if (marketExposure + opportunity.suggestedSizeSimulated > config.maxExposurePerMarket) {
    ruleCodes.push("MAX_EXPOSURE_PER_MARKET");
    return block("Max exposure per market.", ruleCodes, riskFlags);
  }

  const totalExposure = input.paperTrades
    .filter((t) => t.status === "OPEN")
    .reduce((s, t) => s + ("simulatedSize" in t ? t.simulatedSize : 0), 0);
  if (totalExposure + opportunity.suggestedSizeSimulated > config.maxExposureTotal) {
    ruleCodes.push("MAX_EXPOSURE_TOTAL");
    return block("Max total exposure.", ruleCodes, riskFlags);
  }

  if (input.dailySimulatedLoss >= config.maxDailyLoss) {
    ruleCodes.push("MAX_DAILY_LOSS");
    return block("Max daily simulated loss.", ruleCodes, riskFlags);
  }

  const hourAgo = Date.now() - 3_600_000;
  const tradesLastHour = input.paperTrades.filter(
    (t) => Date.parse(t.createdAt) >= hourAgo,
  ).length;
  if (tradesLastHour >= config.maxTradesPerHour) {
    ruleCodes.push("MAX_TRADES_PER_HOUR");
    return block("Max trades per hour.", ruleCodes, riskFlags);
  }

  return {
    allowed: true,
    ruleCodes,
    riskFlags,
    reason: "Sweeper risk checks passed.",
    severity: riskFlags.length > 0 ? "WARN" : "INFO",
  };
}

function block(
  reason: string,
  ruleCodes: string[],
  riskFlags: string[],
): SweeperRiskCheck {
  return { allowed: false, ruleCodes, riskFlags, reason, severity: "BLOCK" };
}

export function toBlockedSweeperRecord(input: {
  opportunity: SweeperOpportunity;
  risk: SweeperRiskCheck;
}): BlockedSweeperRecord {
  return {
    recordId: newBlockedId(),
    opportunityId: input.opportunity.opportunityId,
    marketId: input.opportunity.marketId,
    strategy: input.opportunity.strategy,
    side: input.opportunity.side,
    reason: input.risk.reason,
    riskFlags: input.risk.riskFlags,
    ruleCodes: input.risk.ruleCodes,
    estimatedEdge: input.opportunity.estimatedEdge,
    createdAt: new Date().toISOString(),
  };
}
