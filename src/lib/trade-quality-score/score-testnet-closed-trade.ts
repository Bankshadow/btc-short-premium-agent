import type { BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { TestnetClosedTrade } from "@/lib/testnet-monitor/types";
import {
  buildTradeQualityScore,
  computeWeightedComposite,
  gradeFromComposite,
} from "./score-trade";
import { scoreMarketRegimeFit } from "./score-market-regime-fit";
import type { TradeQualityDimensions, TradeQualityScore } from "./types";

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function pnlPctFromJournal(
  journal: BinanceTestnetJournalEntry,
  closedTrade?: TestnetClosedTrade,
): number {
  const net = journal.realizedPnl ?? closedTrade?.netPnl ?? 0;
  const notional = Math.max(1, journal.notionalUsd ?? 100);
  return Number(((net / notional) * 100).toFixed(3));
}

function scoreJournalOnly(input: {
  journal: BinanceTestnetJournalEntry;
  closedTrade?: TestnetClosedTrade;
  decision?: DecisionLogEntry;
  pnlPct: number;
  tradeWouldWin: boolean | null;
}): TradeQualityDimensions {
  const j = input.journal;
  let setup = 40;
  let entry = 45;
  let execution = 50;
  let exit = 48;
  let rules = 55;
  let reasoning = 45;
  let regime = 40;

  if (j.reason?.trim()) setup += 15;
  if (j.decisionLogId) reasoning += 20;
  else reasoning -= 25;

  if (input.decision) {
    regime = scoreMarketRegimeFit(input.decision, j.source ?? input.closedTrade?.strategy);
    reasoning = clamp(
      reasoning * 0.5 +
        (input.decision.agentOutputs.length >= 2 ? 55 : 45) * 0.5 +
        (input.decision.playbookConfidence != null ? 8 : 0),
    );
  } else if (j.source) regime += 10;

  if (j.blockReasons.length === 0) rules += 15;
  else rules -= j.blockReasons.length * 8;

  if (j.duplicateSubmission) rules -= 20;
  if (j.closeFailed) {
    exit -= 25;
    execution -= 15;
  }
  if (j.partialFill) execution -= 10;
  if (j.slippageBps != null && j.slippageBps > 20) execution -= 12;
  else if (j.slippageBps != null && j.slippageBps <= 10) execution += 8;

  if (j.status === "CLOSED" && j.realizedPnl != null) exit += 15;
  if (j.closeAttempt) exit += 8;

  if (input.tradeWouldWin === true && j.side) entry += 12;
  if (input.tradeWouldWin === false) entry -= 10;
  if (input.pnlPct > 0) entry += 5;

  const riskReward = clamp(52 + (input.pnlPct > 0 ? 8 : input.pnlPct < -2 ? -12 : 0));

  return {
    setupQuality: clamp(setup),
    marketRegimeFit: clamp(regime),
    entryQuality: clamp(entry),
    riskReward,
    executionQuality: clamp(execution),
    exitQuality: clamp(exit),
    ruleCompliance: clamp(rules),
    reasoningConsistency: clamp(reasoning),
  };
}

function buildStrengthsWeaknesses(dimensions: TradeQualityDimensions): {
  strengths: string[];
  weaknesses: string[];
} {
  const ranked = (Object.keys(dimensions) as (keyof TradeQualityDimensions)[])
    .map((key) => ({ key, value: dimensions[key] }))
    .sort((a, b) => b.value - a.value);

  const strengths = ranked
    .filter((d) => d.value >= 70)
    .slice(0, 2)
    .map((d) => `${d.key}: ${d.value}/100`);

  const weaknesses = ranked
    .filter((d) => d.value < 60)
    .slice(0, 3)
    .map((d) => `${d.key}: ${d.value}/100`);

  return { strengths, weaknesses };
}

function normalizeMvp76Fields(
  score: TradeQualityScore,
  tradeId: string,
  dataConfidence: number,
): TradeQualityScore {
  const { strengths, weaknesses } = buildStrengthsWeaknesses(score.dimensions);
  return {
    ...score,
    tradeId,
    numericScore: score.compositeScore,
    reasoningConsistency: score.dimensions.reasoningConsistency,
    strengths,
    weaknesses,
    improvementSuggestion: score.improvements[0] ?? null,
    dataConfidence,
  };
}

export function buildTestnetClosedTradeQualityScore(input: {
  journal: BinanceTestnetJournalEntry;
  closedTrade?: TestnetClosedTrade;
  decision?: DecisionLogEntry;
}): TradeQualityScore {
  const tradeId = input.journal.binanceTestnetTradeId;
  const pnlPct = pnlPctFromJournal(input.journal, input.closedTrade);
  const tradeWouldWin =
    pnlPct > 0 ? true : pnlPct < 0 ? false : null;

  let dataConfidence = 1;
  if (!input.journal.decisionLogId) dataConfidence -= 0.35;
  if (!input.decision) dataConfidence -= 0.25;
  if (input.journal.realizedPnl == null) dataConfidence -= 0.2;
  dataConfidence = Math.max(0.2, dataConfidence);

  let score: TradeQualityScore;

  if (input.decision) {
    score = buildTradeQualityScore({
      entry: input.decision,
      source: "testnet_closed",
      pnlPct,
      tradeWouldWin,
    });
    score.scoreId = `tqs-${tradeId}-${Date.now()}`;
    score.decisionLogId = input.decision.id;

    if (input.journal.blockReasons.length > 0) {
      score.dimensions.ruleCompliance = clamp(
        score.dimensions.ruleCompliance - input.journal.blockReasons.length * 10,
      );
    }
    if (input.journal.duplicateSubmission) {
      score.dimensions.ruleCompliance = clamp(score.dimensions.ruleCompliance - 25);
    }
    if (input.journal.closeFailed) {
      score.dimensions.exitQuality = clamp(score.dimensions.exitQuality - 20);
      score.dimensions.executionQuality = clamp(
        score.dimensions.executionQuality - 15,
      );
    }
    score.compositeScore = clamp(
      computeWeightedComposite(score.dimensions) * dataConfidence,
    );
    score.grade = gradeFromComposite(score.compositeScore);
  } else {
    const dimensions = scoreJournalOnly({
      journal: input.journal,
      closedTrade: input.closedTrade,
      decision: input.decision,
      pnlPct,
      tradeWouldWin,
    });
    const composite = clamp(
      computeWeightedComposite(dimensions) * dataConfidence,
    );
    score = {
      scoreId: `tqs-${tradeId}-${Date.now()}`,
      tradeId,
      decisionLogId: input.journal.decisionLogId ?? tradeId,
      generatedAt: new Date().toISOString(),
      source: "testnet_closed",
      grade: gradeFromComposite(composite),
      compositeScore: composite,
      dimensions,
      primaryReason: `Testnet close graded from journal${input.journal.decisionLogId ? "" : " (missing decision link)"}.`,
      improvements: [],
      pnlPct,
      tradeWouldWin,
      safetyNotice:
        "Trade quality scores are advisory — they grade decision process, not authorization to trade. Poor grades may reduce mission confidence but cannot enable live risk.",
      advisoryOnly: true,
    };
  }

  return normalizeMvp76Fields(score, tradeId, dataConfidence);
}
