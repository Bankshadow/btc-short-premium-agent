import type { PolymarketConfig } from "./config-types";
import type {
  BlockedSignalRecord,
  CryptoPriceSnapshot,
  MispricingSignal,
  PaperTradeRecord,
  PolymarketMarket,
  RiskEventRecord,
  RiskSeverity,
} from "./types";

function newRiskEventId(): string {
  return `prisk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function newBlockedSignalId(): string {
  return `pblk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export interface RiskCheckResult {
  allowed: boolean;
  ruleCodes: string[];
  riskFlags: string[];
  reason: string;
  severity: RiskSeverity;
}

export function checkSignalRisk(input: {
  signal: MispricingSignal;
  market: PolymarketMarket;
  config: PolymarketConfig;
  btc: CryptoPriceSnapshot;
  eth: CryptoPriceSnapshot;
  paperTrades: PaperTradeRecord[];
  dailySimulatedLoss: number;
}): RiskCheckResult {
  const { signal, market, config, paperTrades, dailySimulatedLoss } = input;
  const ruleCodes: string[] = [];
  const riskFlags = [...signal.riskFlags];
  let severity: RiskSeverity = "INFO";

  if (config.killSwitchActive) {
    ruleCodes.push("KILL_SWITCH");
    return block("Kill switch active — all Polymarket paper signals blocked.", ruleCodes, riskFlags, "BLOCK");
  }

  if (!config.paperTradingEnabled) {
    ruleCodes.push("PAPER_TRADING_DISABLED");
    return block("Paper trading disabled.", ruleCodes, riskFlags, "BLOCK");
  }

  if (config.realTradingEnabled) {
    ruleCodes.push("REAL_TRADING_FORBIDDEN");
    return block("Real trading is forbidden in MVP 21.", ruleCodes, riskFlags, "BLOCK");
  }

  const crypto = market.asset === "ETH" ? input.eth : input.btc;
  const ageSec = (Date.now() - Date.parse(crypto.timestamp)) / 1000;
  if (ageSec > config.staleDataThresholdSeconds || crypto.quality === "STALE") {
    ruleCodes.push("STALE_CRYPTO_DATA");
    riskFlags.push("STALE_DATA");
    return block(`Crypto data stale (${ageSec.toFixed(0)}s).`, ruleCodes, riskFlags, "BLOCK");
  }

  const spread = market.bestAskYes - market.bestBidYes;
  if (spread > config.maxSpread) {
    ruleCodes.push("MAX_SPREAD");
    return block(`Spread ${spread.toFixed(3)} exceeds max ${config.maxSpread}.`, ruleCodes, riskFlags, "BLOCK");
  }

  if (market.liquidity < config.minLiquidity) {
    ruleCodes.push("MIN_LIQUIDITY");
    return block(`Liquidity ${market.liquidity} below min ${config.minLiquidity}.`, ruleCodes, riskFlags, "BLOCK");
  }

  if (signal.confidence < config.minConfidenceScore) {
    ruleCodes.push("MIN_CONFIDENCE");
    return block(`Confidence ${signal.confidence} below threshold.`, ruleCodes, riskFlags, "BLOCK");
  }

  if (signal.estimatedEdge < config.minEdgeThreshold) {
    ruleCodes.push("MIN_EDGE");
    return block(`Edge ${signal.estimatedEdge} below threshold.`, ruleCodes, riskFlags, "BLOCK");
  }

  const marketExposure = paperTrades
    .filter((t) => t.marketId === market.marketId && t.status === "OPEN")
    .reduce((s, t) => s + t.simulatedSize, 0);
  if (marketExposure + signal.suggestedSizeSimulated > config.maxExposurePerMarket) {
    ruleCodes.push("MAX_EXPOSURE_PER_MARKET");
    return block("Max simulated exposure per market exceeded.", ruleCodes, riskFlags, "BLOCK");
  }

  const totalExposure = paperTrades
    .filter((t) => t.status === "OPEN")
    .reduce((s, t) => s + t.simulatedSize, 0);
  if (totalExposure + signal.suggestedSizeSimulated > config.maxExposureTotal) {
    ruleCodes.push("MAX_EXPOSURE_TOTAL");
    return block("Max total simulated exposure exceeded.", ruleCodes, riskFlags, "BLOCK");
  }

  const hourAgo = Date.now() - 3_600_000;
  const tradesLastHour = paperTrades.filter(
    (t) => Date.parse(t.createdAt) >= hourAgo,
  ).length;
  if (tradesLastHour >= config.maxTradesPerHour) {
    ruleCodes.push("MAX_TRADES_PER_HOUR");
    return block("Max simulated trades per hour exceeded.", ruleCodes, riskFlags, "BLOCK");
  }

  if (dailySimulatedLoss >= config.maxDailyLoss) {
    ruleCodes.push("MAX_DAILY_LOSS");
    return block("Max simulated daily loss exceeded.", ruleCodes, riskFlags, "BLOCK");
  }

  if (riskFlags.length > 0) severity = "WARN";

  return {
    allowed: true,
    ruleCodes,
    riskFlags,
    reason: "Risk checks passed.",
    severity,
  };
}

function block(
  reason: string,
  ruleCodes: string[],
  riskFlags: string[],
  severity: RiskSeverity,
): RiskCheckResult {
  return { allowed: false, ruleCodes, riskFlags, reason, severity };
}

export function toBlockedSignalRecord(input: {
  signal: MispricingSignal;
  risk: RiskCheckResult;
}): BlockedSignalRecord {
  return {
    signalId: newBlockedSignalId(),
    marketId: input.signal.marketId,
    side: input.signal.side,
    reason: input.risk.reason,
    riskFlags: input.risk.riskFlags,
    ruleCodes: input.risk.ruleCodes,
    createdAt: new Date().toISOString(),
  };
}

export function toRiskEventRecord(input: {
  marketId: string | null;
  ruleCode: string;
  severity: RiskSeverity;
  action: "ALLOW" | "BLOCK" | "KILL_SWITCH";
  reason: string;
}): RiskEventRecord {
  return {
    eventId: newRiskEventId(),
    marketId: input.marketId,
    ruleCode: input.ruleCode,
    severity: input.severity,
    action: input.action,
    reason: input.reason,
    createdAt: new Date().toISOString(),
  };
}

export function sumDailySimulatedLoss(trades: PaperTradeRecord[]): number {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const cutoff = startOfDay.getTime();
  return trades
    .filter((t) => Date.parse(t.updatedAt) >= cutoff && t.realizedPnl < 0)
    .reduce((s, t) => s + Math.abs(t.realizedPnl), 0);
}
