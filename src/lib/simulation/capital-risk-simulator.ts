import type {
  CapitalRiskSimulatorInput,
  CapitalRiskSimulatorOutput,
} from "./types";
import { median, mulberry32, runSingleEquityPath } from "./risk-of-ruin";

export function runCapitalRiskSimulator(
  input: CapitalRiskSimulatorInput,
): CapitalRiskSimulatorOutput {
  const runs = Math.min(5000, Math.max(100, input.simulationRuns));
  const ruinFloor = input.startingEquity * 0.5;
  const rand = mulberry32(42);

  const endings: number[] = [];
  const drawdowns: number[] = [];
  let reachTarget = 0;
  let ruin = 0;

  for (let i = 0; i < runs; i++) {
    const path = runSingleEquityPath({
      startEquity: input.currentEquity,
      targetEquity: input.targetEquity,
      ruinFloor,
      winRate: Math.min(0.95, Math.max(0.05, input.winRate)),
      avgWinR: Math.max(0.1, input.averageWinR),
      avgLossR: Math.max(0.1, input.averageLossR),
      riskPct: input.riskPerTradePct,
      maxTrades: input.maxTrades,
      rand,
    });
    endings.push(path.endingEquity);
    drawdowns.push(path.maxDrawdownPct);
    if (path.reachedTarget) reachTarget += 1;
    if (path.ruined) ruin += 1;
  }

  endings.sort((a, b) => a - b);
  const warnings: string[] = [];
  const probabilityRuin = (ruin / runs) * 100;
  const probabilityReachTarget = (reachTarget / runs) * 100;
  const expectedMaxDrawdown =
    drawdowns.reduce((s, d) => s + d, 0) / drawdowns.length;

  let recommendedRiskPct = input.riskPerTradePct;
  if (probabilityRuin > 15) {
    recommendedRiskPct = Math.max(0.5, input.riskPerTradePct * 0.6);
    warnings.push(
      `High ruin probability (${probabilityRuin.toFixed(1)}%) — lower risk per trade.`,
    );
  }
  if (expectedMaxDrawdown > input.maxDrawdownPct) {
    recommendedRiskPct = Math.max(0.5, recommendedRiskPct * 0.75);
    warnings.push(
      `Expected max drawdown ${expectedMaxDrawdown.toFixed(1)}% exceeds profile limit ${input.maxDrawdownPct}%.`,
    );
  }

  const edgeR =
    input.winRate * input.averageWinR -
    (1 - input.winRate) * input.averageLossR;
  if (edgeR <= 0) {
    recommendedRiskPct = Math.min(recommendedRiskPct, input.riskPerTradePct);
    warnings.push("Average R ≤ 0 — do not increase risk until edge is positive.");
  }

  const resolvedTradesEstimate = input.maxTrades;
  let confidence: CapitalRiskSimulatorOutput["confidence"] = "HIGH";
  if (resolvedTradesEstimate < 30) {
    confidence = "LOW";
    warnings.push("LOW CONFIDENCE — fewer than 30 trades in simulation horizon.");
  } else if (resolvedTradesEstimate < 80) {
    confidence = "MEDIUM";
  }

  const tradesToMilestone =
    edgeR > 0
      ? Math.ceil(
          Math.log(input.targetEquity / input.currentEquity) /
            Math.log(1 + (recommendedRiskPct / 100) * edgeR),
        )
      : 999;

  return {
    probabilityReachTarget: Number(probabilityReachTarget.toFixed(1)),
    probabilityRuin: Number(probabilityRuin.toFixed(1)),
    medianEndingEquity: Number(median(endings).toFixed(0)),
    expectedMaxDrawdown: Number(expectedMaxDrawdown.toFixed(1)),
    bestCaseEquity: Number(endings[Math.floor(runs * 0.95)].toFixed(0)),
    baseCaseEquity: Number(median(endings).toFixed(0)),
    worstCaseEquity: Number(endings[Math.floor(runs * 0.05)].toFixed(0)),
    expectedTradesToNextMilestone: Math.min(500, tradesToMilestone),
    recommendedRiskPct: Number(recommendedRiskPct.toFixed(2)),
    warnings,
    confidence,
    sampleSizeNote:
      confidence === "LOW"
        ? "Use more resolved decision log outcomes for HIGH confidence."
        : undefined,
  };
}
