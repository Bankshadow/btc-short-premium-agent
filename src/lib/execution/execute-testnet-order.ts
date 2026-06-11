import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { buildMissionSnapshot } from "@/lib/mission/mission-snapshot";
import { runExecuteGuardChain } from "@/lib/core/guard-chain";
import { newTradeId } from "@/lib/trades/trade-types";
import { buildOpenTradesFromEvents } from "@/lib/trades/trade-store";
import type { BinanceTestnetClient } from "./binance-testnet-client";
import { createBinanceTestnetClient } from "./binance-testnet-client";
import {
  getBinanceTestnetStatus,
  isBinanceConnected,
} from "./binance-testnet-status";
import type { BinanceTestnetStatus } from "./binance-testnet-types";
import type { ExecutionBlocker, ExecutionSafetyResult } from "./execution-safety-types";
import { getActiveStrategyVersionId } from "@/lib/versioning/strategy-version-store";
import { getPreviewById } from "./preview-store";

export interface ExecuteTestnetInput {
  previewId: string;
  doubleConfirm: boolean;
  client?: BinanceTestnetClient;
  getBinanceStatus?: () => Promise<BinanceTestnetStatus>;
}

export interface ExecuteTestnetResult {
  ok: boolean;
  blocked: boolean;
  message: string;
  safety: ExecutionSafetyResult | null;
  binanceStatus: BinanceTestnetStatus | null;
  trade: ReturnType<typeof buildOpenTradesFromEvents>[number] | null;
  blockers: ExecutionBlocker[];
  orderId: string | null;
  tradeId: string | null;
}

function blocker(code: string, message: string, requiredAction: string): ExecutionBlocker {
  return { code, severity: "HARD_BLOCK", message, requiredAction };
}

async function appendExecuteBlocked(input: {
  runId?: string | null;
  decisionLogId?: string | null;
  previewId?: string | null;
  codes: string[];
  reasons: string[];
}): Promise<void> {
  await appendEvent({
    type: "EXECUTE_BLOCKED",
    environment: "testnet",
    runId: input.runId ?? undefined,
    decisionLogId: input.decisionLogId ?? undefined,
    previewId: input.previewId ?? undefined,
    payload: { codes: input.codes, reasons: input.reasons },
  });
}

