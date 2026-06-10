import type { BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { TradeQualityScore } from "@/lib/trade-quality-score/types";
import type {
  TestnetClosedTrade,
  TestnetLearningRecord,
  TestnetMonitorJournalEvent,
} from "@/lib/testnet-monitor/types";
import type {
  AnalysisContextEvidenceQualityLink,
  EvidenceFieldGap,
  EvidenceQualityBuildInput,
  EvidenceQualityField,
  EvidenceQualitySnapshot,
  EvidenceTradeAssessment,
} from "./types";
import {
  EVIDENCE_QUALITY_LABEL,
  EVIDENCE_QUALITY_MVP,
} from "./types";
import {
  resolveBlocksStrategyHealthReview,
  resolveEvidenceBlockReason,
  resolveEvidenceQualityLevel,
  resolveReadinessForStrategyReview,
} from "./resolve-evidence-quality";

const ALL_FIELDS: EvidenceQualityField[] = [
  "decisionLogId",
  "closedEvent",
  "realizedPnl",
  "entryExitPrice",
  "strategyTag",
  "aiConfidence",
  "riskCheckResult",
  "learningRecord",
  "tradeQualityScore",
];

function isCompletedJournal(entry: BinanceTestnetJournalEntry): boolean {
  if (entry.binanceTestnetTradeId.includes("-close")) return false;
  return entry.status === "CLOSED";
}

function hasClosedMonitorEvent(
  tradeId: string,
  decisionLogId: string | null,
  events: TestnetMonitorJournalEvent[],
): boolean {
  return events.some((event) => {
    if (event.eventType !== "POSITION_CLOSED" && event.eventType !== "PNL_REALIZED") {
      return false;
    }
    const payloadTradeId =
      typeof event.payload.tradeId === "string" ? event.payload.tradeId : null;
    const payloadJournalId =
      typeof event.payload.journalTradeId === "string"
        ? event.payload.journalTradeId
        : null;
    if (payloadTradeId === tradeId || payloadJournalId === tradeId) return true;
    if (decisionLogId && event.decisionLogId === decisionLogId) return true;
    return false;
  });
}

function resolveStrategyTag(input: {
  journal: BinanceTestnetJournalEntry;
  closedTrade: TestnetClosedTrade | null;
  learning: TestnetLearningRecord | null;
}): string | null {
  const tag =
    input.learning?.strategyTag?.trim() ||
    input.journal.source?.trim() ||
    input.closedTrade?.strategy?.trim() ||
    null;
  return tag || null;
}

function resolveAiConfidence(input: {
  decision: DecisionLogEntry | null;
  closedTrade: TestnetClosedTrade | null;
  learning: TestnetLearningRecord | null;
}): number | null {
  if (input.decision?.playbookConfidence != null) {
    return input.decision.playbookConfidence;
  }
  if (input.decision?.committeeTradeScore != null) {
    return input.decision.committeeTradeScore;
  }
  if (input.learning?.confidence != null) return input.learning.confidence;
  if (input.closedTrade?.confidence != null) return input.closedTrade.confidence;
  return null;
}

function assessCompletedTrade(input: {
  journal: BinanceTestnetJournalEntry;
  closedTrade: TestnetClosedTrade | null;
  learning: TestnetLearningRecord | null;
  decision: DecisionLogEntry | null;
  qualityScore: TradeQualityScore | null;
  monitorEvents: TestnetMonitorJournalEvent[];
}): EvidenceTradeAssessment {
  const { journal, closedTrade, learning, decision, qualityScore, monitorEvents } =
    input;
  const tradeId = journal.binanceTestnetTradeId;
  const decisionLogId = journal.decisionLogId?.trim() ?? null;
  const missingFields: EvidenceQualityField[] = [];

  if (!decisionLogId) missingFields.push("decisionLogId");

  const closedEvent =
    journal.status === "CLOSED" ||
    hasClosedMonitorEvent(tradeId, decisionLogId, monitorEvents);
  if (!closedEvent) missingFields.push("closedEvent");

  const realizedPnl = journal.realizedPnl ?? closedTrade?.netPnl ?? null;
  if (realizedPnl == null || !Number.isFinite(realizedPnl)) {
    missingFields.push("realizedPnl");
  }

  const entryPrice =
    closedTrade?.entryPrice ??
    journal.fillPrice ??
    journal.previewPrice ??
    null;
  const exitPrice =
    closedTrade?.exitPrice ?? journal.markPriceAtSubmit ?? null;
  if (
    entryPrice == null ||
    exitPrice == null ||
    !Number.isFinite(entryPrice) ||
    !Number.isFinite(exitPrice)
  ) {
    missingFields.push("entryExitPrice");
  }

  if (!resolveStrategyTag({ journal, closedTrade, learning })) {
    missingFields.push("strategyTag");
  }

  if (resolveAiConfidence({ decision, closedTrade, learning }) == null) {
    missingFields.push("aiConfidence");
  }

  const riskCheckResult =
    decision != null && typeof decision.riskVeto === "boolean";
  if (!riskCheckResult) missingFields.push("riskCheckResult");

  if (!learning) missingFields.push("learningRecord");

  if (!qualityScore) missingFields.push("tradeQualityScore");

  return {
    tradeId,
    symbol: journal.symbol,
    valid: missingFields.length === 0,
    missingFields,
    decisionLogId,
    closedAt: journal.closedAt ?? closedTrade?.closedAt ?? null,
  };
}

function aggregateMissingFields(
  trades: EvidenceTradeAssessment[],
): EvidenceFieldGap[] {
  const counts = new Map<EvidenceQualityField, number>();
  for (const field of ALL_FIELDS) counts.set(field, 0);
  for (const trade of trades) {
    if (trade.valid) continue;
    for (const field of trade.missingFields) {
      counts.set(field, (counts.get(field) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, count]) => count > 0)
    .map(([field, count]) => ({ field, count }))
    .sort((a, b) => b.count - a.count);
}

export function buildEvidenceQualitySnapshot(
  input: EvidenceQualityBuildInput,
): EvidenceQualitySnapshot {
  const generatedAt = new Date().toISOString();
  const closedById = new Map(input.closedTrades.map((t) => [t.id, t]));
  const learningByTrade = new Map(
    input.learningRecords.map((r) => [r.closedTradeId, r]),
  );
  const decisionById = new Map(input.decisions.map((d) => [d.id, d]));
  const qualityByDecision = new Map(
    input.tradeQualityScores.map((s) => [s.decisionLogId, s]),
  );
  const qualityByTrade = new Map(
    input.tradeQualityScores
      .filter((s) => s.tradeId)
      .map((s) => [s.tradeId as string, s]),
  );

  const completedJournal = input.journal.filter(isCompletedJournal);
  const assessments: EvidenceTradeAssessment[] = completedJournal.map((entry) =>
    assessCompletedTrade({
      journal: entry,
      closedTrade: closedById.get(entry.binanceTestnetTradeId) ?? null,
      learning: learningByTrade.get(entry.binanceTestnetTradeId) ?? null,
      decision: entry.decisionLogId
        ? decisionById.get(entry.decisionLogId) ?? null
        : null,
      qualityScore:
        (entry.decisionLogId
          ? qualityByDecision.get(entry.decisionLogId)
          : null) ??
        qualityByTrade.get(entry.binanceTestnetTradeId) ??
        null,
      monitorEvents: input.monitorEvents,
    }),
  );

  const validEvidenceCount = assessments.filter((t) => t.valid).length;
  const invalidEvidenceCount = assessments.filter((t) => !t.valid).length;
  const totalCompletedTrades = assessments.length;
  const missingFields = aggregateMissingFields(assessments);
  const evidenceConfidence =
    totalCompletedTrades === 0
      ? 0
      : Math.round((validEvidenceCount / totalCompletedTrades) * 100);

  const evidenceQualityLevel = resolveEvidenceQualityLevel({
    validEvidenceCount,
    invalidEvidenceCount,
    evidenceConfidence,
  });

  const readinessForStrategyReview = resolveReadinessForStrategyReview({
    validEvidenceCount,
    invalidEvidenceCount,
    evidenceConfidence,
    evidenceQualityLevel,
  });

  const blocksStrategyHealthReview = resolveBlocksStrategyHealthReview({
    evidenceQualityLevel,
    readinessForStrategyReview,
    invalidEvidenceCount,
  });

  const topMissingField = missingFields[0]?.field ?? null;
  const blockReason = blocksStrategyHealthReview
    ? resolveEvidenceBlockReason({
        evidenceQualityLevel,
        readinessForStrategyReview,
        invalidEvidenceCount,
        validEvidenceCount,
        topMissingField,
      })
    : null;

  return {
    mvp: EVIDENCE_QUALITY_MVP,
    label: EVIDENCE_QUALITY_LABEL,
    validEvidenceCount,
    invalidEvidenceCount,
    totalCompletedTrades,
    missingFields,
    evidenceConfidence,
    readinessForStrategyReview,
    evidenceQualityLevel,
    blocksStrategyHealthReview,
    blockReason,
    trades: assessments,
    generatedAt,
  };
}

export function toAnalysisContextEvidenceQualityLink(
  snapshot: EvidenceQualitySnapshot,
): AnalysisContextEvidenceQualityLink {
  return {
    validEvidenceCount: snapshot.validEvidenceCount,
    invalidEvidenceCount: snapshot.invalidEvidenceCount,
    evidenceConfidence: snapshot.evidenceConfidence,
    readinessForStrategyReview: snapshot.readinessForStrategyReview,
    blocksStrategyHealthReview: snapshot.blocksStrategyHealthReview,
    evidenceQualityLevel: snapshot.evidenceQualityLevel,
    topMissingField: snapshot.missingFields[0]?.field ?? null,
  };
}

export function emptyEvidenceQualitySnapshot(): EvidenceQualitySnapshot {
  return buildEvidenceQualitySnapshot({
    journal: [],
    closedTrades: [],
    learningRecords: [],
    decisions: [],
    tradeQualityScores: [],
    monitorEvents: [],
  });
}

/** Trade ids that pass full evidence quality validation — use for performance trust. */
export function selectTrustworthyEvidenceTradeIds(
  snapshot: EvidenceQualitySnapshot,
): Set<string> {
  return new Set(snapshot.trades.filter((t) => t.valid).map((t) => t.tradeId));
}
