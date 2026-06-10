import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { buildMissionSnapshot } from "@/lib/mission/mission-snapshot";
import type { JournalEvent } from "@/lib/journal/journal-types";
import { calculateRealizedPnl } from "./pnl-calculator";
import { hasPnlRealized } from "./pnl-store";
import type { CalculatePnlResult, RealizedPnlRecord } from "./pnl-types";

function orderPayload(evt: JournalEvent) {
  return evt.payload as {
    symbol?: string;
    side?: "BUY" | "SELL";
    qty?: string;
    quantity?: string;
    entryPrice?: number;
    avgPrice?: number | string;
  };
}

function closeOrderPayload(evt: JournalEvent) {
  return evt.payload as { avgPrice?: number | string; executedQty?: string; qty?: string };
}

function loadTradeContext(tradeId: string, events: JournalEvent[]) {
  const closedEvt = events.find((e) => e.type === "POSITION_CLOSED" && e.tradeId === tradeId);
  const orderEvt = events.find((e) => e.type === "ORDER_EXECUTED" && e.tradeId === tradeId);
  const openEvt = events.find((e) => e.type === "POSITION_OPENED" && e.tradeId === tradeId);
  const closeOrderEvt = events.find((e) => e.type === "CLOSE_ORDER_EXECUTED" && e.tradeId === tradeId);
  const order = orderEvt ? orderPayload(orderEvt) : {};
  const openPayload = openEvt?.payload as { entryPrice?: number } | undefined;
  const entryPrice =
    openPayload?.entryPrice ??
    (order.entryPrice != null ? Number(order.entryPrice) : null) ??
    (order.avgPrice != null ? Number(order.avgPrice) : null);
  const closePayload = closeOrderEvt ? closeOrderPayload(closeOrderEvt) : {};
  const exitPrice = closePayload.avgPrice != null ? Number(closePayload.avgPrice) : null;
  return {
    closedEvt,
    orderEvt,
    closeOrderEvt,
    symbol: String(order.symbol ?? (closedEvt?.payload as { symbol?: string }).symbol ?? ""),
    side: (order.side ?? "SELL") as "BUY" | "SELL",
    qty: String(order.qty ?? order.quantity ?? (closedEvt?.payload as { qty?: string }).qty ?? "0"),
    entryPrice,
    exitPrice,
    runId: closedEvt?.runId ?? orderEvt?.runId ?? null,
    decisionLogId: closedEvt?.decisionLogId ?? orderEvt?.decisionLogId ?? null,
  };
}

export async function calculatePnlForTrade(tradeId: string): Promise<CalculatePnlResult> {
  if (!tradeId) {
    return { ok: false, record: null, status: "PNL_PENDING_DATA", message: "tradeId is required." };
  }

  if (await hasPnlRealized(tradeId)) {
    const events = await getEvents();
    const existing = events.find((e) => e.type === "PNL_REALIZED" && e.tradeId === tradeId);
    const p = existing?.payload as Partial<RealizedPnlRecord>;
    return {
      ok: true,
      alreadyRealized: true,
      status: "REALIZED",
      message: "PnL already realized.",
      record: existing
        ? {
            tradeId,
            runId: existing.runId ?? null,
            decisionLogId: existing.decisionLogId ?? null,
            symbol: String(p.symbol ?? ""),
            side: (p.side as RealizedPnlRecord["side"]) ?? "SELL",
            qty: String(p.qty ?? "0"),
            entryPrice: Number(p.entryPrice ?? 0),
            exitPrice: Number(p.exitPrice ?? 0),
            grossPnl: Number(p.grossPnl ?? 0),
            feeEstimate: Number(p.feeEstimate ?? 0),
            netPnl: Number(p.netPnl ?? 0),
            pnlPct: Number(p.pnlPct ?? 0),
            result: (p.result as RealizedPnlRecord["result"]) ?? "BREAKEVEN",
            calculatedAt: String(p.calculatedAt ?? existing.timestamp),
            status: "REALIZED",
          }
        : null,
    };
  }

  const events = await getEvents();
  const ctx = loadTradeContext(tradeId, events);

  if (!ctx.closedEvt) {
    return {
      ok: false,
      record: null,
      status: "PNL_PENDING_DATA",
      message: "POSITION_CLOSED not found for trade.",
    };
  }

  await appendEvent({
    type: "PNL_CALCULATION_STARTED",
    environment: "testnet",
    runId: ctx.runId ?? undefined,
    decisionLogId: ctx.decisionLogId ?? undefined,
    tradeId,
    payload: { tradeId, symbol: ctx.symbol },
  });

  const calc = calculateRealizedPnl({
    tradeId,
    symbol: ctx.symbol,
    side: ctx.side,
    qty: ctx.qty,
    entryPrice: ctx.entryPrice,
    exitPrice: ctx.exitPrice,
  });

  if (!calc.ok || calc.netPnl == null || calc.result == null) {
    await appendEvent({
      type: "ERROR_RECORDED",
      environment: "testnet",
      runId: ctx.runId ?? undefined,
      decisionLogId: ctx.decisionLogId ?? undefined,
      tradeId,
      payload: { phase: "PNL_CALCULATION", message: calc.message, tradeId },
    });
    return { ok: false, record: null, status: "PNL_PENDING_DATA", message: calc.message };
  }

  const calculatedAt = new Date().toISOString();
  const record: RealizedPnlRecord = {
    tradeId,
    runId: ctx.runId,
    decisionLogId: ctx.decisionLogId,
    symbol: ctx.symbol,
    side: ctx.side,
    qty: ctx.qty,
    entryPrice: ctx.entryPrice!,
    exitPrice: ctx.exitPrice!,
    grossPnl: calc.grossPnl!,
    feeEstimate: calc.feeEstimate,
    netPnl: calc.netPnl,
    pnlPct: calc.pnlPct!,
    result: calc.result,
    calculatedAt,
    status: "REALIZED",
  };

  await appendEvent({
    type: "PNL_REALIZED",
    environment: "testnet",
    runId: ctx.runId ?? undefined,
    decisionLogId: ctx.decisionLogId ?? undefined,
    tradeId,
    payload: { ...record },
  });

  await appendEvent({
    type: "TRADE_RESULT_CLASSIFIED",
    environment: "testnet",
    runId: ctx.runId ?? undefined,
    decisionLogId: ctx.decisionLogId ?? undefined,
    tradeId,
    payload: { tradeId, result: record.result, netPnl: record.netPnl },
  });

  const updatedEvents = await getEvents();
  const mission = buildMissionSnapshot(updatedEvents);
  await appendEvent({
    type: "MISSION_SNAPSHOT_UPDATED",
    environment: "testnet",
    runId: ctx.runId ?? undefined,
    decisionLogId: ctx.decisionLogId ?? undefined,
    tradeId,
    payload: {
      currentEquity: mission.currentEquity,
      netPnl: mission.netPnl,
      win: mission.win,
      loss: mission.loss,
      breakeven: mission.breakeven,
      totalTrades: mission.totalTrades,
      phase: "PNL_REALIZED",
    },
  });

  await afterPnlHooks(tradeId);

  return { ok: true, record, status: "REALIZED", message: calc.message };
}

async function afterPnlHooks(tradeId: string) {
  const { runPostTradeLoop } = await import("@/lib/loops/post-trade-loop");
  await runPostTradeLoop(tradeId);
}
