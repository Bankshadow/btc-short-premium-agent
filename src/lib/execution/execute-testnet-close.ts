import type { BinanceTestnetClient } from "@/lib/execution/binance-testnet-client";
import { createBinanceTestnetClient } from "@/lib/execution/binance-testnet-client";
import {
  getBinanceTestnetStatus,
  isBinanceConnected,
} from "@/lib/execution/binance-testnet-status";
import type { BinanceTestnetStatus } from "@/lib/execution/binance-testnet-types";
import type { CloseBlocker } from "@/lib/execution/close-safety-gate";
import { getClosePreviewById } from "@/lib/execution/close-preview-store";
import { resolveClosePreviewStatus } from "@/lib/execution/close-preview-types";
import { appendCoreEventStrict } from "@/lib/core/event-store";
import { getEvents } from "@/lib/journal/journal-query";
import { buildMissionSnapshot } from "@/lib/mission/mission-snapshot";
import {
  refreshOpenPositions,
} from "@/lib/positions/position-monitor";
import { filterNonZeroBinancePositions } from "@/lib/positions/position-reconcile";
import { runCloseGuardChain } from "@/lib/core/guard-chain";
import { calculatePnlForTrade } from "@/lib/pnl/calculate-pnl";
import type { OpenTrade } from "@/lib/trades/trade-types";

export interface ExecuteTestnetCloseInput {
  closePreviewId: string;
  doubleConfirm: boolean;
  client?: BinanceTestnetClient;
  getBinanceStatus?: () => Promise<BinanceTestnetStatus>;
}

export interface ExecuteTestnetCloseResult {
  ok: boolean;
  blocked: boolean;
  message: string;
  blockers: CloseBlocker[];
  orderId: string | null;
  tradeId: string | null;
  closePreviewId: string | null;
  positionClosed: boolean;
}

function blocker(code: string, message: string, requiredAction: string): CloseBlocker {
  return { code, message, requiredAction };
}

