import { fetchQuantBacktestCandles } from "@/lib/quant-backtest/fetch-klines";
import { DEFAULT_QUANT_FRICTION } from "@/lib/quant-backtest/friction";
import { simulateQuantTrades } from "@/lib/quant-backtest/simulate-trades";
import { generateSignalSeries } from "@/lib/quant-backtest/signal-runners";
import { buildQuantImporterCatalog } from "@/lib/quant-strategy-importer/build-catalog";
import { loadServerAnalysisJournal } from "@/lib/journal/journal-server-store";
import { filterProductionEntries } from "@/lib/journal/production-filter";
import { listWarehouseRows } from "@/lib/db/repositories/warehouse-repository";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { AdvisoryStrategySignal } from "@/lib/strategy-signals/types";
import { appendShadowTrades, replaceShadowTradesForRun } from "./shadow-store";
import {
  mapCommitteeEntryToShadow,
  mapQuantTradeToShadow,
  tagCommitteeAlignment,
} from "./compute-metrics";
import type { RunShadowInput, StrategyShadowTrade } from "./types";
import { AI_COMMITTEE_SOURCE_ID } from "./types";

const RUNNABLE_IDS = new Set([
  "macd-oscillator",
  "rsi-pattern-recognition",
  "bollinger-bands-pattern",
  "dual-thrust",
  "heikin-ashi",
  "ai-desk-options-premium",
]);

function shadowId(): string {
  return `shadow-fwd-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

async function loadAiPaperOrders(): Promise<PaperOrder[]> {
  try {
    const rows = await listWarehouseRows("paper_trades", 500);
    return rows
      .map((row) => row.payload as unknown as PaperOrder)
      .filter((o) => o && !o.isDemoData && o.paperMode !== "RELAXED_PAPER");
  } catch {
    return [];
  }
}

export async function runQuantImportShadowReplay(input: {
  symbol: "BTCUSDT" | "SOLUSDT";
  lookbackDays: number;
  includeRejected?: boolean;
}): Promise<StrategyShadowTrade[]> {
  const catalog = await buildQuantImporterCatalog();
  const strategies = catalog.strategies.filter(
    (s) =>
      RUNNABLE_IDS.has(s.sourceId) &&
      (input.includeRejected || s.importStatus !== "REJECTED"),
  );

  if (strategies.length === 0) return [];

  const end = new Date();
  const start = new Date(end.getTime() - input.lookbackDays * 86_400_000);
  const candles = await fetchQuantBacktestCandles({
    symbol: input.symbol,
    timeframe: "4h",
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  });

  if (candles.length < 30) return [];

  const trades: StrategyShadowTrade[] = [];
  const runKey = `replay-${input.symbol}-${input.lookbackDays}`;

  for (const card of strategies) {
    const signals = generateSignalSeries(card.sourceId, candles);
    const simulated = simulateQuantTrades({
      candles,
      signals,
      friction: DEFAULT_QUANT_FRICTION,
    });
    for (const t of simulated) {
      trades.push(
        mapQuantTradeToShadow({
          sourceId: card.sourceId,
          strategyName: card.strategyName,
          symbol: input.symbol,
          importStatus: card.importStatus,
          direction: t.direction,
          entryPrice: t.entryPrice,
          exitPrice: t.exitPrice,
          netPnlPct: t.netPnlPct,
          entryTime: t.entryTime,
          exitTime: t.exitTime,
        }),
      );
    }
  }

  const entries = filterProductionEntries(await loadServerAnalysisJournal());
  const aligned = tagCommitteeAlignment(trades, entries);
  await replaceShadowTradesForRun({ runKey, trades: aligned });
  return aligned;
}

export async function runAiCommitteeShadowReplay(): Promise<StrategyShadowTrade[]> {
  const entries = filterProductionEntries(await loadServerAnalysisJournal());
  const trades = entries
    .map(mapCommitteeEntryToShadow)
    .filter((t): t is StrategyShadowTrade => t !== null);
  const runKey = "replay-ai-committee";
  await replaceShadowTradesForRun({ runKey, trades });
  return trades;
}

export async function runForwardShadowCycle(input: {
  signals: AdvisoryStrategySignal[];
  spotPrice: number;
  symbol?: string;
  committeeVerdict?: string;
}): Promise<StrategyShadowTrade[]> {
  const symbol = input.symbol ?? "BTCUSDT";
  const now = new Date().toISOString();
  const trades: StrategyShadowTrade[] = [];

  for (const signal of input.signals) {
    if (signal.signal === "FLAT") continue;
    trades.push({
      id: shadowId(),
      sourceType: "quant_import",
      strategyName: signal.strategyName,
      sourceId: signal.sourceId,
      symbol,
      side: signal.signal,
      entryPrice: input.spotPrice,
      virtualExit: null,
      virtualPnL: null,
      result: "OPEN",
      createdAt: now,
      closedAt: null,
      committeeVerdict: (input.committeeVerdict as StrategyShadowTrade["committeeVerdict"]) ?? null,
      importStatus: signal.importStatus as StrategyShadowTrade["importStatus"],
      advisoryOnly: true,
      executionBlocked: true,
      cannotCountAsLiveProof: true,
    });
  }

  if (input.committeeVerdict === "TRADE") {
    trades.push({
      id: shadowId(),
      sourceType: "ai_committee",
      strategyName: "AI Investment Committee",
      sourceId: AI_COMMITTEE_SOURCE_ID,
      symbol,
      side: "SHORT",
      entryPrice: input.spotPrice,
      virtualExit: null,
      virtualPnL: null,
      result: "OPEN",
      createdAt: now,
      closedAt: null,
      committeeVerdict: "TRADE",
      alignedWithCommittee: true,
      advisoryOnly: true,
      executionBlocked: true,
      cannotCountAsLiveProof: true,
    });
  }

  if (trades.length === 0) return [];
  const entries = filterProductionEntries(await loadServerAnalysisJournal());
  const aligned = tagCommitteeAlignment(trades, entries);
  await appendShadowTrades(aligned);
  return aligned;
}

export async function runStrategyShadowMode(
  input: RunShadowInput = {},
): Promise<{
  quantTrades: StrategyShadowTrade[];
  aiTrades: StrategyShadowTrade[];
  aiPaperOrders: PaperOrder[];
}> {
  const symbol = input.symbol ?? "BTCUSDT";
  const lookbackDays = input.lookbackDays ?? 90;
  const mode = input.mode ?? "replay";

  if (mode === "forward") {
    return { quantTrades: [], aiTrades: [], aiPaperOrders: await loadAiPaperOrders() };
  }

  const [quantTrades, aiTrades, aiPaperOrders] = await Promise.all([
    runQuantImportShadowReplay({ symbol, lookbackDays, includeRejected: input.includeRejected }),
    runAiCommitteeShadowReplay(),
    loadAiPaperOrders(),
  ]);

  return { quantTrades, aiTrades, aiPaperOrders };
}
