import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { resolveTestnetConnectionStatus } from "./testnet-status";
import { isLiveEnabled, RISK_POLICY } from "@/lib/risk/risk-gate";
import {
  getReconciliationStatus,
  getSnapshotForTrade,
} from "@/lib/positions/position-monitor";
import { isReconciliationBlocking } from "@/lib/positions/position-reconcile";
import { buildOpenTradesFromEvents } from "@/lib/trades/trade-store";
import { isOperatorBlocked, hydrateOperatorGateState } from "@/lib/operator/operator-actions";
import { checkClosePreviewExpiry } from "./close-preview-types";
import { getClosePreviewById } from "./close-preview-store";

export interface CloseBlocker {
  code: string;
  message: string;
  requiredAction: string;
}

export interface CloseWarning {
  code: string;
  message: string;
}

export interface CloseSafetyResult {
  allowed: boolean;
  blocked: boolean;
  requiresDoubleConfirm: boolean;
  doubleConfirmProvided?: boolean;
  blockers: CloseBlocker[];
  warnings: CloseWarning[];
  closePreviewId: string | null;
  tradeId: string | null;
  positionId: string | null;
  decisionLogId: string | null;
  runId: string | null;
  environment: "TESTNET";
  reviewedAt: string;
  message: string;
}

function blocker(code: string, message: string, requiredAction: string): CloseBlocker {
  return { code, message, requiredAction };
}

async function appendCloseEvent(input: {
  type: "CLOSE_REVIEWED" | "CLOSE_BLOCKED" | "DOUBLE_CONFIRM_REQUIRED";
  runId?: string | null;
  decisionLogId?: string | null;
  previewId?: string | null;
  tradeId?: string | null;
  positionId?: string | null;
  closePreviewId?: string | null;
  payload: Record<string, unknown>;
}): Promise<void> {
  await appendEvent({
    type: input.type,
    environment: "testnet",
    runId: input.runId ?? undefined,
    decisionLogId: input.decisionLogId ?? undefined,
    previewId: input.previewId ?? undefined,
    tradeId: input.tradeId ?? undefined,
    positionId: input.positionId ?? undefined,
    closePreviewId: input.closePreviewId ?? undefined,
    payload: input.payload,
  });
}

export async function reviewCloseSafety(input: {
  closePreviewId: string;
  doubleConfirm: boolean;
}): Promise<CloseSafetyResult> {
  await hydrateOperatorGateState();
  const reviewedAt = new Date().toISOString();
  const blockers: CloseBlocker[] = [];
  const warnings: CloseWarning[] = [];

  if (!input.closePreviewId) {
    blockers.push(blocker("MISSING_CLOSE_PREVIEW_ID", "closePreviewId is required.", "Create close preview."));
    return finishReview({ allowed: false, blockers, warnings, reviewedAt, preview: null, doubleConfirm: input.doubleConfirm });
  }

  const preview = await getClosePreviewById(input.closePreviewId);
  if (!preview) {
    blockers.push(blocker("CLOSE_PREVIEW_NOT_FOUND", "Close preview not found.", "Create a new close preview."));
    return finishReview({ allowed: false, blockers, warnings, reviewedAt, preview: null, doubleConfirm: input.doubleConfirm });
  }

  if (isLiveEnabled() || preview.environment !== "TESTNET") {
    blockers.push(blocker("LIVE_ENVIRONMENT_BLOCKED", "Live trading is locked.", "Use testnet only."));
  }

  const operatorBlock = await isOperatorBlocked();
  if (operatorBlock.blocked) {
    blockers.push(
      blocker(
        "OPERATOR_BLOCKED",
        operatorBlock.reason ?? "Operator blocked.",
        "Resume engine or disable kill switch.",
      ),
    );
  }

  const testnet = await resolveTestnetConnectionStatus();
  if (!testnet.connected) {
    blockers.push(
      blocker(
        "BINANCE_NOT_CONNECTED",
        testnet.reason ?? "Binance testnet disconnected.",
        "Configure testnet and verify Binance status.",
      ),
    );
  }

  if (!preview.tradeId) {
    blockers.push(blocker("MISSING_TRADE_ID", "Close preview missing tradeId.", "Recreate close preview."));
  }

  if (!preview.positionId) {
    blockers.push(blocker("MISSING_POSITION_ID", "Close preview missing positionId.", "Recreate close preview."));
  }

  if (!preview.decisionLogId) {
    blockers.push(blocker("MISSING_DECISION_LOG_ID", "Close preview missing decisionLogId.", "Recreate close preview."));
  }

  if (preview.reduceOnly !== true) {
    blockers.push(blocker("REDUCE_ONLY_REQUIRED", "Close must be reduce-only.", "Recreate close preview."));
  }

  const expiry = checkClosePreviewExpiry(preview);
  if (expiry.expired) {
    blockers.push(blocker("CLOSE_PREVIEW_EXPIRED", "Close preview has expired.", "Create a new close preview."));
  }

  if (preview.blocked) {
    for (const code of preview.blockReasons) {
      blockers.push(blocker(code, code, "Resolve blocker before close."));
    }
  }

  const events = await getEvents();
  const openTrades = buildOpenTradesFromEvents(events);
  const trade = openTrades.find((t) => t.tradeId === preview.tradeId);
  if (!trade) {
    blockers.push(blocker("OPEN_TRADE_REQUIRED", "No OPEN trade for this close preview.", "Trade may already be closed."));
  }

  const snapshot = getSnapshotForTrade(preview.tradeId, events);
  if (!snapshot || snapshot.status !== "OPEN") {
    blockers.push(blocker("ACTIVE_POSITION_REQUIRED", "No active Binance position.", "Refresh positions first."));
  }

  if (snapshot?.status === "UNKNOWN") {
    blockers.push(blocker("POSITION_STATE_UNKNOWN", "Position state unknown.", "Refresh and reconcile positions."));
  }

  const reconciliation = await getReconciliationStatus();
  if (isReconciliationBlocking(reconciliation)) {
    blockers.push(
      blocker(
        "RECONCILIATION_BLOCKED",
        "Position reconciliation blocked.",
        "Resolve reconciliation warnings before close.",
      ),
    );
  } else if (reconciliation.status === "WARNING") {
    for (const issue of reconciliation.issues) {
      if (issue.severity !== "WARNING") continue;
      warnings.push({ code: issue.code, message: issue.message });
    }
  }

  if (!input.doubleConfirm) {
    blockers.push(
      blocker(
        "DOUBLE_CONFIRM_REQUIRED",
        "Double confirmation required before close.",
        "Check the confirmation box.",
      ),
    );
    await appendCloseEvent({
      type: "DOUBLE_CONFIRM_REQUIRED",
      runId: preview.runId,
      decisionLogId: preview.decisionLogId,
      tradeId: preview.tradeId,
      positionId: preview.positionId,
      closePreviewId: preview.closePreviewId,
      payload: { blockers: ["DOUBLE_CONFIRM_REQUIRED"] },
    });
  }

  if (!RISK_POLICY.liveLocked) {
    blockers.push(blocker("RISK_GATE_BLOCKED", "Live lock policy violated.", "Ensure liveLocked policy."));
  }

  const allowed = blockers.length === 0;
  if (allowed) {
    warnings.push({
      code: "TESTNET_ONLY",
      message: "Reduce-only testnet close — double confirm required at execution.",
    });
  }

  return finishReview({
    allowed,
    blockers,
    warnings,
    reviewedAt,
    preview,
    doubleConfirm: input.doubleConfirm,
  });
}

