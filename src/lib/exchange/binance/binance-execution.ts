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
  computeCloseRealizedPnl,
  findOpenJournalEntryForSymbol,
} from "./binance-journal-reconcile";
import {
  buildBlockedExecuteResult,
  buildJournalEntryFromPreview,
  loadServerBinanceTestnetJournal,
  recordTestnetTradeJournal,
  upsertServerBinanceTestnetJournalEntry,
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
import { recordTestnetCloseMonitorEvents } from "@/lib/testnet-monitor/record-close-monitor-events";

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

  const hardSafety = (
    await import("@/lib/autopilot-loop-guard/hard-safety")
  ).checkOrderHardSafety({
    previewId: input.execute.previewId,
    symbol: "UNKNOWN",
    side: input.execute.doubleConfirm ? "BUY" : "SELL",
    doubleConfirm: input.execute.doubleConfirm,
    blindRetry: input.execute.blindRetry === true,
  });
  if (!hardSafety.allowed) {
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
        blockReasons: [hardSafety.reason],
        requiresDoubleConfirm: true,
        expiresAt: new Date(0).toISOString(),
        source: "manual_test",
        reason: "loop-guard-blocked",
        decisionLogId: null,
        generatedAt: new Date().toISOString(),
      },
      { status: "BLOCKED", blockReasons: [hardSafety.reason] },
    );
    await recordTestnetTradeJournal(stub);
    return {
      ok: false,
      blocked: true,
      exchangeOrderId: null,
      journalEntry: stub,
      error: hardSafety.reason,
    };
  }

  const preview =
    input.execute.embeddedPreview ??
    (await getStoredPreview(input.execute.previewId));

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
  const submittedPreviewIds = journal
    .filter((j) =>
      ["SUBMITTED", "FILLED", "CLOSING", "CLOSED"].includes(j.status),
    )
    .map((j) => j.previewId);
  const duplicateSubmission = submittedPreviewIds.includes(input.execute.previewId);

  const postPreviewSafety = (
    await import("@/lib/autopilot-loop-guard/hard-safety")
  ).checkOrderHardSafety({
    previewId: input.execute.previewId,
    symbol: preview.symbol,
    side: preview.side,
    doubleConfirm: input.execute.doubleConfirm,
    blindRetry: input.execute.blindRetry === true,
    submittedPreviewIds,
  });
  if (!postPreviewSafety.allowed) {
    const result = buildBlockedExecuteResult(preview, [postPreviewSafety.reason]);
    await recordTestnetTradeJournal(result.journalEntry);
    return result;
  }

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
    const openTrade = findOpenJournalEntryForSymbol(journal, input.close.symbol);
    const entryPrice = Number(pos.entryPrice);
    const exitPrice = markAtSubmit ?? Number(pos.markPrice);
    const estimatedPnl =
      entryPrice > 0 && exitPrice > 0
        ? computeCloseRealizedPnl({
            side: openTrade?.side ?? (Number(pos.positionAmt) > 0 ? "BUY" : "SELL"),
            quantity: String(amt),
            entryPrice,
            exitPrice,
          })
        : null;

    const journalEntry = openTrade
      ? await upsertServerBinanceTestnetJournalEntry(openTrade.binanceTestnetTradeId, {
          status: "CLOSING",
          exchangeOrderId: String(order.orderId),
          operatorNote: input.close.operatorNote ?? openTrade.operatorNote,
          closeAttempt: true,
          closeFailed: false,
          markPriceAtSubmit: exitPrice,
          fillPrice: openTrade.fillPrice ?? entryPrice,
          realizedPnl: estimatedPnl,
          latencyMs: Date.now() - closeStartedAt,
        })
      : null;

    void emitMissionAlert({
      kind: "trade_closed",
      title: "Testnet position closing",
      body: `${input.close.symbol} reduce-only close submitted · order ${order.orderId}`,
    }).catch(() => undefined);

    if (journalEntry) {
      await recordTestnetCloseMonitorEvents({
        symbol: input.close.symbol,
        exchangeOrderId: String(order.orderId),
        decisionLogId: journalEntry.decisionLogId ?? null,
        journalTradeId: journalEntry.binanceTestnetTradeId,
        realizedPnl: estimatedPnl,
      }).catch(() => undefined);
    }

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
    const openTrade = findOpenJournalEntryForSymbol(journal, input.close.symbol);
    if (openTrade) {
      await upsertServerBinanceTestnetJournalEntry(openTrade.binanceTestnetTradeId, {
        closeAttempt: true,
        closeFailed: true,
        blockReasons: [message],
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
