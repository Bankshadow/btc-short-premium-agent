import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import type { JournalEvent } from "@/lib/journal/journal-types";
import { buildMissionSnapshot } from "@/lib/mission/mission-snapshot";
import { isLiveEnabled } from "@/lib/risk/risk-gate";
import { calculatePnlFromInput, validatePnlInput, buySellToPositionSide } from "./pnl-calculator";
import { hasPnlRealized } from "./pnl-store";
import type {
  PnlInput,
  PnlPendingDataReason,
  PnlProcessResult,
  RealizedPnlRecord,
} from "./pnl-types";

function orderPayload(evt: JournalEvent) {
  return evt.payload as {
    symbol?: string;
    side?: "BUY" | "SELL";
    qty?: string;
    quantity?: string;
    entryPrice?: number;
    avgPrice?: number | string;
    fee?: number;
    commission?: number;
    positionId?: string;
  };
}

function closeOrderPayload(evt: JournalEvent) {
  return evt.payload as {
    avgPrice?: number | string;
    executedQty?: string;
    qty?: string;
    fee?: number;
    commission?: number;
    orderId?: string;
  };
}

export function resolveTradeIdFromPosition(
  positionId: string,
  events: JournalEvent[],
): string | null {
  const opened = events.find(
    (e) => e.type === "POSITION_OPENED" && (e.positionId === positionId || e.tradeId === positionId),
  );
  if (opened?.tradeId) return opened.tradeId;
  const closed = events.find(
    (e) => e.type === "POSITION_CLOSED" && e.positionId === positionId,
  );
  return closed?.tradeId ?? null;
}

export function buildPnlInputFromEvents(tradeId: string, events: JournalEvent[]): PnlInput | null {
  const closedEvt = events.find((e) => e.type === "POSITION_CLOSED" && e.tradeId === tradeId);
  if (!closedEvt) return null;

  const orderEvt = events.find((e) => e.type === "ORDER_EXECUTED" && e.tradeId === tradeId);
  const openEvt = events.find((e) => e.type === "POSITION_OPENED" && e.tradeId === tradeId);
  const closeOrderEvt = events.find((e) => e.type === "CLOSE_ORDER_EXECUTED" && e.tradeId === tradeId);
  const order = orderEvt ? orderPayload(orderEvt) : {};
  const openPayload = openEvt?.payload as { entryPrice?: number; qty?: string; side?: "BUY" | "SELL"; positionId?: string } | undefined;
  const closePayload = closeOrderEvt ? closeOrderPayload(closeOrderEvt) : {};
  const closedPayload = closedEvt.payload as { symbol?: string; qty?: string; source?: string };

  const sideRaw = (order.side ?? openPayload?.side ?? "SELL") as "BUY" | "SELL";
  const entryPrice =
    openPayload?.entryPrice ??
    (order.entryPrice != null ? Number(order.entryPrice) : null) ??
    (order.avgPrice != null ? Number(order.avgPrice) : null);
  const exitPrice = closePayload.avgPrice != null ? Number(closePayload.avgPrice) : null;
  const qty = String(
    order.qty ??
      order.quantity ??
      openPayload?.qty ??
      closePayload.executedQty ??
      closePayload.qty ??
      closedPayload.qty ??
      "0",
  );

  return {
    tradeId,
    positionId: openEvt?.positionId ?? closedEvt.positionId ?? openPayload?.positionId ?? tradeId,
    symbol: String(order.symbol ?? closedPayload.symbol ?? ""),
    side: buySellToPositionSide(sideRaw),
    qty,
    entryPrice,
    exitPrice,
    entryFee: Number(order.fee ?? order.commission ?? 0),
    exitFee: Number(closePayload.fee ?? closePayload.commission ?? 0),
    openedAt: openEvt?.timestamp ?? orderEvt?.timestamp ?? null,
    closedAt: closedEvt.timestamp,
    environment: closedEvt.environment === "testnet" ? "TESTNET" : "PAPER",
  };
}

