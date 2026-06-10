import type { AgentOutput, AgentRecommendation, ConfidenceLevel } from "@/lib/agents/types";
import type { BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import { isClosedJournalEntry } from "@/lib/learning-queue/build-learning-progress";
import { CONFIDENCE_CALIBRATION_OVERCONFIDENT_GAP } from "@/lib/confidence-calibration/config";
import type { ConfidenceCalibrationReport } from "@/lib/integrated-confidence-calibration/types";
import type { TradeQualityScore } from "@/lib/trade-quality-score/types";
import type {
  TestnetClosedTrade,
  TestnetLearningRecord,
} from "@/lib/testnet-monitor/types";
import { confidenceToProbability } from "@/lib/self-learning/confidence";
import type {
  AgentScoreboardV2EnrichedRow,
  AgentScoreboardV2EnrichedSegment,
} from "./types";

const UNDERCONFIDENT_GAP = -8;
const RISK_MANAGER_NAME = "Risk Manager Agent";

function round(n: number, digits = 1): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

function confidenceLevelToPct(level: ConfidenceLevel): number {
  return Math.round(confidenceToProbability(level) * 100);
}

function agentOutcomeFlags(
  agent: AgentOutput,
  tradeWouldWin: boolean | null,
): {
  correctTrade: boolean;
  correctSkip: boolean;
  falsePositive: boolean;
  falseNegative: boolean;
  hit: boolean;
} {
  if (tradeWouldWin === null) {
    return {
      correctTrade: false,
      correctSkip: true,
      falsePositive: false,
      falseNegative: false,
      hit: true,
    };
  }
  if (agent.recommendation === "TRADE") {
    if (tradeWouldWin) {
      return {
        correctTrade: true,
        correctSkip: false,
        falsePositive: false,
        falseNegative: false,
        hit: true,
      };
    }
    return {
      correctTrade: false,
      correctSkip: false,
      falsePositive: true,
      falseNegative: false,
      hit: false,
    };
  }
  if (!tradeWouldWin) {
    return {
      correctTrade: false,
      correctSkip: true,
      falsePositive: false,
      falseNegative: false,
      hit: true,
    };
  }
  return {
    correctTrade: false,
    correctSkip: false,
    falsePositive: false,
    falseNegative: true,
    hit: false,
  };
}

interface AgentAccumulator {
  agentName: string;
  totalCalls: number;
  correctTrade: number;
  correctSkip: number;
  falsePositives: number;
  falseNegatives: number;
  hits: number;
  alignedQualitySum: number;
  alignedQualityCount: number;
  tradeConfidenceSum: number;
  tradeConfidenceCount: number;
  tradeWins: number;
  vetoCount: number;
  correctVetoes: number;
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return round((numerator / denominator) * 100);
}

function resolveTradeWouldWin(
  entry: BinanceTestnetJournalEntry,
  closedTrade: TestnetClosedTrade | null,
): boolean | null {
  const netPnl = entry.realizedPnl ?? closedTrade?.netPnl ?? null;
  if (netPnl == null || !Number.isFinite(netPnl)) return null;
  if (netPnl > 0.01) return true;
  if (netPnl < -0.01) return false;
  return null;
}

export function buildEnrichedAgentScoreboardV2(input: {
  journal: BinanceTestnetJournalEntry[];
  closedTrades: TestnetClosedTrade[];
  learningRecords: TestnetLearningRecord[];
  decisions: DecisionLogEntry[];
  tradeQualityScores: TradeQualityScore[];
  calibrationReport: ConfidenceCalibrationReport;
}): AgentScoreboardV2EnrichedSegment {
  const decisionsById = new Map(input.decisions.map((d) => [d.id, d]));
  const closedById = new Map(input.closedTrades.map((t) => [t.id, t]));
  const learningByTrade = new Map(
    input.learningRecords.map((r) => [r.tradeId ?? r.closedTradeId, r]),
  );
  const qualityByDecision = new Map(
    input.tradeQualityScores.map((s) => [s.decisionLogId, s]),
  );
  const calibrationByAgent = new Map(
    input.calibrationReport.affectedAgents.map((a) => [a.agentName, a]),
  );

  const accumulators = new Map<string, AgentAccumulator>();

  for (const entry of input.journal) {
    if (!isClosedJournalEntry(entry)) continue;
    const decisionLogId = entry.decisionLogId?.trim();
    if (!decisionLogId) continue;

    const decision = decisionsById.get(decisionLogId);
    if (!decision?.agentOutputs?.length) continue;

    const closedTrade = closedById.get(entry.binanceTestnetTradeId) ?? null;
    const tradeWouldWin = resolveTradeWouldWin(entry, closedTrade);
    const learning = learningByTrade.get(entry.binanceTestnetTradeId);
    const quality =
      qualityByDecision.get(decisionLogId) ??
      (learning?.qualityScoreId
        ? input.tradeQualityScores.find((s) => s.scoreId === learning.qualityScoreId)
        : null);
    const alignedQuality =
      quality?.compositeScore ??
      learning?.qualityScore ??
      quality?.reasoningConsistency ??
      null;

    for (const agent of decision.agentOutputs) {
      const key = agent.agentName;
      const acc = accumulators.get(key) ?? {
        agentName: key,
        totalCalls: 0,
        correctTrade: 0,
        correctSkip: 0,
        falsePositives: 0,
        falseNegatives: 0,
        hits: 0,
        alignedQualitySum: 0,
        alignedQualityCount: 0,
        tradeConfidenceSum: 0,
        tradeConfidenceCount: 0,
        tradeWins: 0,
        vetoCount: 0,
        correctVetoes: 0,
      };

      acc.totalCalls += 1;
      const flags = agentOutcomeFlags(agent, tradeWouldWin);
      if (flags.correctTrade) acc.correctTrade += 1;
      if (flags.correctSkip) acc.correctSkip += 1;
      if (flags.falsePositive) acc.falsePositives += 1;
      if (flags.falseNegative) acc.falseNegatives += 1;
      if (flags.hit) {
        acc.hits += 1;
        if (alignedQuality != null) {
          acc.alignedQualitySum += alignedQuality;
          acc.alignedQualityCount += 1;
        }
      }

      if (agent.recommendation === "TRADE") {
        acc.tradeConfidenceSum += confidenceLevelToPct(agent.confidence);
        acc.tradeConfidenceCount += 1;
        if (tradeWouldWin === true) acc.tradeWins += 1;
      }

      if (key === RISK_MANAGER_NAME && (agent.veto || decision.riskVeto)) {
        acc.vetoCount += 1;
        if (tradeWouldWin === false || decision.finalVerdict === ("SKIP" as AgentRecommendation)) {
          acc.correctVetoes += 1;
        }
      }

      accumulators.set(key, acc);
    }
  }

  const rows: AgentScoreboardV2EnrichedRow[] = [...accumulators.values()]
    .map((acc) => {
      const predictionAccuracyPct = rate(acc.hits, acc.totalCalls);
      const falsePositiveRate = rate(
        acc.falsePositives,
        acc.falsePositives + acc.correctTrade,
      );
      const falseNegativeRate = rate(
        acc.falseNegatives,
        acc.falseNegatives + acc.correctSkip,
      );
      const alignedTradeQuality =
        acc.alignedQualityCount > 0
          ? round(acc.alignedQualitySum / acc.alignedQualityCount, 0)
          : null;
      const vetoQualityPct =
        acc.agentName === RISK_MANAGER_NAME && acc.vetoCount > 0
          ? round((acc.correctVetoes / acc.vetoCount) * 100, 0)
          : null;

      const cal = calibrationByAgent.get(acc.agentName);
      const avgStatedConfidence =
        cal?.avgStatedConfidence ??
        (acc.tradeConfidenceCount > 0
          ? Math.round(acc.tradeConfidenceSum / acc.tradeConfidenceCount)
          : 0);
      const actualWinRate =
        cal?.actualWinRate ??
        (acc.tradeConfidenceCount > 0
          ? round((acc.tradeWins / acc.tradeConfidenceCount) * 100, 1)
          : 0);
      const calibrationGap =
        cal?.calibrationGap ??
        round(avgStatedConfidence - actualWinRate, 1);
      const overconfident =
        cal?.overconfident ??
        (acc.tradeConfidenceCount >= 2 &&
          calibrationGap >= CONFIDENCE_CALIBRATION_OVERCONFIDENT_GAP);
      const underconfident =
        cal?.underconfident ?? calibrationGap <= UNDERCONFIDENT_GAP;

      return {
        sourceAgent: acc.agentName,
        sampleCount: acc.totalCalls,
        predictionAccuracyPct,
        falsePositiveRate,
        falseNegativeRate,
        avgStatedConfidence,
        actualWinRate,
        calibrationGap,
        overconfident,
        underconfident,
        downweightRecommended: overconfident && acc.totalCalls >= 2,
        alignedTradeQuality,
        vetoQualityPct,
        correctTradeCalls: acc.correctTrade,
        correctSkips: acc.correctSkip,
        falsePositives: acc.falsePositives,
        falseNegatives: acc.falseNegatives,
      };
    })
    .sort((a, b) => (b.predictionAccuracyPct ?? 0) - (a.predictionAccuracyPct ?? 0));

  const qualified = rows.filter((r) => r.sampleCount >= 2);
  const topContributingAgent =
    qualified.sort(
      (a, b) =>
        (b.predictionAccuracyPct ?? 0) - (a.predictionAccuracyPct ?? 0) ||
        (b.alignedTradeQuality ?? 0) - (a.alignedTradeQuality ?? 0),
    )[0]?.sourceAgent ?? null;

  const weakestAgent =
    [...qualified].sort((a, b) => {
      const aScore =
        (a.falsePositiveRate ?? 0) * 2 +
        (100 - (a.predictionAccuracyPct ?? 0)) +
        (a.overconfident ? 15 : 0);
      const bScore =
        (b.falsePositiveRate ?? 0) * 2 +
        (100 - (b.predictionAccuracyPct ?? 0)) +
        (b.overconfident ? 15 : 0);
      return bScore - aScore;
    })[0]?.sourceAgent ?? null;

  const overconfidentBuckets = input.calibrationReport.bucketStats.filter(
    (b) => b.overconfident,
  );
  const globalCalibrationGap =
    overconfidentBuckets.length > 0
      ? Math.round(
          overconfidentBuckets.reduce((s, b) => s + b.calibrationGap, 0) /
            overconfidentBuckets.length,
        )
      : 0;

  const totalSamples = rows.reduce((s, r) => s + r.sampleCount, 0);

  return {
    environment: "TESTNET",
    totalSamples,
    rows,
    globalCalibrationGap,
    topContributingAgent,
    weakestAgent,
    updatedAt: new Date().toISOString(),
  };
}
