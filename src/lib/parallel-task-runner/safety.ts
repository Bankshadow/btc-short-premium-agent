import { PARALLEL_TASK_RUNNER_SAFETY_NOTICE } from "./types";

export function assertParallelReviewOnly(intent?: string): void {
  const normalized = (intent ?? "").toLowerCase();
  if (
    normalized.includes("execute") ||
    normalized.includes("place order") ||
    normalized.includes("submit order")
  ) {
    throw new Error(
      `${PARALLEL_TASK_RUNNER_SAFETY_NOTICE} Request rejected: parallel order execution is forbidden.`,
    );
  }
}

export function executionSafetyFlags() {
  return {
    executionSerialized: true as const,
    parallelOrderExecutionBlocked: true as const,
    duplicateTestnetOrderGuard: "autopilot-loop-guard + binance journal dedup",
    doubleConfirmRequired: true as const,
  };
}
