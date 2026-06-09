import {
  getBinanceStatus,
  getOpenOrders,
  getPositions,
} from "@/lib/exchange/binance/binance-futures-testnet";
import { loadBinanceConfig, blockBinanceProductionOrder } from "@/lib/exchange/binance/binance-config";
import type { BinanceOpenOrder, BinancePosition } from "@/lib/exchange/binance/binance-types";
import type { BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import { loadServerBinanceTestnetJournal, saveServerBinanceTestnetJournal } from "@/lib/exchange/binance/binance-testnet-journal-server";
import { backfillOrphanBinanceJournalEntries } from "@/lib/exchange/binance/binance-journal-backfill";
import { reconcileBinancePositions } from "@/lib/exchange/binance/binance-position-monitor";
import { loadServerAnalysisJournal } from "@/lib/journal/journal-server-store";
import { mapBinanceSource } from "./decision-linkage";
import { buildExecutionQualitySummary } from "@/lib/execution-quality";
import {
  buildAgentScoreboardSegmentFromRecords,
  buildLearningQueueFromRecords,
  buildStrategyPerformanceSegmentFromRecords,
  buildValidationMetricsSegmentFromRecords,
  syncLearningRecordsFromClosedTradesServer,
} from "./learning-records-server";
import {
  buildEquitySeries,
  calculateDailyPnl,
  calculateMaxDrawdown,
  calculateUnrealizedPnlPct,
  calculateWinRate,
  classifyTradeResult,
  groupPnlByStrategy,
  groupPnlBySymbol,
  sumRealizedPnl,
  sumUnrealizedPnl,
} from "./pnl";
import type {
  TestnetClosedTrade,
  TestnetMonitorSnapshot,
  TestnetMonitorSummary,
  TestnetOrder,
  TestnetPosition,
  TestnetPositionSide,
  TestnetRiskStatus,
} from "./types";

function positionSideFromAmt(amt: number): TestnetPositionSide {
  return amt >= 0 ? "LONG" : "SHORT";
}

function mapExchangePosition(
  pos: BinancePosition,
  journal: BinanceTestnetJournalEntry | undefined,
): TestnetPosition {
  const qty = Math.abs(Number(pos.positionAmt));
  const entry = Number(pos.entryPrice);
  const mark = Number(pos.markPrice);
  const side = positionSideFromAmt(Number(pos.positionAmt));
  const unrealized = Number(pos.unRealizedProfit);
  const notional = Math.abs(Number(pos.notional)) || qty * mark;
  const source = journal ? mapBinanceSource(journal.source) : "MANUAL_TEST";

  return {
    id: `pos-${pos.symbol}-${side}`,
    exchange: "BINANCE",
    symbol: pos.symbol,
    side,
    qty: String(qty),
    entryPrice: entry,
    markPrice: mark,
    liquidationPrice: null,
    leverage: Number(pos.leverage) || 1,
    margin: null,
    unrealizedPnl: unrealized,
    unrealizedPnlPct: calculateUnrealizedPnlPct(unrealized, notional),
    notionalUsd: notional,
    openedAt: journal?.executedAt ?? journal?.createdAt ?? new Date().toISOString(),
    decisionLogId: journal?.decisionLogId ?? null,
    source,
    strategy: journal?.source ?? null,
    aiVerdict: null,
    confidence: null,
    status: journal?.status === "CLOSING" ? "CLOSING" : "OPEN",
    previewId: journal?.previewId ?? null,
    journalTradeId: journal?.binanceTestnetTradeId ?? null,
  };
}

function mapExchangeOrder(
  order: BinanceOpenOrder,
  journal: BinanceTestnetJournalEntry | undefined,
): TestnetOrder {
  const source = journal ? mapBinanceSource(journal.source) : "MANUAL_TEST";
  return {
    id: String(order.orderId),
    exchange: "BINANCE",
    symbol: order.symbol,
    side: order.side,
    positionSide: order.side === "BUY" ? "LONG" : "SHORT",
    orderType: order.type,
    status: order.status,
    qty: order.origQty,
    avgFillPrice: Number(order.executedQty) > 0 ? null : null,
    fee: null,
    clientOrderId: null,
    exchangeOrderId: String(order.orderId),
    previewId: journal?.previewId ?? null,
    decisionLogId: journal?.decisionLogId ?? null,
    source,
    aiVerdict: null,
    confidence: null,
    strategy: journal?.source ?? null,
    createdAt: new Date(order.time).toISOString(),
    updatedAt: new Date(order.time).toISOString(),
  };
}

function buildClosedTrades(
  journal: BinanceTestnetJournalEntry[],
): TestnetClosedTrade[] {
  const closed: TestnetClosedTrade[] = [];
  for (const entry of journal) {
    if (entry.status !== "CLOSED" && !(entry.closedAt && entry.realizedPnl != null)) {
      continue;
    }
    const qty = Math.abs(Number(entry.quantity));
    const side: TestnetPositionSide =
      entry.side === "BUY" ? "LONG" : "SHORT";
    const fee = entry.fees ?? 0;
    const netPnl = entry.realizedPnl ?? 0;
    const grossPnl = netPnl + fee;
    const openedAt = entry.executedAt ?? entry.createdAt;
    const closedAt = entry.closedAt ?? entry.createdAt;
    const durationMs = Math.max(0, Date.parse(closedAt) - Date.parse(openedAt));

    closed.push({
      id: entry.binanceTestnetTradeId,
      exchange: "BINANCE",
      symbol: entry.symbol,
      side,
      entryPrice: 0,
      exitPrice: 0,
      qty: entry.quantity,
      grossPnl,
      fee,
      netPnl,
      rMultiple: null,
      result: classifyTradeResult(netPnl),
      durationMs,
      decisionLogId: entry.decisionLogId,
      strategy: entry.source,
      aiVerdict: null,
      confidence: null,
      openedAt,
      closedAt,
      notes: entry.operatorNote,
      learned: false,
      previewId: entry.previewId,
    });
  }
  return closed;
}

function reconcileJournalStatuses(
  journal: BinanceTestnetJournalEntry[],
  positions: BinancePosition[],
): BinanceTestnetJournalEntry[] {
  const openSymbols = new Set(
    positions
      .filter((p) => Math.abs(Number(p.positionAmt)) > 0)
      .map((p) => p.symbol),
  );
  return journal.map((entry) => {
    if (entry.status === "CLOSING" && !openSymbols.has(entry.symbol)) {
      const pnl =
        entry.realizedPnl ??
        (entry.notionalUsd ? entry.notionalUsd * 0.001 : 0);
      return {
        ...entry,
        status: "CLOSED" as const,
        closedAt: entry.closedAt ?? new Date().toISOString(),
        realizedPnl: pnl,
      };
    }
    if (
      (entry.status === "SUBMITTED" || entry.status === "FILLED") &&
      openSymbols.has(entry.symbol)
    ) {
      return { ...entry, status: "FILLED" as const };
    }
    return entry;
  });
}

function resolveRiskStatus(input: {
  liveBlock: string | null;
  connected: boolean;
  mismatches: string[];
}): TestnetRiskStatus {
  if (input.liveBlock) return "BLOCKED";
  if (!input.connected) return "CAUTION";
  if (input.mismatches.length > 0) return "CAUTION";
  return "SAFE";
}

function buildSummary(input: {
  openPositions: TestnetPosition[];
  closedTrades: TestnetClosedTrade[];
  riskStatus: TestnetRiskStatus;
}): TestnetMonitorSummary {
  const totalUnrealized = sumUnrealizedPnl(input.openPositions);
  const totalRealized = sumRealizedPnl(input.closedTrades);
  const equitySeries = buildEquitySeries(
    input.closedTrades,
    input.openPositions,
  );
  const daily = calculateDailyPnl(input.closedTrades);
  const today = new Date().toISOString().slice(0, 10);
  const dailyPnl =
    daily.find((d) => d.date === today)?.netPnl ?? 0;

  return {
    openPositionCount: input.openPositions.length,
    totalUnrealizedPnl: totalUnrealized,
    totalRealizedPnl: totalRealized,
    netPnl: totalUnrealized + totalRealized,
    dailyPnl,
    winRate: calculateWinRate(input.closedTrades),
    tradeCount: input.closedTrades.length,
    winningTrades: input.closedTrades.filter((t) => t.result === "WIN").length,
    losingTrades: input.closedTrades.filter((t) => t.result === "LOSS").length,
    totalFees: input.closedTrades.reduce((s, t) => s + t.fee, 0),
    maxDrawdown: calculateMaxDrawdown(equitySeries),
    riskStatus: input.riskStatus,
    environment: "TESTNET",
    exchange: "BINANCE",
    liveTradingDisabled: true,
  };
}

export async function buildTestnetMonitorSnapshot(): Promise<TestnetMonitorSnapshot> {
  const liveBlock = blockBinanceProductionOrder();
  const config = loadBinanceConfig();
  let connected = false;
  let positions: BinancePosition[] = [];
  let orders: BinanceOpenOrder[] = [];
  let mismatches: string[] = [];

  try {
    const status = await getBinanceStatus();
    connected = status.connected;
    if (!liveBlock && config.testnetEnabled) {
      [positions, orders] = await Promise.all([
        getPositions(),
        getOpenOrders(),
      ]);
    }
  } catch {
    connected = false;
  }

  let journal = await loadServerBinanceTestnetJournal();
  journal = reconcileJournalStatuses(journal, positions);
  const backfill = backfillOrphanBinanceJournalEntries({ positions, journal });
  if (backfill.backfilledSymbols.length > 0) {
    journal = backfill.journal;
    await saveServerBinanceTestnetJournal(journal);
  }
  const reconcile = reconcileBinancePositions({ positions, journal });
  mismatches = reconcile.mismatches;

  const journalBySymbol = new Map<string, BinanceTestnetJournalEntry>();
  for (const j of journal) {
    if (!journalBySymbol.has(j.symbol)) journalBySymbol.set(j.symbol, j);
  }

  const openPositions = positions
    .filter((p) => Math.abs(Number(p.positionAmt)) > 0)
    .map((p) => mapExchangePosition(p, journalBySymbol.get(p.symbol)));

  const openOrders = orders.map((o) =>
    mapExchangeOrder(o, journalBySymbol.get(o.symbol)),
  );

  const closedTrades = buildClosedTrades(journal);
  const decisions = await loadServerAnalysisJournal().catch(() => []);
  const learningRecords = await syncLearningRecordsFromClosedTradesServer({
    closedTrades,
    journal,
    decisions,
  });
  const learningQueue = buildLearningQueueFromRecords(learningRecords);
  const agentScoreboardSegment =
    buildAgentScoreboardSegmentFromRecords(learningRecords);
  const strategyPerformanceSegment =
    buildStrategyPerformanceSegmentFromRecords(learningRecords);
  const validationMetricsSegment =
    buildValidationMetricsSegmentFromRecords(learningRecords);
  const executionQuality = buildExecutionQualitySummary({
    testnetJournal: journal,
  });
  const equitySeries = buildEquitySeries(closedTrades, openPositions);
  const riskStatus = resolveRiskStatus({
    liveBlock,
    connected,
    mismatches,
  });
  const summary = buildSummary({ openPositions, closedTrades, riskStatus });

  return {
    openPositions,
    openOrders,
    closedTrades,
    summary,
    dailyPnlSeries: calculateDailyPnl(closedTrades),
    pnlBySymbol: groupPnlBySymbol(closedTrades),
    pnlByStrategy: groupPnlByStrategy(closedTrades),
    equitySeries,
    learningRecords,
    learningQueue,
    agentScoreboardSegment,
    strategyPerformanceSegment,
    validationMetricsSegment,
    executionQuality,
    lastUpdatedAt: new Date().toISOString(),
    connected,
    mismatches,
  };
}

export function buildPnlReport(snapshot: TestnetMonitorSnapshot) {
  return {
    summary: snapshot.summary,
    dailyPnlSeries: snapshot.dailyPnlSeries,
    pnlBySymbol: snapshot.pnlBySymbol,
    pnlByStrategy: snapshot.pnlByStrategy,
    equitySeries: snapshot.equitySeries,
    lastUpdatedAt: snapshot.lastUpdatedAt,
  };
}
