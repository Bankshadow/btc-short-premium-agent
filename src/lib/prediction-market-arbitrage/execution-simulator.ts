import { PREDICTION_ARB_DEFAULTS } from "./config";
import type {
  DepthAnalysis,
  ExecutionSimulation,
  NormalizedPredictionMarket,
  OpportunityType,
  RawMispricingCandidate,
  ResolutionRiskScore,
} from "./types";

/**
 * ExecutionSimulator — partial fills, stale books, latency, capital lock.
 */
export function simulateExecution(input: {
  candidate: RawMispricingCandidate;
  depth: DepthAnalysis;
  resolution: ResolutionRiskScore;
  config?: typeof PREDICTION_ARB_DEFAULTS;
}): ExecutionSimulation {
  const config = input.config ?? PREDICTION_ARB_DEFAULTS;
  const { candidate, depth, resolution } = input;
  const { market, opportunityType, theoreticalEdgePct } = candidate;
  const notes: string[] = [];

  const staleMs =
    Date.now() - new Date(market.fetchedAt).getTime();
  const staleBookPenaltyPct =
    staleMs > config.staleBookSeconds * 1000 ? 0.35 : 0.05;

  const partialFillRatio = depth.depthRejected
    ? 0
    : Math.max(config.partialFillMinRatio, depth.executableSizeUsd / 500);

  const feePct = market.feeRate * 100 * market.outcomes.length;
  const slipPct = market.slippageBps / 100;

  let rawEdgePct = theoreticalEdgePct;
  if (depth.vwapBundleCost > 0 && opportunityType === "BUY_BUNDLE") {
    rawEdgePct = (1 - depth.vwapBundleCost) * 100 - feePct - slipPct;
  } else if (depth.vwapBundleCost > 0 && opportunityType === "SELL_BUNDLE") {
    rawEdgePct = (depth.vwapBundleCost - 1) * 100 - feePct - slipPct;
  }

  const latencyPenaltyPct = config.latencyMs / 1000;
  const executableEdgePct = Math.max(
    0,
    rawEdgePct * partialFillRatio - staleBookPenaltyPct - latencyPenaltyPct,
  );

  const requiredCapitalUsd = Math.min(
    depth.executableSizeUsd,
    config.maxCapitalPerOpportunityUsd,
  );

  const expectedProfitUsd =
    (executableEdgePct / 100) * requiredCapitalUsd;
  const worstCaseLossUsd =
    requiredCapitalUsd * (0.02 + resolution.score / 5000 + staleBookPenaltyPct / 100);

  let confidenceScore = 50;
  confidenceScore += Math.min(25, executableEdgePct * 3);
  confidenceScore -= resolution.score * 0.25;
  confidenceScore -= depth.topOfBookOnly ? 15 : 0;
  confidenceScore -= depth.depthRejected ? 40 : 0;
  confidenceScore = Math.max(0, Math.min(100, Math.round(confidenceScore)));

  if (partialFillRatio < 1) {
    notes.push(`Partial fill assumption ${(partialFillRatio * 100).toFixed(0)}%.`);
  }
  if (staleBookPenaltyPct > 0.1) {
    notes.push(`Stale book penalty ${staleBookPenaltyPct.toFixed(2)}%.`);
  }
  notes.push(`Simulated latency ${config.latencyMs}ms.`);

  const capitalLockHours = market.resolutionDeadline
    ? Math.max(24, (new Date(market.resolutionDeadline).getTime() - Date.now()) / 3_600_000)
    : 168;

  return {
    expectedProfitUsd: Number(expectedProfitUsd.toFixed(2)),
    worstCaseLossUsd: Number(worstCaseLossUsd.toFixed(2)),
    requiredCapitalUsd: Number(requiredCapitalUsd.toFixed(2)),
    confidenceScore,
    executableEdgePct: Number(executableEdgePct.toFixed(3)),
    staleBookPenaltyPct,
    latencyMs: config.latencyMs,
    partialFillRatio,
    capitalLockHours: Number(capitalLockHours.toFixed(1)),
    notes,
  };
}
