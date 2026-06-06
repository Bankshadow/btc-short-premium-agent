import {
  getMarkPrice,
  closeTestnetPositionReduceOnly,
  getPositions,
  placeTestnetMarketOrder,
} from "./binance-futures-testnet";
import { evaluateRiskyActionGate } from "@/lib/anomaly-detection/safety";
import { getStoredPreview } from "./binance-order-preview";
import { closeSideForPosition } from "./binance-position-monitor";
import { validateOrderAgainstRiskGate } from "./binance-risk-gate";
import {
  buildBlockedExecuteResult,
  buildJournalEntryFromPreview,
  loadServerBinanceTestnetJournal,
  recordTestnetTradeJournal,
} from "./binance-testnet-journal-server";
import type {
  BinanceCloseInput,
  BinanceCloseResult,
  BinanceExecuteInput,
  BinanceExecuteResult,
} from "./binance-types";
import type { CommandCenterStatus } from "@/lib/command-center/types";
import type { GovernanceDeskState } from "@/lib/governance/governance-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import { emitMissionAlert } from "@/lib/mission-notifications/emit-mission-alert";

export async function executeBinanceTestnetOrder(input: {
  execute: BinanceExecuteInput;
  commandCenterStatus?: CommandCenterStatus | string | null;
  governance?: GovernanceDeskState | null;
  entries?: DecisionLogEntry[];
  orders?: PaperOrder[];
  operatorNote?: string;
}): Promise<BinanceExecuteResult> {
  const anomalyGate = await evaluateRiskyActionGate("binance testnet execute");
  if (!anomalyGate.allowed) {
    const preview = await getStoredPreview(input.execute.previewId);
    const blockedEntry = preview
      ? buildJournalEntryFromPreview(preview, {
          status: "BLOCKED",
          blockReasons: [anomalyGate.reason ?? "Blocked by CRITICAL incident."],
        })
      : buildJournalEntryFromPreview(
          {
            previewId: input.execute.previewId,
            symbol: "UNKNOWN",
            side: "BUY",
            estimatedQty: "0",
            notionalUsd: 0,
            markPrice: null,
            riskChecks: [],
            blocked: true,
            blockReasons: ["Preview not found or blocked by incident"],
            requiresDoubleConfirm: true,
            expiresAt: new Date(0).toISOString(),
            source: "manual_test",
            reason: "incident-blocked",
            decisionLogId: null,
            generatedAt: new Date().toISOString(),
          },
          {
            status: "BLOCKED",
            blockReasons: [anomalyGate.reason ?? "Blocked by CRITICAL incident."],
          },
        );
    await recordTestnetTradeJournal(blockedEntry);
    return {
      ok: false,
      blocked: true,
      exchangeOrderId: null,
      journalEntry: blockedEntry,
      error: anomalyGate.reason ?? "Blocked by CRITICAL incident.",
    };
  }

  const preview = await getStoredPreview(input.execute.previewId);

  if (!preview) {
    const stub = buildJournalEntryFromPreview(
      {
        previewId: input.execute.previewId,
        symbol: "UNKNOWN",
        side: "BUY",
        estimatedQty: "0",
        notionalUsd: 0,
        markPrice: null,
        riskChecks: [],
        blocked: true,
        blockReasons: ["Preview not found or expired"],
        requiresDoubleConfirm: true,
        expiresAt: new Date(0).toISOString(),
        source: "manual_test",
        reason: "expired",
        decisionLogId: null,
        generatedAt: new Date().toISOString(),
      },
      { status: "BLOCKED", blockReasons: ["Preview not found or expired"] },
    );
    await recordTestnetTradeJournal(stub);
    return {
      ok: false,
      blocked: true,
      exchangeOrderId: null,
      journalEntry: stub,
      error: "Preview not found or expired",
    };
  }

  const positions = await getPositions().catch(() => []);
  const journal = await loadServerBinanceTestnetJournal();
  const duplicateSubmission = journal.some(
    (j) =>
      j.previewId === input.execute.previewId &&
      ["SUBMITTED", "FILLED", "CLOSING", "CLOSED"].includes(j.status),
  );

  const gate = validateOrderAgainstRiskGate({
    preview,
    positions,
    journal,
    commandCenterStatus: input.commandCenterStatus,
    governance: input.governance,
    entries: input.entries,
    orders: input.orders,
    doubleConfirm: input.execute.doubleConfirm,
  });

  if (gate.blocked) {
    const result = buildBlockedExecuteResult(preview, gate.blockReasons);
    await recordTestnetTradeJournal(result.journalEntry);
    return result;
  }

  try {
    const submitStartedAt = Date.now();
    const markAtSubmit = await getMarkPrice(preview.symbol).catch(() => null);
    const order = await placeTestnetMarketOrder({
      symbol: preview.symbol,
      side: preview.side,
      quantity: preview.estimatedQty,
    });

    const fillPrice = markAtSubmit ?? preview.markPrice ?? null;
    const previewPrice = preview.markPrice ?? null;
    const slippage =
      previewPrice != null && fillPrice != null
        ? Number((fillPrice - previewPrice).toFixed(6))
        : null;
    const slippageBps =
      previewPrice != null && fillPrice != null
        ? Number((((fillPrice - previewPrice) / previewPrice) * 10_000).toFixed(3))
        : null;

    const journalEntry = buildJournalEntryFromPreview(preview, {
      status: "SUBMITTED",
      exchangeOrderId: String(order.orderId),
      clientOrderId: order.clientOrderId,
      operatorNote: input.operatorNote ?? input.execute.operatorNote ?? null,
      blockReasons: [],
      executedAt: new Date().toISOString(),
      previewPrice: previewPrice,
      markPriceAtSubmit: markAtSubmit,
      fillPrice,
      slippage,
      slippageBps,
      latencyMs: Date.now() - submitStartedAt,
      partialFill: false,
      duplicateSubmission,
      retryCount: 0,
    });
    await recordTestnetTradeJournal(journalEntry);

    void emitMissionAlert({
      kind: "trade_opened",
      title: "Testnet position opened",
      body: `${preview.symbol} ${preview.side} · qty ~${preview.estimatedQty} · order ${order.orderId}`,
    }).catch(() => undefined);

    return {
      ok: true,
      blocked: false,
      exchangeOrderId: String(order.orderId),
      journalEntry,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Execute failed";
    const journalEntry = buildJournalEntryFromPreview(preview, {
      status: "FAILED",
      blockReasons: [message],
      operatorNote: input.operatorNote ?? null,
      duplicateSubmission,
      retryCount: 0,
    });
    await recordTestnetTradeJournal(journalEntry);
    return {
      ok: false,
      blocked: false,
      exchangeOrderId: null,
      journalEntry,
      error: message,
    };
  }
}

export async function executeBinanceTestnetClose(input: {
  close: BinanceCloseInput;
  commandCenterStatus?: CommandCenterStatus | string | null;
  governance?: GovernanceDeskState | null;
  entries?: DecisionLogEntry[];
  orders?: PaperOrder[];
}): Promise<BinanceCloseResult> {
  const anomalyGate = await evaluateRiskyActionGate("binance testnet close");
  if (!anomalyGate.allowed) {
    return {
      ok: false,
      blocked: true,
      exchangeOrderId: null,
      journalEntry: null,
      error: anomalyGate.reason ?? "Blocked by CRITICAL incident.",
    };
  }

  const positions = await getPositions();
  const pos = positions.find((p) => p.symbol === input.close.symbol);
  if (!pos || Math.abs(Number(pos.positionAmt)) === 0) {
    return {
      ok: false,
      blocked: true,
      exchangeOrderId: null,
      journalEntry: null,
      error: `No open position for ${input.close.symbol}`,
    };
  }

  const amt = Math.abs(Number(pos.positionAmt));
  const side = closeSideForPosition(Number(pos.positionAmt));

  const gate = validateOrderAgainstRiskGate({
    commandCenterStatus: input.commandCenterStatus,
    governance: input.governance,
    entries: input.entries,
    orders: input.orders,
    doubleConfirm: input.close.doubleConfirm,
  });

  if (gate.blocked) {
    return {
      ok: false,
      blocked: true,
      exchangeOrderId: null,
      journalEntry: null,
      error: gate.blockReasons[0] ?? "Close blocked",
    };
  }

  try {
    const closeStartedAt = Date.now();
    const markAtSubmit = await getMarkPrice(input.close.symbol).catch(() => null);
    const order = await closeTestnetPositionReduceOnly({
      symbol: input.close.symbol,
      side,
      quantity: String(amt),
    });

    const journal = await loadServerBinanceTestnetJournal();
    const openTrade = journal.find(
      (j) =>
        j.symbol === input.close.symbol &&
        ["SUBMITTED", "FILLED"].includes(j.status),
    );

    const journalEntry = openTrade
      ? {
          ...openTrade,
          status: "CLOSING" as const,
          exchangeOrderId: String(order.orderId),
          operatorNote: input.close.operatorNote ?? null,
          closeAttempt: true,
          closeFailed: false,
          markPriceAtSubmit: markAtSubmit,
          latencyMs: Date.now() - closeStartedAt,
        }
      : null;

    if (journalEntry) {
      await recordTestnetTradeJournal({
        ...journalEntry,
        createdAt: new Date().toISOString(),
        binanceTestnetTradeId: `${openTrade!.binanceTestnetTradeId}-close`,
      });
    }

    void emitMissionAlert({
      kind: "trade_closed",
      title: "Testnet position closing",
      body: `${input.close.symbol} reduce-only close submitted · order ${order.orderId}`,
    }).catch(() => undefined);

    return {
      ok: true,
      blocked: false,
      exchangeOrderId: String(order.orderId),
      journalEntry,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Close failed";
    const journal = await loadServerBinanceTestnetJournal().catch(() => []);
    const openTrade = journal.find(
      (j) =>
        j.symbol === input.close.symbol &&
        ["SUBMITTED", "FILLED"].includes(j.status),
    );
    if (openTrade) {
      await recordTestnetTradeJournal({
        ...openTrade,
        binanceTestnetTradeId: `${openTrade.binanceTestnetTradeId}-close-failed-${Date.now()}`,
        status: "FAILED",
        closeAttempt: true,
        closeFailed: true,
        blockReasons: [message],
        createdAt: new Date().toISOString(),
      });
    }

    return {
      ok: false,
      blocked: false,
      exchangeOrderId: null,
      journalEntry: null,
      error: message,
    };
  }
}
