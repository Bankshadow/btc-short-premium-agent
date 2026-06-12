import type {
  BlockedSignalRecord,
  FairProbabilityResult,
  MispricingSignal,
  PolymarketMarket,
  PolymarketHealthReport,
  RiskEventRecord,
} from "./types";

export function explainSignalCreated(input: {
  signal: MispricingSignal;
  market: PolymarketMarket;
  fair: FairProbabilityResult;
}): string {
  const { signal, market, fair } = input;
  return (
    `Signal ${signal.side} on "${market.question}": fair YES ${fair.fairProbabilityYes.toFixed(2)} ` +
    `vs ask ${market.bestAskYes.toFixed(2)}, gross edge ${(signal.estimatedEdge * 100).toFixed(1)}%, ` +
    `confidence ${(signal.confidence * 100).toFixed(0)}%. ${fair.modelReason}`
  );
}

export function explainSignalBlocked(input: {
  market: PolymarketMarket;
  blocked: BlockedSignalRecord;
}): string {
  return (
    `Blocked ${input.blocked.side ?? "signal"} on "${input.market.question}": ${input.blocked.reason} ` +
    `(rules: ${input.blocked.ruleCodes.join(", ") || "none"}).`
  );
}

export function explainMispricingView(input: {
  market: PolymarketMarket;
  fair: FairProbabilityResult;
}): string {
  const diff = input.fair.fairProbabilityYes - input.market.yesPrice;
  const direction = diff > 0 ? "underpriced YES" : "overpriced YES";
  return (
    `Market "${input.market.question}" may have ${direction} by ${(Math.abs(diff) * 100).toFixed(1)}% ` +
    `(fair ${input.fair.fairProbabilityYes.toFixed(2)} vs market ${input.market.yesPrice.toFixed(2)}). ` +
    `Edge may be ${Math.abs(diff) > 0.03 ? "actionable" : "noise"} given ${input.fair.modelReason.toLowerCase()}`
  );
}

export function buildPreLiveReviewCommentary(input: {
  health: PolymarketHealthReport;
  openSignals: number;
  blockedCount: number;
}): string {
  const lines = [
    "Pre-live review (simulation only):",
    input.health.killSwitchActive
      ? "Kill switch is ON — no paper signals should execute."
      : "Kill switch is OFF — paper simulator may run.",
    `Data freshness: Polymarket ${input.health.polymarketDataFresh ? "OK" : "STALE"}, crypto ${input.health.cryptoDataFresh ? "OK" : "STALE"}.`,
    `${input.openSignals} open signal(s), ${input.blockedCount} blocked in recent cycle.`,
    "Before enabling real trading: verify API latency, wallet security, fill quality, and regulatory constraints.",
    "MVP 21 does NOT support real-money execution.",
  ];
  return lines.join(" ");
}

export function buildCycleCommentary(input: {
  markets: PolymarketMarket[];
  fairPrices: FairProbabilityResult[];
  signals: MispricingSignal[];
  blocked: BlockedSignalRecord[];
  riskEvents: RiskEventRecord[];
}): string[] {
  const fairById = new Map(input.fairPrices.map((f) => [f.marketId, f]));
  const marketById = new Map(input.markets.map((m) => [m.marketId, m]));
  const lines: string[] = [];

  for (const signal of input.signals.slice(0, 5)) {
    const market = marketById.get(signal.marketId);
    const fair = fairById.get(signal.marketId);
    if (market && fair) lines.push(explainSignalCreated({ signal, market, fair }));
  }

  for (const b of input.blocked.slice(0, 5)) {
    const market = marketById.get(b.marketId);
    if (market) lines.push(explainSignalBlocked({ market, blocked: b }));
  }

  for (const m of input.markets.slice(0, 3)) {
    const fair = fairById.get(m.marketId);
    if (fair) lines.push(explainMispricingView({ market: m, fair }));
  }

  if (input.riskEvents.some((e) => e.action === "KILL_SWITCH")) {
    lines.push("Kill switch triggered — review operator controls before next cycle.");
  }

  return lines;
}
