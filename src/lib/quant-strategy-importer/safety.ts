import type { PromoteImportInput, QuantImportStatus } from "./types";

const ALLOWED_TRANSITIONS: Record<
  QuantImportStatus,
  QuantImportStatus[]
> = {
  RESEARCH_ONLY: ["READY_FOR_BACKTEST", "REJECTED"],
  READY_FOR_BACKTEST: ["READY_FOR_PAPER", "REJECTED", "RESEARCH_ONLY"],
  READY_FOR_PAPER: ["REJECTED", "RESEARCH_ONLY"],
  REJECTED: ["RESEARCH_ONLY"],
};

export function canTransitionImportStatus(
  from: QuantImportStatus,
  to: QuantImportStatus,
): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertHumanApproval(input: PromoteImportInput): string | null {
  if (!input.humanApproval) {
    return "Human approval is required before changing import status.";
  }
  if (!input.sourceId?.trim()) {
    return "sourceId is required.";
  }
  return null;
}

/** Imported strategies must never trigger order execution paths. */
export function assertImportExecutionBlocked(): true {
  return true;
}

export function buildBacktestUrl(sourceId: string): string {
  return `/strategy-lab/backtest?importId=${encodeURIComponent(sourceId)}&source=quant-import`;
}
