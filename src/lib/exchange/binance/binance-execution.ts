import {
  closeTestnetPositionReduceOnly,
  getPositions,
  placeTestnetMarketOrder,
} from "./binance-futures-testnet";
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

export async function executeBinanceTestnetOrder(input: {
  execute: BinanceExecuteInput;
  commandCenterStatus?: CommandCenterStatus | string | null;
  governance?: GovernanceDeskState | null;
  entries?: DecisionLogEntry[];
  orders?: PaperOrder[];
  operatorNote?: string;
}): Promise<BinanceExecuteResult> {
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
    const order = await placeTestnetMarketOrder({
      symbol: preview.symbol,
      side: preview.side,
      quantity: preview.estimatedQty,
    });

    const journalEntry = buildJournalEntryFromPreview(preview, {
      status: "SUBMITTED",
      exchangeOrderId: String(order.orderId),
      clientOrderId: order.clientOrderId,
      operatorNote: input.operatorNote ?? input.execute.operatorNote ?? null,
      blockReasons: [],
      executedAt: new Date().toISOString(),
    });
    await recordTestnetTradeJournal(journalEntry);

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
        }
      : null;

    if (journalEntry) {
      await recordTestnetTradeJournal({
        ...journalEntry,
        createdAt: new Date().toISOString(),
        binanceTestnetTradeId: `${openTrade!.binanceTestnetTradeId}-close`,
      });
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
    return {
      ok: false,
      blocked: false,
      exchangeOrderId: null,
      journalEntry: null,
      error: message,
    };
  }
}
