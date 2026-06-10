import type { JournalEvent } from "@/lib/journal/journal-types";
import type { ClosedTrade, OpenTrade } from "./trade-types";

function orderPayload(evt: JournalEvent) {
  return evt.payload as {
    symbol?: string;
    side?: "BUY" | "SELL";
    qty?: string;
    quantity?: string;
    orderId?: string;
    clientOrderId?: string;
    notionalUsd?: number;
    entryPrice?: number | null;
    avgPrice?: number | null;
    previewId?: string;
    runId?: string;
    decisionLogId?: string;
    source?: string;
    strategyVersionId?: string;
  };
}

function positionPayload(evt: JournalEvent) {
  return evt.payload as {
    entryPrice?: number | null;
    qty?: string;
    orderId?: string;
  };
}

function closedPayload(evt: JournalEvent) {
  return evt.payload as {
    closeOrderId?: string;
    realizedPnlPending?: boolean;
  };
}

function pnlPayload(evt: JournalEvent) {
  return evt.payload as {
    netPnl?: number;
    result?: string;
    exitPrice?: number;
    learningId?: string;
  };
}

export function buildOpenTradesFromEvents(events: JournalEvent[]): OpenTrade[] {
  const openedTradeIds = new Set(
    events.filter((e) => e.type === "POSITION_OPENED").map((e) => e.tradeId).filter(Boolean),
  );
  const closedTradeIds = new Set(
    events.filter((e) => e.type === "POSITION_CLOSED").map((e) => e.tradeId).filter(Boolean),
  );

  const open: OpenTrade[] = [];

  for (const evt of events) {
    if (evt.type !== "ORDER_EXECUTED" || !evt.tradeId) continue;
    if (!openedTradeIds.has(evt.tradeId)) continue;
    if (closedTradeIds.has(evt.tradeId)) continue;

    const p = orderPayload(evt);
    const positionEvt = events.find(
      (e) => e.type === "POSITION_OPENED" && e.tradeId === evt.tradeId,
    );
    const pos = positionEvt ? positionPayload(positionEvt) : {};

    open.push({
      tradeId: evt.tradeId,
      previewId: evt.previewId ?? p.previewId ?? "",
      runId: evt.runId ?? p.runId ?? "",
      decisionLogId: evt.decisionLogId ?? p.decisionLogId ?? "",
      environment: "TESTNET",
      symbol: String(p.symbol ?? ""),
      side: p.side ?? "SELL",
      qty: String(p.qty ?? p.quantity ?? pos.qty ?? ""),
      notionalUsd: Number(p.notionalUsd ?? 0),
      orderId: String(p.orderId ?? pos.orderId ?? ""),
      clientOrderId: String(p.clientOrderId ?? ""),
      entryPrice:
        pos.entryPrice ??
        p.entryPrice ??
        (p.avgPrice != null ? Number(p.avgPrice) : null),
      status: "OPEN",
      openedAt: positionEvt?.timestamp ?? evt.timestamp,
      source: "BINANCE_TESTNET",
      strategyVersionId: p.strategyVersionId ?? null,
    });
  }

  return open.sort((a, b) => b.openedAt.localeCompare(a.openedAt));
}

export function buildClosedTradesFromEvents(events: JournalEvent[]): ClosedTrade[] {
  const closedTrades: ClosedTrade[] = [];

  for (const evt of events) {
    if (evt.type !== "POSITION_CLOSED" || !evt.tradeId) continue;
    const orderEvt = events.find(
      (e) => e.type === "ORDER_EXECUTED" && e.tradeId === evt.tradeId,
    );
    const pnlEvt = events.find(
      (e) => e.type === "PNL_REALIZED" && e.tradeId === evt.tradeId,
    );
    const learningEvt = events.find(
      (e) =>
        (e.type === "LEARNING_RECORD_CREATED" || e.type === "LEARNING_CREATED") &&
        e.tradeId === evt.tradeId,
    );
    const order = orderEvt ? orderPayload(orderEvt) : {};
    const pnl = pnlEvt ? pnlPayload(pnlEvt) : {};
    const closedMeta = closedPayload(evt);

    closedTrades.push({
      tradeId: evt.tradeId,
      previewId: orderEvt?.previewId ?? null,
      runId: orderEvt?.runId ?? null,
      decisionLogId: orderEvt?.decisionLogId ?? null,
      environment: "TESTNET",
      symbol: String(order.symbol ?? ""),
      side: order.side ?? "SELL",
      qty: String(order.qty ?? order.quantity ?? ""),
      entryPrice: order.entryPrice ?? (order.avgPrice != null ? Number(order.avgPrice) : null),
      exitPrice: pnl.exitPrice ?? null,
      netPnl: Number(pnl.netPnl ?? 0),
      result: closedMeta.realizedPnlPending ? "PENDING_PNL" : String(pnl.result ?? "UNKNOWN"),
      status: closedMeta.realizedPnlPending ? "CLOSED_PENDING_PNL" : "CLOSED",
      closeOrderId: closedMeta.closeOrderId ?? null,
      openedAt: orderEvt?.timestamp ?? evt.timestamp,
      closedAt: evt.timestamp,
      learningId:
        (learningEvt?.payload as { learningId?: string } | undefined)?.learningId ??
        pnl.learningId ??
        null,
      source: "BINANCE_TESTNET",
      strategyVersionId: order.strategyVersionId ?? null,
    });
  }

  return closedTrades.sort((a, b) => b.closedAt.localeCompare(a.closedAt));
}
