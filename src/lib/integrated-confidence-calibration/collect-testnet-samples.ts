import type { BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type {
  TestnetClosedTrade,
  TestnetLearningRecord,
} from "@/lib/testnet-monitor/types";
import { isClosedJournalEntry } from "@/lib/learning-queue/build-learning-progress";
import type { IntegratedCalibrationSample } from "./types";

function clamp(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)));
}

function resolveConfidenceBeforeTrade(
  entry: DecisionLogEntry | undefined,
  learningRecord?: TestnetLearningRecord,
): number | null {
  if (entry?.playbookConfidence != null) {
    return clamp(entry.playbookConfidence);
  }
  if (entry?.orderTicket?.confidence != null) {
    return clamp(entry.orderTicket.confidence);
  }
  if (entry?.committeeTradeScore != null) {
    return clamp(entry.committeeTradeScore);
  }
  if (learningRecord?.confidence != null) {
    return clamp(learningRecord.confidence * 100);
  }
  return null;
}

function resultFromPnl(netPnl: number): IntegratedCalibrationSample["result"] {
  if (netPnl > 0.01) return "WIN";
  if (netPnl < -0.01) return "LOSS";
  return "BREAKEVEN";
}

export function collectTestnetCalibrationSamples(input: {
  journal: BinanceTestnetJournalEntry[];
  closedTrades: TestnetClosedTrade[];
  decisions: DecisionLogEntry[];
  learningRecords: TestnetLearningRecord[];
}): IntegratedCalibrationSample[] {
  const decisionsById = new Map(input.decisions.map((d) => [d.id, d]));
  const learningByTrade = new Map(
    input.learningRecords.map((r) => [r.tradeId ?? r.closedTradeId, r]),
  );
  const tradeById = new Map(input.closedTrades.map((t) => [t.id, t]));
  const samples: IntegratedCalibrationSample[] = [];

  for (const entry of input.journal) {
    if (!isClosedJournalEntry(entry)) continue;
    const tradeId = entry.binanceTestnetTradeId;
    const closedTrade = tradeById.get(tradeId);
    const learning = learningByTrade.get(tradeId);
    const decisionLogId = entry.decisionLogId ?? learning?.decisionLogId ?? null;
    if (!decisionLogId) continue;

    const decision = decisionsById.get(decisionLogId);
    const confidenceBeforeTrade = resolveConfidenceBeforeTrade(decision, learning);
    if (confidenceBeforeTrade == null) continue;

    const netPnl = entry.realizedPnl ?? closedTrade?.netPnl ?? 0;
    const notional = Math.max(1, entry.notionalUsd ?? 100);
    const pnlPct = Number(((netPnl / notional) * 100).toFixed(3));
    const actualWin = netPnl > 0;

    samples.push({
      sampleId: `icc-${tradeId}`,
      decisionLogId,
      tradeId,
      confidenceBeforeTrade,
      actualWin,
      pnlPct,
      result: resultFromPnl(netPnl),
      source: "testnet_closed",
      evaluatedAt: entry.closedAt ?? entry.createdAt,
      strategyTag: learning?.strategyTag ?? learning?.strategy ?? entry.source ?? null,
      marketRegime: decision?.marketRegime ?? null,
      qualityScore: learning?.qualityScore ?? null,
      sourceAgent: learning?.sourceAgent ?? null,
    });
  }

  return samples;
}