export async function executeTestnetClose(
  input: ExecuteTestnetCloseInput,
): Promise<ExecuteTestnetCloseResult> {
  const blockers: CloseBlocker[] = [];

  if (!input.closePreviewId) {
    blockers.push(blocker("MISSING_CLOSE_PREVIEW_ID", "closePreviewId is required.", "Create close preview."));
    await appendCloseBlocked(null, blockers);
    return fail(blockers, "closePreviewId is required.");
  }

  const preview = await getClosePreviewById(input.closePreviewId);
  if (!preview) {
    blockers.push(blocker("CLOSE_PREVIEW_NOT_FOUND", "Close preview not found.", "Create close preview."));
    await appendCloseBlocked(input.closePreviewId, blockers);
    return fail(blockers, "Close preview not found.");
  }

  const previewStatus = resolveClosePreviewStatus(preview);
  if (previewStatus !== "ACTIVE") {
    blockers.push(
      blocker(
        "CLOSE_PREVIEW_NOT_ACTIVE",
        `Close preview is ${previewStatus}.`,
        "Create a new active close preview.",
      ),
    );
    await appendCloseBlocked(preview.closePreviewId, blockers, preview);
    return fail(blockers, `Close preview is ${previewStatus}.`, preview);
  }

  if (preview.environment !== "TESTNET") {
    blockers.push(blocker("LIVE_ENVIRONMENT_BLOCKED", "Live trading is locked.", "Use testnet only."));
    await appendCloseBlocked(preview.closePreviewId, blockers, preview);
    return fail(blockers, "Live trading is locked.", preview);
  }

  const guard = await runCloseGuardChain({
    closePreviewId: input.closePreviewId,
    doubleConfirm: input.doubleConfirm,
    reduceOnly: preview.reduceOnly,
    runId: preview.runId,
    decisionLogId: preview.decisionLogId,
  });

  if (!guard.allowed) {
    const guardBlockers = guard.blockers.map((g) =>
      blocker(g.code, g.message, g.requiredAction ?? "Resolve guard failure."),
    );
    await appendCloseBlocked(preview.closePreviewId, guardBlockers, preview);
    return fail(guardBlockers, guard.blockers[0]?.message ?? "Close blocked by guard chain.", preview);
  }

  const binanceStatus = input.getBinanceStatus
    ? await input.getBinanceStatus()
    : await getBinanceTestnetStatus();
  if (!isBinanceConnected(binanceStatus)) {
    blockers.push(
      blocker("BINANCE_NOT_CONNECTED", binanceStatus.reason, binanceStatus.recommendation),
    );
    await appendCloseBlocked(preview.closePreviewId, blockers, preview);
    return fail(blockers, binanceStatus.reason, preview);
  }

  const client = input.client ?? createBinanceTestnetClient();
  const clientOrderId = `v2-close-${preview.closePreviewId}`.slice(0, 36);

  try {
    const order = await client.createMarketOrder({
      symbol: preview.symbol,
      side: preview.sideToClose,
      quantity: preview.qty,
      clientOrderId,
      reduceOnly: true,
    });

    const orderSummary = {
      symbol: order.symbol,
      side: order.side,
      qty: order.executedQty || order.origQty,
      orderId: String(order.orderId),
      clientOrderId: order.clientOrderId,
      status: order.status,
      avgPrice: order.avgPrice,
      reduceOnly: true,
      updateTime: order.updateTime,
    };

    await appendCoreEventStrict({
      type: "CLOSE_ORDER_EXECUTED",
      environment: "testnet",
      runId: preview.runId,
      decisionLogId: preview.decisionLogId,
      tradeId: preview.tradeId,
      positionId: preview.positionId,
      closePreviewId: preview.closePreviewId,
      payload: { ...orderSummary, source: "BINANCE_TESTNET" },
    });

    await refreshOpenPositions({ client, getBinanceStatus: input.getBinanceStatus });

    let positionClosed = false;
    let remainingQty = preview.qty;

    try {
      const positions = filterNonZeroBinancePositions(await client.getPositions());
      const pos = positions.find(
        (p) => p.symbol.toUpperCase() === preview.symbol.toUpperCase(),
      );
      if (!pos || Math.abs(Number.parseFloat(pos.positionAmt)) < 1e-8) {
        positionClosed = true;
        remainingQty = "0";
      } else {
        remainingQty = String(Math.abs(Number.parseFloat(pos.positionAmt)));
        if (Number.parseFloat(remainingQty) < Number.parseFloat(preview.qty) * 0.01) {
          positionClosed = true;
        }
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to verify position after close order.";
      await appendCoreEventStrict({
        type: "ERROR_RECORDED",
        environment: "testnet",
        runId: preview.runId,
        decisionLogId: preview.decisionLogId,
        tradeId: preview.tradeId,
        positionId: preview.positionId,
        closePreviewId: preview.closePreviewId,
        payload: { phase: "POSITION_VERIFY_AFTER_CLOSE", message, symbol: preview.symbol },
      });
      await appendCoreEventStrict({
        type: "STATE_RECONCILIATION_WARNING",
        environment: "testnet",
        runId: preview.runId,
        decisionLogId: preview.decisionLogId,
        tradeId: preview.tradeId,
        positionId: preview.positionId,
        closePreviewId: preview.closePreviewId,
        payload: {
          code: "POSITION_VERIFY_FAILED",
          message: "Close order sent but flat state could not be verified — POSITION_CLOSED not written.",
        },
      });
      positionClosed = false;
    }

    if (positionClosed) {
      await appendCoreEventStrict({
        type: "POSITION_CLOSED",
        environment: "testnet",
        runId: preview.runId,
        decisionLogId: preview.decisionLogId,
        tradeId: preview.tradeId,
        positionId: preview.positionId,
        closePreviewId: preview.closePreviewId,
        payload: {
          symbol: preview.symbol,
          sideToClose: preview.sideToClose,
          qty: preview.qty,
          closeOrderId: orderSummary.orderId,
          source: "BINANCE_TESTNET",
          realizedPnlPending: true,
        },
      });

      await calculatePnlForTrade(preview.tradeId);
    }

    const events = await getEvents();
    const mission = buildMissionSnapshot(events);
    await appendCoreEventStrict({
      type: "MISSION_SNAPSHOT_UPDATED",
      environment: "testnet",
      runId: preview.runId,
      decisionLogId: preview.decisionLogId,
      tradeId: preview.tradeId,
      positionId: preview.positionId,
      closePreviewId: preview.closePreviewId,
      payload: {
        currentEquity: mission.currentEquity,
        netPnl: mission.netPnl,
        openPositions: mission.openPositions,
        totalTrades: mission.totalTrades,
        phase: "CLOSE_EXECUTED",
        positionClosed,
      },
    });

    return {
      ok: true,
      blocked: false,
      message: positionClosed
        ? "Reduce-only close executed — position closed."
        : "Reduce-only close executed — partial fill or position remains.",
      blockers: [],
      orderId: orderSummary.orderId,
      tradeId: preview.tradeId,
      closePreviewId: preview.closePreviewId,
      positionClosed,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Binance close order failed";
    await appendCoreEventStrict({
      type: "ERROR_RECORDED",
      environment: "testnet",
      runId: preview.runId,
      decisionLogId: preview.decisionLogId,
      tradeId: preview.tradeId,
      positionId: preview.positionId,
      closePreviewId: preview.closePreviewId,
      payload: { phase: "CLOSE_TESTNET", message, symbol: preview.symbol },
    });
    blockers.push(
      blocker("BINANCE_CLOSE_FAILED", message, "Check Binance testnet account and retry."),
    );
    await appendCloseBlocked(preview.closePreviewId, blockers, preview);
    return fail(blockers, message, preview);
  }
}

function fail(
  blockers: CloseBlocker[],
  message: string,
  preview?: { tradeId: string; closePreviewId: string } | null,
): ExecuteTestnetCloseResult {
  return {
    ok: false,
    blocked: true,
    message,
    blockers,
    orderId: null,
    tradeId: preview?.tradeId ?? null,
    closePreviewId: preview?.closePreviewId ?? null,
    positionClosed: false,
  };
}

async function appendCloseBlocked(
  closePreviewId: string | null,
  blockers: CloseBlocker[],
  preview?: OpenTrade | { runId?: string; decisionLogId?: string; tradeId?: string; positionId?: string } | null,
): Promise<void> {
  await appendCoreEventStrict({
    type: "CLOSE_BLOCKED",
    environment: "testnet",
    runId: preview && "runId" in preview ? preview.runId : undefined,
    decisionLogId: preview && "decisionLogId" in preview ? preview.decisionLogId : undefined,
    tradeId: preview && "tradeId" in preview ? preview.tradeId : undefined,
    positionId: preview && "positionId" in preview ? preview.positionId : undefined,
    closePreviewId: closePreviewId ?? undefined,
    payload: {
      codes: blockers.map((b) => b.code),
      reasons: blockers.map((b) => b.message),
    },
  });
}