async function finishReview(input: {
  allowed: boolean;
  blockers: CloseBlocker[];
  warnings: CloseWarning[];
  reviewedAt: string;
  preview: Awaited<ReturnType<typeof getClosePreviewById>>;
  doubleConfirm: boolean;
}): Promise<CloseSafetyResult> {
  const result: CloseSafetyResult = {
    allowed: input.allowed,
    blocked: !input.allowed,
    requiresDoubleConfirm: true,
    doubleConfirmProvided: input.doubleConfirm,
    blockers: input.blockers,
    warnings: input.warnings,
    closePreviewId: input.preview?.closePreviewId ?? null,
    tradeId: input.preview?.tradeId ?? null,
    positionId: input.preview?.positionId ?? null,
    decisionLogId: input.preview?.decisionLogId ?? null,
    runId: input.preview?.runId ?? null,
    environment: "TESTNET",
    reviewedAt: input.reviewedAt,
    message: input.allowed
      ? "Close safety review passed — reduce-only close enabled in MVP 5C."
      : "Resolve blockers before close execution (MVP 5C).",
  };

  await appendCloseEvent({
    type: "CLOSE_REVIEWED",
    runId: input.preview?.runId,
    decisionLogId: input.preview?.decisionLogId,
    tradeId: input.preview?.tradeId,
    positionId: input.preview?.positionId,
    closePreviewId: input.preview?.closePreviewId,
    payload: {
      allowed: result.allowed,
      doubleConfirm: input.doubleConfirm,
      blockers: input.blockers.map((b) => b.code),
      warnings: input.warnings.map((w) => w.code),
      reduceOnly: input.preview?.reduceOnly ?? true,
    },
  });

  if (!input.allowed) {
    await appendCloseEvent({
      type: "CLOSE_BLOCKED",
      runId: input.preview?.runId,
      decisionLogId: input.preview?.decisionLogId,
      tradeId: input.preview?.tradeId,
      positionId: input.preview?.positionId,
      closePreviewId: input.preview?.closePreviewId,
      payload: {
        codes: input.blockers.map((b) => b.code),
        reasons: input.blockers.map((b) => b.message),
      },
    });
  }

  return result;
}

export async function validateCloseExecution(input: {
  closePreviewId: string;
  doubleConfirm: boolean;
}): Promise<CloseSafetyResult> {
  return reviewCloseSafety(input);
}
