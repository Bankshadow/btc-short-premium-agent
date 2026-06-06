import { fetchQuantBacktestCandles } from "@/lib/quant-backtest/fetch-klines";
import {
  detectBarRegime,
  generateSignalSeries,
} from "@/lib/quant-backtest/signal-runners";
import {
  buildQuantImporterCatalog,
  getSeedById,
} from "@/lib/quant-strategy-importer/build-catalog";
import { isGarageApprovedForAiLoop } from "@/lib/strategy-garage/garage-store";
import { TOURNAMENT_CONTESTANTS } from "@/lib/strategy-tournament/contestants";
import type { QuantImportStatus } from "@/lib/quant-strategy-importer/types";
import {
  STRATEGY_SIGNAL_SAFETY_NOTICE,
  type AdvisoryStrategySignal,
  type StrategyAgentFeedTarget,
  type StrategySignalConfidence,
  type StrategySignalDirection,
} from "./types";
import type { SuggestedUse } from "@/lib/quant-strategy-importer/types";
import type { QuantBacktestSymbol } from "@/lib/quant-backtest/types";

const APPROVED_STATUSES: QuantImportStatus[] = [
  "READY_FOR_PAPER",
  "READY_FOR_BACKTEST",
];

const RUNNABLE_IDS = new Set([
  "macd-oscillator",
  "rsi-pattern-recognition",
  "bollinger-bands-pattern",
  "dual-thrust",
  "heikin-ashi",
  "ai-desk-options-premium",
]);

function isApprovedStatus(status: string): boolean {
  return APPROVED_STATUSES.includes(status as QuantImportStatus);
}

function resolveConfidence(
  signal: StrategySignalDirection,
  regime: "bullish" | "bearish" | "neutral",
): StrategySignalConfidence {
  if (signal === "FLAT") return "LOW";
  const aligned =
    (signal === "LONG" && regime === "bullish") ||
    (signal === "SHORT" && regime === "bearish");
  if (aligned) return "HIGH";
  if (regime === "neutral") return "MEDIUM";
  return "LOW";
}

function resolveFeedTargets(
  sourceId: string,
  suggestedUse: SuggestedUse,
): StrategyAgentFeedTarget[] {
  const targets: StrategyAgentFeedTarget[] = ["COMMITTEE"];
  if (sourceId === "ai-desk-options-premium" || suggestedUse === "RESEARCH_ONLY") {
    targets.push("OPTIONS", "MARKET_DATA");
  }
  if (suggestedUse === "ENTRY" || sourceId === "dual-thrust" || sourceId === "macd-oscillator") {
    targets.push("FUTURES");
  }
  if (suggestedUse === "FILTER" || suggestedUse === "EXIT") {
    targets.push("OPTIONS", "FUTURES");
  }
  if (suggestedUse === "RISK_GATE") {
    targets.push("RISK_MANAGER");
  }
  targets.push("MARKET_DATA");
  return [...new Set(targets)];
}

function buildInvalidation(
  sourceId: string,
  signal: StrategySignalDirection,
): string {
  if (signal === "FLAT") return "No active edge — wait for next bar signal.";
  const map: Record<string, string> = {
    "macd-oscillator": "MACD histogram crosses zero against position.",
    "rsi-pattern-recognition": "RSI re-enters neutral 40–60 band.",
    "bollinger-bands-pattern": "Close re-enters Bollinger mid-band.",
    "dual-thrust": "Price returns inside thrust range.",
    "heikin-ashi": "Heikin-Ashi color flip against position.",
    "ai-desk-options-premium": "Desk regime brain blocks options_short_premium.",
  };
  return map[sourceId] ?? `Signal flips to FLAT or opposes ${signal} bias.`;
}

export async function resolveApprovedStrategySignals(input?: {
  symbol?: QuantBacktestSymbol;
  lookbackDays?: number;
}): Promise<AdvisoryStrategySignal[]> {
  const symbol = input?.symbol ?? "BTCUSDT";
  const lookbackDays = input?.lookbackDays ?? 90;
  const end = new Date();
  const start = new Date(end.getTime() - lookbackDays * 86_400_000);

  const catalog = await buildQuantImporterCatalog();
  const approvedCandidates = catalog.strategies.filter(
    (s) => isApprovedStatus(s.importStatus) && RUNNABLE_IDS.has(s.sourceId),
  );
  const approved: typeof approvedCandidates = [];
  for (const s of approvedCandidates) {
    if (await isGarageApprovedForAiLoop(s.sourceId)) approved.push(s);
  }

  const tournamentApproved = TOURNAMENT_CONTESTANTS.filter((c) =>
    RUNNABLE_IDS.has(c.sourceId),
  ).filter((c) => {
    const card = catalog.strategies.find((s) => s.sourceId === c.sourceId);
    return card && isApprovedStatus(card.importStatus);
  });

  const sourceIds = [
    ...new Set([
      ...approved.map((s) => s.sourceId),
      ...tournamentApproved.map((c) => c.sourceId),
    ]),
  ];

  if (sourceIds.length === 0) return [];

  const candles = await fetchQuantBacktestCandles({
    symbol,
    timeframe: "4h",
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  });

  if (candles.length < 30) return [];

  const regime = detectBarRegime(candles, candles.length - 1);
  const signals: AdvisoryStrategySignal[] = [];

  for (const sourceId of sourceIds) {
    const seed = getSeedById(sourceId);
    const card = catalog.strategies.find((s) => s.sourceId === sourceId);
    const contestant = TOURNAMENT_CONTESTANTS.find((c) => c.sourceId === sourceId);
    if (!seed && !contestant) continue;

    const series = generateSignalSeries(sourceId, candles);
    const last = series[series.length - 1] ?? "FLAT";
    const suggestedUse =
      seed?.suggestedUse ??
      (contestant?.suggestedRole === "DESK_PRIMARY"
        ? "RESEARCH_ONLY"
        : contestant?.suggestedRole === "FILTER"
          ? "FILTER"
          : "ENTRY");

    const regimeFit = seed?.marketRegimeFit ?? [regime];
    const fitsRegime =
      (last === "LONG" && regimeFit.includes("bull_trend")) ||
      (last === "SHORT" && regimeFit.includes("bear_trend")) ||
      last === "FLAT";

    signals.push({
      sourceId,
      strategyName: seed?.strategyName ?? contestant?.strategyName ?? sourceId,
      suggestedUse,
      signal: last,
      confidence: resolveConfidence(last, regime),
      regimeFit: fitsRegime
        ? regimeFit.filter((r) => r.includes(regime === "bullish" ? "bull" : regime === "bearish" ? "bear" : "range")).slice(0, 3)
        : [`Current ${regime} regime — weak fit`],
      reasons: [
        `Approved import (${card?.importStatus ?? "READY"}) · 4H signal ${last} on ${symbol}.`,
        seed?.thesis?.slice(0, 120) ?? "Tournament-approved quant overlay.",
      ],
      risks: [
        ...(seed?.riskNotes.slice(0, 2) ?? ["Advisory only — not execution authority."]),
        STRATEGY_SIGNAL_SAFETY_NOTICE,
      ],
      invalidationCondition: buildInvalidation(sourceId, last),
      fedTo: resolveFeedTargets(sourceId, suggestedUse),
      importStatus: card?.importStatus ?? "READY_FOR_BACKTEST",
      advisoryOnly: true,
      executionBlocked: true,
      cannotBypassRiskVeto: true,
      generatedAt: new Date().toISOString(),
    });
  }

  return signals;
}