export async function executeTestnetOrder(
  input: ExecuteTestnetInput,
): Promise<ExecuteTestnetResult> {
  const blockers: ExecutionBlocker[] = [];

  const preview = await getPreviewById(input.previewId);
  if (!preview) {
    blockers.push(
      blocker("PREVIEW_NOT_FOUND", "Preview not found.", "Create a new preview."),
    );
    await appendExecuteBlocked({
      previewId: input.previewId,
      codes: ["PREVIEW_NOT_FOUND"],
      reasons: ["Preview not found."],
    });
    return {
      ok: false,
      blocked: true,
      message: "Preview not found.",
      safety: null,
      binanceStatus: null,
      trade: null,
      blockers,
      orderId: null,
      tradeId: null,
    };
  }

  const guard = await runExecuteGuardChain({
    previewId: input.previewId,
    doubleConfirm: input.doubleConfirm,
    runId: preview.runId,
    decisionLogId: preview.decisionLogId,
  });

  if (!guard.allowed) {
    const guardBlockers = guard.blockers.map((g) =>
      blocker(g.code, g.message, g.requiredAction ?? "Resolve guard failure."),
    );
    await appendExecuteBlocked({
      runId: preview.runId,
      decisionLogId: preview.decisionLogId,
      previewId: preview.previewId,
      codes: guard.blockers.map((g) => g.code),
      reasons: guard.blockers.map((g) => g.message),
    });
    return {
      ok: false,
      blocked: true,
      message: guard.blockers[0]?.message ?? "Execution blocked by guard chain.",
      safety: null,
      binanceStatus: null,
      trade: null,
      blockers: guardBlockers,
      orderId: null,
      tradeId: null,
    };
  }

  const safety: ExecutionSafetyResult = {
    allowed: true,
    blocked: false,
    requiresDoubleConfirm: true,
    doubleConfirmProvided: input.doubleConfirm,
    blockers: [],
    warnings: [],
    previewId: preview.previewId,
    decisionLogId: preview.decisionLogId,
    runId: preview.runId,
    environment: "TESTNET",
    reviewedAt: new Date().toISOString(),
    executionEnabled: true,
    message: "Guard chain passed.",
  };

  const binanceStatus = input.getBinanceStatus
    ? await input.getBinanceStatus()
    : await getBinanceTestnetStatus();
  if (!isBinanceConnected(binanceStatus)) {
    const code =
      binanceStatus.status === "MISSING_ENV"
        ? "BINANCE_MISSING_ENV"
        : binanceStatus.status === "BLOCKED_BY_REGION"
          ? "BINANCE_BLOCKED_BY_REGION"
          : "BINANCE_NOT_CONNECTED";
    blockers.push(
      blocker(code, binanceStatus.reason, binanceStatus.recommendation),
    );
    await appendExecuteBlocked({
      runId: preview.runId,
      decisionLogId: preview.decisionLogId,
      previewId: preview.previewId,
      codes: [code],
      reasons: [binanceStatus.reason],
    });
    return {
      ok: false,
      blocked: true,
      message: binanceStatus.reason,
      safety,
      binanceStatus,
      trade: null,
      blockers,
      orderId: null,
      tradeId: null,
    };
  }

  const client = input.client ?? createBinanceTestnetClient();
  const tradeId = newTradeId();
  const clientOrderId = `v2-${preview.previewId}`.slice(0, 36);

  try {
    const order = await client.createMarketOrder({
      symbol: preview.symbol,
      side: preview.side,
      quantity: preview.estimatedQty,
      clientOrderId,
    });

    const entryPrice =
      order.avgPrice && Number(order.avgPrice) > 0 ? Number(order.avgPrice) : null;

    const orderSummary = {
      symbol: order.symbol,
      side: order.side,
      qty: order.executedQty || order.origQty,
      orderId: String(order.orderId),
      clientOrderId: order.clientOrderId,
      status: order.status,
      avgPrice: order.avgPrice,
      updateTime: order.updateTime,
    };

    const strategyVersionId = await getActiveStrategyVersionId();

    await appendEvent({
      type: "ORDER_EXECUTED",
      environment: "testnet",
      runId: preview.runId,
      decisionLogId: preview.decisionLogId,
      previewId: preview.previewId,
      tradeId,
      payload: {
        ...orderSummary,
        notionalUsd: preview.notionalUsd,
        previewId: preview.previewId,
        source: "BINANCE_TESTNET",
        strategyVersionId,
      },
    });

    const accepted = ["NEW", "PARTIALLY_FILLED", "FILLED"].includes(order.status);
    if (accepted) {
      await appendEvent({
        type: "POSITION_OPENED",
        environment: "testnet",
        runId: preview.runId,
        decisionLogId: preview.decisionLogId,
        previewId: preview.previewId,
        tradeId,
        payload: {
          symbol: preview.symbol,
          side: preview.side,
          qty: orderSummary.qty,
          orderId: orderSummary.orderId,
          entryPrice,
          source: "BINANCE_TESTNET",
        },
      });

      const { refreshOpenPositions } = await import("@/lib/positions/position-monitor");
      await refreshOpenPositions({
        client: input.client,
        getBinanceStatus: input.getBinanceStatus ?? getBinanceTestnetStatus,
      });
    }

    const events = await getEvents();
    const snapshot = buildMissionSnapshot(events);
    await appendEvent({
      type: "MISSION_SNAPSHOT_UPDATED",
      environment: "testnet",
      runId: preview.runId,
      decisionLogId: preview.decisionLogId,
      previewId: preview.previewId,
      tradeId,
      payload: {
        currentEquity: snapshot.currentEquity,
        netPnl: snapshot.netPnl,
        openPositions: snapshot.openPositions,
        totalTrades: snapshot.totalTrades,
      },
    });

    const openTrades = buildOpenTradesFromEvents(events);
    const trade = openTrades.find((t) => t.tradeId === tradeId) ?? null;

    return {
      ok: true,
      blocked: false,
      message: "Testnet order executed.",
      safety,
      binanceStatus,
      trade,
      blockers: [],
      orderId: orderSummary.orderId,
      tradeId,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Binance order failed";
    await appendEvent({
      type: "ERROR_RECORDED",
      environment: "testnet",
      runId: preview.runId,
      decisionLogId: preview.decisionLogId,
      previewId: preview.previewId,
      payload: {
        phase: "EXECUTE_TESTNET",
        message,
        symbol: preview.symbol,
      },
    });
    await appendExecuteBlocked({
      runId: preview.runId,
      decisionLogId: preview.decisionLogId,
      previewId: preview.previewId,
      codes: ["BINANCE_ORDER_FAILED"],
      reasons: [message],
    });
    blockers.push(
      blocker("BINANCE_ORDER_FAILED", message, "Check Binance testnet account and retry."),
    );
    return {
      ok: false,
      blocked: true,
      message,
      safety,
      binanceStatus,
      trade: null,
      blockers,
      orderId: null,
      tradeId: null,
    };
  }
}

export function redactBinanceStatusForClient(
  status: BinanceTestnetStatus,
): BinanceTestnetStatus {
  return status;
}
