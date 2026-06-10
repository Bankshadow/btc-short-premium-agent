import { resolveTestnetConnectionStatus } from "@/lib/execution/testnet-status";
import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { newClosePreviewId } from "@/lib/journal/journal-types";
import { isLiveEnabled } from "@/lib/risk/risk-gate";
import {
  getLatestMonitoredSnapshots,
  getReconciliationStatus,
  getSnapshotForTrade,
} from "@/lib/positions/position-monitor";
import { isReconciliationBlocking } from "@/lib/positions/position-reconcile";
import { closeSideForPosition } from "@/lib/positions/position-types";
import { buildOpenTradesFromEvents } from "@/lib/trades/trade-store";
import { isOperatorBlocked, hydrateOperatorGateState } from "@/lib/operator/operator-actions";
import {
  CLOSE_PREVIEW_TTL_MS,
  type ClosePreview,
  type CreateClosePreviewResult,
  withClosePreviewStatus,
} from "./close-preview-types";

export async function createClosePreview(input: {
  tradeId: string;
}): Promise<CreateClosePreviewResult> {
  await hydrateOperatorGateState();
  const blockReasons: string[] = [];
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + CLOSE_PREVIEW_TTL_MS).toISOString();

  if (!input.tradeId) {
    blockReasons.push("MISSING_TRADE_ID");
    await appendBlocked(null, blockReasons);
    return blockedResult(blockReasons, "tradeId is required.");
  }

  if (isLiveEnabled()) {
    blockReasons.push("LIVE_ENVIRONMENT_BLOCKED");
    await appendBlocked(null, blockReasons);
    return blockedResult(blockReasons, "Live trading is locked.");
  }

  const events = await getEvents();
  const openTrades = buildOpenTradesFromEvents(events);
  const trade = openTrades.find((t) => t.tradeId === input.tradeId);

  if (!trade) {
    blockReasons.push("OPEN_TRADE_REQUIRED");
    await appendBlocked(input.tradeId, blockReasons);
    return blockedResult(blockReasons, "OPEN trade is required for close preview.");
  }

  if (!trade.decisionLogId) {
    blockReasons.push("MISSING_DECISION_LOG_ID");
  }

  const operatorBlock = await isOperatorBlocked();
  if (operatorBlock.blocked) {
    blockReasons.push(operatorBlock.reason ?? "OPERATOR_BLOCKED");
  }

  const testnet = await resolveTestnetConnectionStatus();
  if (!testnet.connected) {
    blockReasons.push("BINANCE_NOT_CONNECTED");
  }

  const snapshot =
    getSnapshotForTrade(trade.tradeId, events) ??
    getLatestMonitoredSnapshots(events).get(trade.tradeId) ??
    null;

  if (!snapshot || snapshot.status !== "OPEN") {
    blockReasons.push("ACTIVE_POSITION_REQUIRED");
  }

  if (snapshot?.status === "UNKNOWN") {
    blockReasons.push("POSITION_STATE_UNKNOWN");
  }

  const reconciliation = await getReconciliationStatus();

  if (isReconciliationBlocking(reconciliation)) {
    blockReasons.push("RECONCILIATION_BLOCKED");
  }

  const sideToClose = snapshot
    ? closeSideForPosition(snapshot.side)
    : closeSideForPosition(trade.side === "BUY" ? "LONG" : "SHORT");
  const qty = snapshot?.qty ?? trade.qty;
  const closePreviewId = newClosePreviewId();
  const positionId = snapshot?.positionId ?? `pos-${trade.tradeId}`;
  const blocked = blockReasons.length > 0;

  const preview: ClosePreview = withClosePreviewStatus({
    closePreviewId,
    tradeId: trade.tradeId,
    positionId,
    runId: trade.runId,
    decisionLogId: trade.decisionLogId,
    symbol: trade.symbol,
    sideToClose,
    qty,
    orderType: "MARKET",
    reduceOnly: true,
    environment: "TESTNET",
    expiresAt,
    createdAt,
    blocked,
    blockReasons,
    requiresDoubleConfirm: true,
    status: blocked ? "BLOCKED" : "ACTIVE",
  });

  if (blocked) {
    await appendEvent({
      type: "CLOSE_PREVIEW_BLOCKED",
      environment: "testnet",
      runId: trade.runId,
      decisionLogId: trade.decisionLogId,
      previewId: trade.previewId,
      tradeId: trade.tradeId,
      positionId,
      closePreviewId,
      payload: {
        blockReasons,
        tradeId: trade.tradeId,
        symbol: trade.symbol,
      },
    });
    return {
      ok: false,
      preview,
      blockReasons,
      eventType: "CLOSE_PREVIEW_BLOCKED",
      message: "Close preview blocked — resolve issues first.",
    };
  }

  await appendEvent({
    type: "CLOSE_PREVIEW_CREATED",
    environment: "testnet",
    runId: trade.runId,
    decisionLogId: trade.decisionLogId,
    previewId: trade.previewId,
    tradeId: trade.tradeId,
    positionId,
    closePreviewId,
    payload: { ...preview },
  });

  return {
    ok: true,
    preview,
    blockReasons: [],
    eventType: "CLOSE_PREVIEW_CREATED",
    message: "Close preview created — run close safety review (MVP 5B).",
  };
}

function blockedResult(
  blockReasons: string[],
  message: string,
): CreateClosePreviewResult {
  return {
    ok: false,
    preview: null,
    blockReasons,
    eventType: "CLOSE_PREVIEW_BLOCKED",
    message,
  };
}

async function appendBlocked(
  tradeId: string | null,
  blockReasons: string[],
): Promise<void> {
  await appendEvent({
    type: "CLOSE_PREVIEW_BLOCKED",
    environment: "testnet",
    tradeId: tradeId ?? undefined,
    payload: { blockReasons, tradeId },
  });
}
