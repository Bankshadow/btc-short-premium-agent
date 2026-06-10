import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import type { JournalEvent } from "@/lib/journal/journal-types";
import { isLiveEnabled, RISK_POLICY } from "@/lib/risk/risk-gate";
import { detectDuplicateOrder } from "./duplicate-order-guard";
import type {
  ExecutionBlocker,
  ExecutionSafetyResult,
  ExecutionSafetyStatus,
  ExecutionWarning,
} from "./execution-safety-types";
import { hydrateOperatorGateState } from "@/lib/operator/operator-actions";
import { getKillSwitchState } from "./kill-switch-state";
import { getPreviewById } from "./preview-store";
import { checkPreviewExpiry } from "./preview-expiry";
import { resolveTestnetConnectionStatus } from "./testnet-status";

function blocker(
  code: string,
  message: string,
  requiredAction: string,
  severity: ExecutionBlocker["severity"] = "HARD_BLOCK",
): ExecutionBlocker {
  return { code, severity, message, requiredAction };
}

async function appendSafetyEvent(input: {
  type:
    | "EXECUTION_REVIEWED"
    | "EXECUTE_BLOCKED"
    | "DOUBLE_CONFIRM_REQUIRED"
    | "PREVIEW_EXPIRED"
    | "DUPLICATE_ORDER_BLOCKED"
    | "KILL_SWITCH_BLOCKED";
  runId?: string | null;
  decisionLogId?: string | null;
  previewId?: string | null;
  payload: Record<string, unknown>;
}): Promise<void> {
  await appendEvent({
    type: input.type,
    environment: "testnet",
    runId: input.runId ?? undefined,
    decisionLogId: input.decisionLogId ?? undefined,
    previewId: input.previewId ?? undefined,
    payload: input.payload,
  });
}

