import type {
  ExecutionBlocker,
  ExecutionSafetyResult,
  ExecutionWarning,
} from "@/lib/execution/execution-safety-types";
import type { OrderPreview } from "@/lib/execution/preview-types";

export type ReportsGateStatus =
  | "NO_PREVIEW"
  | "READY_FOR_REVIEW"
  | "BLOCKED"
  | "READY_FOR_EXECUTION_NEXT_MVP";

export interface SafetyEventSummary {
  eventId: string;
  type: string;
  timestamp: string;
  previewId: string | null;
  runId: string | null;
  decisionLogId: string | null;
  blockerCodes: string[];
}

export interface ExecutionSafetyGateReport {
  status: ReportsGateStatus;
  previewId: string | null;
  runId: string | null;
  decisionLogId: string | null;
  symbol: string | null;
  side: string | null;
  notionalUsd: number | null;
  previewStatus: string | null;
  expiresAt: string | null;
  latestReviewStatus: "NOT_REVIEWED" | "ALLOWED" | "BLOCKED";
  doubleConfirmRequired: boolean;
  doubleConfirmProvided: boolean;
  blockers: ExecutionBlocker[];
  warnings: ExecutionWarning[];
  nextSafeAction: string;
  latestReview: ExecutionSafetyResult | null;
  latestReviewMessage: string | null;
  latestReviewedAt: string | null;
  previewExpired: boolean;
  duplicateDetected: boolean;
  recentSafetyEvents: SafetyEventSummary[];
}

export function deriveReportsGateStatus(input: {
  preview: OrderPreview | null;
  latestReview: ExecutionSafetyResult | null;
}): ReportsGateStatus {
  if (!input.preview) return "NO_PREVIEW";

  if (input.latestReview?.allowed && input.latestReview.doubleConfirmProvided) {
    return "READY_FOR_EXECUTION_NEXT_MVP";
  }

  if (
    input.latestReview?.blocked ||
    input.preview.status === "EXPIRED" ||
    input.preview.status === "CANCELLED" ||
    input.preview.status === "BLOCKED"
  ) {
    return "BLOCKED";
  }

  return "READY_FOR_REVIEW";
}

export function buildNextSafeAction(
  status: ReportsGateStatus,
  blockers: ExecutionBlocker[],
): string {
  if (status === "NO_PREVIEW") {
    return "No active preview yet. Run analysis to create a testnet preview.";
  }
  if (status === "READY_FOR_EXECUTION_NEXT_MVP") {
    return "Safety gate passed — testnet execute enabled (MVP 4).";
  }
  if (status === "READY_FOR_REVIEW") {
    return "Open Dashboard, review the preview, and confirm details to run the execution safety gate.";
  }
  if (blockers.length > 0) {
    return blockers[0]!.requiredAction;
  }
  return "Resolve blockers on Dashboard before any execution in MVP 4.";
}

export function buildExecutionSafetyGateReport(input: {
  preview: OrderPreview | null;
  latestReview: ExecutionSafetyResult | null;
  recentSafetyEvents: SafetyEventSummary[];
}): ExecutionSafetyGateReport {
  const status = deriveReportsGateStatus({
    preview: input.preview,
    latestReview: input.latestReview,
  });

  const blockers = input.latestReview?.blockers ?? [];
  const warnings = input.latestReview?.warnings ?? [];

  let latestReviewStatus: ExecutionSafetyGateReport["latestReviewStatus"] =
    "NOT_REVIEWED";
  if (input.latestReview?.allowed) latestReviewStatus = "ALLOWED";
  else if (input.latestReview?.blocked) latestReviewStatus = "BLOCKED";

  const doubleConfirmRequired = input.preview?.requiresDoubleConfirm ?? true;
  const doubleConfirmProvided = Boolean(input.latestReview?.doubleConfirmProvided);
  const previewExpired = input.preview?.status === "EXPIRED";
  const duplicateDetected =
    blockers.some((b) => b.code === "DUPLICATE_ORDER_DETECTED") ||
    input.recentSafetyEvents.some(
      (e) =>
        e.type === "DUPLICATE_ORDER_BLOCKED" &&
        e.previewId === input.preview?.previewId,
    );

  return {
    status,
    previewId: input.preview?.previewId ?? null,
    runId: input.preview?.runId ?? input.latestReview?.runId ?? null,
    decisionLogId:
      input.preview?.decisionLogId ?? input.latestReview?.decisionLogId ?? null,
    symbol: input.preview?.symbol ?? null,
    side: input.preview?.side ?? null,
    notionalUsd: input.preview?.notionalUsd ?? null,
    previewStatus: input.preview?.status ?? null,
    expiresAt: input.preview?.expiresAt ?? null,
    latestReviewStatus,
    doubleConfirmRequired,
    doubleConfirmProvided,
    blockers,
    warnings,
    nextSafeAction: buildNextSafeAction(status, blockers),
    latestReview: input.latestReview,
    latestReviewMessage: input.latestReview?.message ?? null,
    latestReviewedAt: input.latestReview?.reviewedAt ?? null,
    previewExpired,
    duplicateDetected,
    recentSafetyEvents: input.recentSafetyEvents,
  };
}