function recordFromExistingEvent(
  tradeId: string,
  existing: JournalEvent,
): RealizedPnlRecord {
  const p = existing.payload as Partial<RealizedPnlRecord & { side?: string }>;
  const rawSide = p.side;
  const side: RealizedPnlRecord["side"] =
    rawSide === "LONG" || rawSide === "SHORT"
      ? rawSide
      : buySellToPositionSide(rawSide === "BUY" || rawSide === "SELL" ? rawSide : "SELL");
  return {
    tradeId,
    positionId: existing.positionId ?? (p.positionId as string | null) ?? null,
    runId: existing.runId ?? null,
    decisionLogId: existing.decisionLogId ?? null,
    symbol: String(p.symbol ?? ""),
    side,
    qty: String(p.qty ?? "0"),
    entryPrice: Number(p.entryPrice ?? 0),
    exitPrice: Number(p.exitPrice ?? 0),
    grossPnl: Number(p.grossPnl ?? 0),
    entryFee: Number(p.entryFee ?? p.feeEstimate ?? 0) / (p.entryFee != null ? 1 : 2),
    exitFee: Number(p.exitFee ?? 0),
    feeEstimate: Number(p.feeEstimate ?? p.entryFee ?? 0),
    netPnl: Number(p.netPnl ?? 0),
    pnlPct: Number(p.pnlPct ?? 0),
    result: (p.result as RealizedPnlRecord["result"]) ?? "BREAKEVEN",
    calculatedAt: String(p.calculatedAt ?? existing.timestamp),
    status: "REALIZED",
    environment: (p.environment as RealizedPnlRecord["environment"]) ?? "TESTNET",
  };
}

async function appendPendingPnlEvent(
  input: PnlInput | null,
  tradeId: string,
  reasons: PnlPendingDataReason[],
  message: string,
  ctx: { runId?: string | null; decisionLogId?: string | null; positionId?: string | null },
): Promise<number> {
  await appendEvent({
    type: "PNL_PENDING_DATA",
    environment: "testnet",
    runId: ctx.runId ?? undefined,
    decisionLogId: ctx.decisionLogId ?? undefined,
    tradeId,
    positionId: ctx.positionId ?? input?.positionId ?? undefined,
    payload: {
      tradeId,
      positionId: input?.positionId ?? ctx.positionId ?? null,
      reasons,
      message,
      qty: input?.qty ?? null,
      entryPrice: input?.entryPrice ?? null,
      exitPrice: input?.exitPrice ?? null,
    },
  });
  return 1;
}

