import { runPredictionArbCommittee } from "./agent-committee";
import { PREDICTION_ARB_DEFAULTS } from "./config";
import { simulateExecution } from "./execution-simulator";
import { fetchPredictionMarkets } from "./market-data-connector";
import { detectAllMispricing } from "./mispricing-detector";
import { analyzeOrderBookDepth } from "./order-book-depth-analyzer";
import { scoreResolutionRisk } from "./resolution-risk-scorer";
import { appendScanLog, createScanLogId } from "./scan-log";
import {
  PREDICTION_ARB_MVP,
  PREDICTION_ARB_SAFETY_NOTICE,
  type ArbOpportunity,
  type PredictionArbScanResult,
} from "./types";

export interface RunPredictionArbScanInput {
  mockOnly?: boolean;
  preferLive?: boolean;
  config?: typeof PREDICTION_ARB_DEFAULTS;
}

/**
 * Orchestrates the full prediction-market arbitrage pipeline (paper only).
 */
export async function runPredictionArbScan(
  input: RunPredictionArbScanInput = {},
): Promise<PredictionArbScanResult> {
  const config = input.config ?? PREDICTION_ARB_DEFAULTS;
  const scanLogId = createScanLogId();
  const generatedAt = new Date().toISOString();

  const { markets, dataSource } = await fetchPredictionMarkets({
    mockOnly: input.mockOnly,
    preferLive: input.preferLive,
  });

  const candidates = detectAllMispricing(markets, config);
  const opportunities: ArbOpportunity[] = [];
  let portfolioUsedUsd = 0;

  for (const candidate of candidates) {
    const resolution = scoreResolutionRisk(candidate.market, config);
    const depth = analyzeOrderBookDepth({
      market: candidate.market,
      opportunityType: candidate.opportunityType,
      maxNotionalUsd: config.maxCapitalPerOpportunityUsd,
    });
    const simulation = simulateExecution({
      candidate,
      depth,
      resolution,
      config,
    });
    const committee = runPredictionArbCommittee({
      candidate,
      depth,
      simulation,
      resolution,
      portfolioUsedUsd,
      config,
    });

    if (committee.verdict === "TRADE") {
      portfolioUsedUsd += simulation.requiredCapitalUsd;
    }

    opportunities.push({
      id: `${scanLogId}-${candidate.market.id}-${candidate.opportunityType}`,
      eventTitle: candidate.market.eventTitle,
      marketTitle: candidate.market.marketTitle,
      marketType: candidate.market.marketType,
      opportunityType: candidate.opportunityType,
      theoreticalEdgePct: Number(candidate.theoreticalEdgePct.toFixed(3)),
      executableEdgePct: simulation.executableEdgePct,
      executableSizeUsd: depth.executableSizeUsd,
      requiredCapitalUsd: simulation.requiredCapitalUsd,
      resolutionRiskScore: resolution.score,
      resolutionBlocked: resolution.blocked,
      depthRejected: depth.depthRejected,
      status: committee.verdict,
      noTradeReason: committee.noTradeReason,
      committeeVerdict: committee.verdict,
      committeeSummary: committee.summary,
      agentVotes: committee.agentVotes,
      simulation,
      depth,
      resolution,
      marketId: candidate.market.id,
      source: candidate.market.source,
      scannedAt: generatedAt,
    });
  }

  opportunities.sort((a, b) => b.executableEdgePct - a.executableEdgePct);

  const result: PredictionArbScanResult = {
    mvp: PREDICTION_ARB_MVP,
    generatedAt,
    marketsScanned: markets.length,
    candidatesFound: candidates.length,
    opportunities,
    tradeCount: opportunities.filter((o) => o.status === "TRADE").length,
    watchCount: opportunities.filter((o) => o.status === "WATCH").length,
    noTradeCount: opportunities.filter((o) => o.status === "NO_TRADE").length,
    dataSource,
    scanLogId,
    disclaimer: PREDICTION_ARB_SAFETY_NOTICE,
    simulationOnly: true,
    cannotExecuteOrders: true,
  };

  appendScanLog({
    id: scanLogId,
    generatedAt,
    marketsScanned: markets.length,
    opportunities,
    dataSource,
    replayPayload: {
      configSnapshot: { ...config },
      marketIds: markets.map((m) => m.id),
    },
  });

  return result;
}