export async function reviewExecutionSafety(input: {
  previewId: string;
  doubleConfirm: boolean;
}): Promise<ExecutionSafetyResult> {
  await hydrateOperatorGateState();
  const reviewedAt = new Date().toISOString();
  const blockers: ExecutionBlocker[] = [];
  const warnings: ExecutionWarning[] = [];

  if (!input.previewId) {
    blockers.push(
      blocker("MISSING_PREVIEW_ID", "previewId is required.", "Create or select a preview."),
    );
    const result = buildResult({
      allowed: false,
      blockers,
      warnings,
      previewId: null,
      runId: null,
      decisionLogId: null,
      reviewedAt,
    });
    await appendSafetyEvent({
      type: "EXECUTION_REVIEWED",
      payload: { ...result, blockers: blockers.map((b) => b.code) },
    });
    await appendSafetyEvent({
      type: "EXECUTE_BLOCKED",
      payload: { blockers: blockers.map((b) => b.code), previewId: null },
    });
    return result;
  }

  const previewRaw = await getPreviewById(input.previewId);
  if (!previewRaw) {
    blockers.push(
      blocker("PREVIEW_NOT_FOUND", "Preview not found in journal.", "Run analysis or recreate preview."),
    );
    const result = buildResult({
      allowed: false,
      blockers,
      warnings,
      previewId: input.previewId,
      runId: null,
      decisionLogId: null,
      reviewedAt,
    });
    await appendSafetyEvent({
      type: "EXECUTION_REVIEWED",
      previewId: input.previewId,
      payload: { ...result, blockers: blockers.map((b) => b.code) },
    });
    await appendSafetyEvent({
      type: "EXECUTE_BLOCKED",
      previewId: input.previewId,
      payload: { blockers: blockers.map((b) => b.code) },
    });
    return result;
  }

  const runId = previewRaw.runId;
  const decisionLogId = previewRaw.decisionLogId;
  const events = await getEvents();

  if (isLiveEnabled() || previewRaw.environment !== "TESTNET") {
    blockers.push(
      blocker(
        "LIVE_ENVIRONMENT_BLOCKED",
        "Live trading is locked — TESTNET only.",
        "Use testnet preview only.",
      ),
    );
  }

  const killSwitch = getKillSwitchState();
  if (killSwitch.active) {
    blockers.push(
      blocker(
        "KILL_SWITCH_ACTIVE",
        killSwitch.reason ?? "Kill switch is active.",
        "Deactivate kill switch in settings.",
      ),
    );
    await appendSafetyEvent({
      type: "KILL_SWITCH_BLOCKED",
      runId,
      decisionLogId,
      previewId: input.previewId,
      payload: { reason: killSwitch.reason, blockers: ["KILL_SWITCH_ACTIVE"] },
    });
  }

  const testnet = await resolveTestnetConnectionStatus();
  if (!testnet.connected) {
    blockers.push(
      blocker(
        "TESTNET_DISCONNECTED",
        testnet.reason ?? "Testnet disconnected.",
        "Configure testnet and set BINANCE_TESTNET_MOCK_CONNECTED=true when ready.",
      ),
    );
  }

  if (!runId) {
    blockers.push(
      blocker("MISSING_RUN_ID", "Preview missing runId.", "Re-run analysis to link preview."),
    );
  }

  if (!decisionLogId) {
    blockers.push(
      blocker(
        "MISSING_DECISION_LOG_ID",
        "Preview missing decisionLogId.",
        "Re-run analysis to link preview.",
      ),
    );
  }

  if (previewRaw.status === "CANCELLED") {
    blockers.push(
      blocker("PREVIEW_CANCELLED", "Preview was cancelled.", "Create a new preview."),
    );
  }

  const expiry = checkPreviewExpiry(previewRaw);
  const preview = expiry.preview;
  if (expiry.expired) {
    blockers.push(
      blocker("PREVIEW_EXPIRED", "Preview has expired.", "Run analysis to create a new preview."),
    );
    await appendSafetyEvent({
      type: "PREVIEW_EXPIRED",
      runId,
      decisionLogId,
      previewId: input.previewId,
      payload: { expiresAt: preview.expiresAt, blockers: ["PREVIEW_EXPIRED"] },
    });
  }

  const duplicate = detectDuplicateOrder({ events, preview });
  if (duplicate.duplicate) {
    blockers.push(
      blocker(
        duplicate.code ?? "DUPLICATE_ORDER_DETECTED",
        duplicate.message ?? "Duplicate order detected.",
        "Wait for existing order lifecycle or create new analysis.",
      ),
    );
    await appendSafetyEvent({
      type: "DUPLICATE_ORDER_BLOCKED",
      runId,
      decisionLogId,
      previewId: input.previewId,
      payload: {
        code: duplicate.code,
        message: duplicate.message,
        symbol: preview.symbol,
        side: preview.side,
        notionalUsd: preview.notionalUsd,
      },
    });
  }

  if (!input.doubleConfirm) {
    blockers.push(
      blocker(
        "DOUBLE_CONFIRM_REQUIRED",
        "Double confirmation required before execution.",
        "Check the confirmation box in the review modal.",
        "HARD_BLOCK",
      ),
    );
    await appendSafetyEvent({
      type: "DOUBLE_CONFIRM_REQUIRED",
      runId,
      decisionLogId,
      previewId: input.previewId,
      payload: { blockers: ["DOUBLE_CONFIRM_REQUIRED"] },
    });
  }

  if (!RISK_POLICY.liveLocked) {
    blockers.push(
      blocker("RISK_GATE_BLOCKED", "Live lock policy violated.", "Ensure liveLocked policy."),
    );
  }

  const hardBlocks = blockers.filter((b) => b.severity === "HARD_BLOCK");
  const allowed = hardBlocks.length === 0;

  if (allowed) {
    warnings.push({
      code: "TESTNET_EXECUTE_AVAILABLE",
      message: "Safety gate passed — testnet execute available via Dashboard.",
    });
  }

  const result = buildResult({
    allowed,
    blockers,
    warnings,
    previewId: input.previewId,
    runId,
    decisionLogId,
    reviewedAt,
  });

  await appendSafetyEvent({
    type: "EXECUTION_REVIEWED",
    runId,
    decisionLogId,
    previewId: input.previewId,
    payload: {
      allowed: result.allowed,
      blocked: result.blocked,
      doubleConfirm: input.doubleConfirm,
      blockers: blockers.map((b) => ({ code: b.code, message: b.message })),
      warnings: warnings.map((w) => w.code),
      symbol: preview.symbol,
      side: preview.side,
      notionalUsd: preview.notionalUsd,
    },
  });

  if (!allowed) {
    await appendSafetyEvent({
      type: "EXECUTE_BLOCKED",
      runId,
      decisionLogId,
      previewId: input.previewId,
      payload: {
        reasons: hardBlocks.map((b) => b.message),
        codes: hardBlocks.map((b) => b.code),
      },
    });
  }

  return result;
}