export async function processPnlCalculation(input: {
  tradeId?: string;
  positionId?: string;
}): Promise<PnlProcessResult> {
  if (isLiveEnabled()) {
    return {
      ok: false,
      status: "BLOCKED",
      tradeId: input.tradeId ?? null,
      positionId: input.positionId ?? null,
      pnl: null,
      reasons: ["LIVE_ENV_BLOCKED"],
      warnings: [],
      message: "Live trading enabled — PnL calculation blocked by policy.",
      eventsWritten: 0,
    };
  }

  const events = await getEvents();
  let tradeId = input.tradeId?.trim() ?? null;
  const positionId = input.positionId?.trim() ?? null;

  if (!tradeId && positionId) {
    tradeId = resolveTradeIdFromPosition(positionId, events);
  }

  if (!tradeId) {
    return {
      ok: false,
      status: "PENDING_DATA",
      tradeId: null,
      positionId: positionId ?? null,
      pnl: null,
      reasons: ["MISSING_TRADE_ID"],
      warnings: [],
      message: "tradeId or resolvable positionId is required.",
      eventsWritten: 0,
    };
  }

  if (await hasPnlRealized(tradeId)) {
    const existing = events.find((e) => e.type === "PNL_REALIZED" && e.tradeId === tradeId);
    return {
      ok: true,
      alreadyRealized: true,
      status: "REALIZED",
      tradeId,
      positionId: existing?.positionId ?? positionId,
      pnl: existing ? recordFromExistingEvent(tradeId, existing) : null,
      reasons: [],
      warnings: [],
      message: "PnL already realized.",
      eventsWritten: 0,
    };
  }

  const pnlInput = buildPnlInputFromEvents(tradeId, events);
  if (!pnlInput) {
    const eventsWritten = await appendPendingPnlEvent(
      null,
      tradeId,
      ["MISSING_CLOSE_EVENT"],
      "POSITION_CLOSED not found for trade.",
      { positionId },
    );
    return {
      ok: false,
      status: "PENDING_DATA",
      tradeId,
      positionId,
      pnl: null,
      reasons: ["MISSING_CLOSE_EVENT"],
      warnings: [],
      message: "POSITION_CLOSED not found for trade.",
      eventsWritten,
    };
  }

  const ctx = {
    runId: events.find((e) => e.type === "POSITION_CLOSED" && e.tradeId === tradeId)?.runId ?? null,
    decisionLogId:
      events.find((e) => e.type === "POSITION_CLOSED" && e.tradeId === tradeId)?.decisionLogId ?? null,
    positionId: pnlInput.positionId || positionId,
  };

  await appendEvent({
    type: "PNL_CALCULATION_STARTED",
    environment: "testnet",
    runId: ctx.runId ?? undefined,
    decisionLogId: ctx.decisionLogId ?? undefined,
    tradeId,
    positionId: ctx.positionId ?? undefined,
    payload: { tradeId, positionId: ctx.positionId, symbol: pnlInput.symbol },
  });

  const validation = validatePnlInput(pnlInput);
  if (!validation.valid) {
    const eventsWritten =
      1 +
      (await appendPendingPnlEvent(
        pnlInput,
        tradeId,
        validation.reasons,
        `PnL pending — ${validation.reasons.join(", ")}.`,
        ctx,
      ));
    return {
      ok: false,
      status: "PENDING_DATA",
      tradeId,
      positionId: ctx.positionId ?? null,
      pnl: null,
      reasons: validation.reasons,
      warnings: validation.warnings,
      message: `PnL pending — missing fill data (${validation.reasons.join(", ")}).`,
      eventsWritten,
    };
  }

  const calc = calculatePnlFromInput(pnlInput);
  if (!calc.ok || calc.netPnl == null || calc.result == null) {
    const eventsWritten =
      1 +
      (await appendPendingPnlEvent(
        pnlInput,
        tradeId,
        calc.reasons,
        calc.message,
        ctx,
      ));
    return {
      ok: false,
      status: "PENDING_DATA",
      tradeId,
      positionId: ctx.positionId ?? null,
      pnl: null,
      reasons: calc.reasons,
      warnings: calc.warnings,
      message: calc.message,
      eventsWritten,
    };
  }

  const calculatedAt = new Date().toISOString();
  const record: RealizedPnlRecord = {
    tradeId,
    positionId: ctx.positionId ?? null,
    runId: ctx.runId,
    decisionLogId: ctx.decisionLogId,
    symbol: pnlInput.symbol,
    side: pnlInput.side,
    qty: pnlInput.qty,
    entryPrice: pnlInput.entryPrice!,
    exitPrice: pnlInput.exitPrice!,
    grossPnl: calc.grossPnl!,
    entryFee: calc.entryFee,
    exitFee: calc.exitFee,
    feeEstimate: Number((calc.entryFee + calc.exitFee).toFixed(6)),
    netPnl: calc.netPnl,
    pnlPct: calc.pnlPct!,
    result: calc.result,
    calculatedAt,
    status: "REALIZED",
    environment: pnlInput.environment,
  };

  await appendEvent({
    type: "PNL_REALIZED",
    environment: "testnet",
    runId: ctx.runId ?? undefined,
    decisionLogId: ctx.decisionLogId ?? undefined,
    tradeId,
    positionId: ctx.positionId ?? undefined,
    payload: { ...record, side: record.side },
  });

  await appendEvent({
    type: "TRADE_RESULT_CLASSIFIED",
    environment: "testnet",
    runId: ctx.runId ?? undefined,
    decisionLogId: ctx.decisionLogId ?? undefined,
    tradeId,
    positionId: ctx.positionId ?? undefined,
    payload: {
      tradeId,
      result: record.result,
      netPnl: record.netPnl,
      classifiedAt: calculatedAt,
    },
  });

  const updatedEvents = await getEvents();
  const mission = buildMissionSnapshot(updatedEvents);
  await appendEvent({
    type: "MISSION_SNAPSHOT_UPDATED",
    environment: "testnet",
    runId: ctx.runId ?? undefined,
    decisionLogId: ctx.decisionLogId ?? undefined,
    tradeId,
    positionId: ctx.positionId ?? undefined,
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

  return {
    ok: true,
    status: "REALIZED",
    tradeId,
    positionId: ctx.positionId ?? null,
    pnl: record,
    reasons: [],
    warnings: calc.warnings,
    message: calc.message,
    eventsWritten: 4,
  };
}

async function afterPnlHooks(tradeId: string) {
  const { runPostTradeLoop } = await import("@/lib/loops/post-trade-loop");
  await runPostTradeLoop(tradeId);
}

export async function calculatePnlForTrade(tradeId: string): Promise<import("./pnl-types").CalculatePnlResult> {
  const result = await processPnlCalculation({ tradeId });
  return {
    ok: result.ok,
    record: result.pnl,
    status:
      result.status === "REALIZED"
        ? "REALIZED"
        : result.status === "BLOCKED"
          ? "BLOCKED"
          : "PNL_PENDING_DATA",
    message: result.message,
    alreadyRealized: result.alreadyRealized,
    reasons: result.reasons,
  };
}
