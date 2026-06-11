import type { JournalEvent } from "@/lib/journal/journal-types";
import { getLatestMonitoredSnapshots } from "@/lib/positions/position-snapshots-from-events";
import type { PositionSnapshot } from "@/lib/positions/position-types";
import {
  buildClosedTradesFromEvents,
  buildOpenTradesFromEvents,
} from "@/lib/trades/trade-store";
import type { ClosedTrade, OpenTrade } from "@/lib/trades/trade-types";

export const LOCAL_OPEN_TRADE_BUT_EXCHANGE_FLAT = "LOCAL_OPEN_TRADE_BUT_EXCHANGE_FLAT";
export const MANUAL_REPAIR_REQUIRED = "MANUAL_REPAIR_REQUIRED";
export const PNL_PENDING_MESSAGE =
  "PnL pending: missing entry/exit price or fill data.";

export type ProjectedTradeStatus = "OPEN" | "CLOSED_PENDING_PNL" | "RECONCILIATION_REQUIRED";

export interface StaleOpenTradeWarning {
  tradeId: string;
  projectedStatus: ProjectedTradeStatus;
  warnings: string[];
  recommendation?: typeof MANUAL_REPAIR_REQUIRED;
}

export interface TradeReconciliationResult {
  projectedStatus: ProjectedTradeStatus;
  warnings: string[];
  recommendation?: typeof MANUAL_REPAIR_REQUIRED;
  countsAsOpen: boolean;
}

export interface ReconciledTradeProjection {
  open: OpenTrade[];
  closed: ClosedTrade[];
  staleOpenWarnings: StaleOpenTradeWarning[];
  effectiveOpenCount: number;
}

export function isFlatPosition(snapshot: PositionSnapshot | null | undefined): boolean {
  if (!snapshot) return false;
  if (snapshot.status === "FLAT") return true;
  const qty = parseFloat(snapshot.qty);
  return Number.isFinite(qty) && qty === 0;
}

export function isZeroTradeQty(qty: string): boolean {
  const n = parseFloat(qty);
  return !Number.isFinite(n) || n === 0;
}

export function hasCloseEventForTrade(events: JournalEvent[], tradeId: string): boolean {
  return events.some(
    (e) =>
      e.tradeId === tradeId &&
      (e.type === "CLOSE_ORDER_EXECUTED" || e.type === "POSITION_CLOSED"),
  );
}

export function reconcileOpenTrade(
  trade: OpenTrade,
  position: PositionSnapshot | null | undefined,
  events: JournalEvent[],
): TradeReconciliationResult {
  const flatOnExchange = isFlatPosition(position);
  const zeroLocalQty = isZeroTradeQty(trade.qty);

  if (!flatOnExchange && !zeroLocalQty) {
    return { projectedStatus: "OPEN", warnings: [], countsAsOpen: true };
  }

  const hasClose = hasCloseEventForTrade(events, trade.tradeId);
  if (hasClose) {
    return {
      projectedStatus: "CLOSED_PENDING_PNL",
      warnings: [LOCAL_OPEN_TRADE_BUT_EXCHANGE_FLAT],
      countsAsOpen: false,
    };
  }

  return {
    projectedStatus: "RECONCILIATION_REQUIRED",
    warnings: [LOCAL_OPEN_TRADE_BUT_EXCHANGE_FLAT],
    recommendation: MANUAL_REPAIR_REQUIRED,
    countsAsOpen: false,
  };
}

function buildPendingClosedFromOpen(
  trade: OpenTrade,
  events: JournalEvent[],
): ClosedTrade {
  const closeEvt = events.find(
    (e) =>
      e.tradeId === trade.tradeId &&
      (e.type === "POSITION_CLOSED" || e.type === "CLOSE_ORDER_EXECUTED"),
  );
  const closePayload = (closeEvt?.payload ?? {}) as { closeOrderId?: string };

  return {
    tradeId: trade.tradeId,
    previewId: trade.previewId,
    runId: trade.runId,
    decisionLogId: trade.decisionLogId,
    environment: trade.environment,
    symbol: trade.symbol,
    side: trade.side,
    qty: trade.qty,
    entryPrice: trade.entryPrice,
    exitPrice: null,
    netPnl: 0,
    result: "PENDING_PNL",
    status: "CLOSED_PENDING_PNL",
    pnlStatus: "PENDING_DATA",
    closeOrderId: closePayload.closeOrderId ?? null,
    openedAt: trade.openedAt,
    closedAt: closeEvt?.timestamp ?? new Date().toISOString(),
    learningId: null,
    source: trade.source,
    strategyVersionId: trade.strategyVersionId,
  };
}

export function applyTradeReconciliation(
  events: JournalEvent[],
  rawOpen?: OpenTrade[],
  rawClosed?: ClosedTrade[],
): ReconciledTradeProjection {
  const openTrades = rawOpen ?? buildOpenTradesFromEvents(events);
  const closedTrades = rawClosed ?? buildClosedTradesFromEvents(events);
  const snapshots = getLatestMonitoredSnapshots(events);

  const open: OpenTrade[] = [];
  const additionalClosed: ClosedTrade[] = [];
  const staleOpenWarnings: StaleOpenTradeWarning[] = [];
  const existingClosedIds = new Set(closedTrades.map((t) => t.tradeId));

  for (const trade of openTrades) {
    const position = snapshots.get(trade.tradeId) ?? null;
    const recon = reconcileOpenTrade(trade, position, events);

    if (recon.projectedStatus === "OPEN") {
      open.push(trade);
      continue;
    }

    staleOpenWarnings.push({
      tradeId: trade.tradeId,
      projectedStatus: recon.projectedStatus,
      warnings: recon.warnings,
      recommendation: recon.recommendation,
    });

    if (
      recon.projectedStatus === "CLOSED_PENDING_PNL" &&
      !existingClosedIds.has(trade.tradeId)
    ) {
      additionalClosed.push(buildPendingClosedFromOpen(trade, events));
      existingClosedIds.add(trade.tradeId);
    }
  }

  return {
    open,
    closed: [...closedTrades, ...additionalClosed],
    staleOpenWarnings,
    effectiveOpenCount: open.length,
  };
}

export function countEffectiveOpenPositions(events: JournalEvent[]): number {
  return applyTradeReconciliation(events).effectiveOpenCount;
}