function buildResult(input: {
  allowed: boolean;
  blockers: ExecutionBlocker[];
  warnings: ExecutionWarning[];
  previewId: string | null;
  runId: string | null;
  decisionLogId: string | null;
  reviewedAt: string;
}): ExecutionSafetyResult {
  return {
    allowed: input.allowed,
    blocked: !input.allowed,
    requiresDoubleConfirm: RISK_POLICY.requireDoubleConfirm,
    blockers: input.blockers,
    warnings: input.warnings,
    previewId: input.previewId,
    runId: input.runId,
    decisionLogId: input.decisionLogId,
    environment: "TESTNET",
    reviewedAt: input.reviewedAt,
    executionEnabled: input.allowed,
    message: input.allowed
      ? "Execution gate passed — testnet execute enabled."
      : "Resolve blockers before execution.",
  };
}

function reviewFromEvent(latest: JournalEvent): ExecutionSafetyResult {
  const payload = latest.payload as {
    allowed?: boolean;
    doubleConfirm?: boolean;
    blockers?: Array<{ code: string; message: string } | string>;
    warnings?: string[];
  };

  const blockers: ExecutionBlocker[] = Array.isArray(payload.blockers)
    ? payload.blockers.map((b) =>
        typeof b === "string"
          ? blocker(b, b, "Resolve blocker.")
          : blocker(b.code, b.message, "Resolve blocker."),
      )
    : [];

  return {
    allowed: Boolean(payload.allowed),
    blocked: !payload.allowed,
    requiresDoubleConfirm: true,
    doubleConfirmProvided: Boolean(payload.doubleConfirm),
    blockers,
    warnings: (payload.warnings ?? []).map((code) => ({ code, message: code })),
    previewId: latest.previewId ?? null,
    runId: latest.runId ?? null,
    decisionLogId: latest.decisionLogId ?? null,
    environment: "TESTNET",
    reviewedAt: latest.timestamp,
    executionEnabled: Boolean(payload.allowed),
    message: payload.allowed
      ? "Execution gate passed — testnet execute enabled."
      : "Resolve blockers before execution.",
  };
}

export async function getLatestExecutionReview(
  previewId?: string,
): Promise<ExecutionSafetyResult | null> {
  const events = await getEvents();
  const latest = events.find(
    (e) =>
      e.type === "EXECUTION_REVIEWED" &&
      (previewId ? e.previewId === previewId : true),
  );
  if (!latest) return null;
  return reviewFromEvent(latest);
}

export function deriveExecutionSafetyStatus(input: {
  preview: { status: string } | null;
  latestReview: ExecutionSafetyResult | null;
}): ExecutionSafetyStatus {
  if (!input.preview) return "no_preview";
  if (input.preview.status === "EXPIRED") return "expired";
  if (
    input.latestReview?.blockers.some((b) => b.code === "DUPLICATE_ORDER_DETECTED")
  ) {
    return "duplicate";
  }
  if (input.latestReview?.allowed) return "ready";
  if (input.latestReview?.blocked) return "blocked";
  if (input.preview.status === "ACTIVE") return "ready";
  return "blocked";
}
