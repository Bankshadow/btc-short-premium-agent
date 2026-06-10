import type { MicroLiveReadinessSnapshot } from "./types";

export function resolveAiNextActionFromMicroLiveReadiness(
  readiness: MicroLiveReadinessSnapshot | null | undefined,
  fallback: string,
): string {
  if (!readiness) return fallback;
  if (readiness.topBlocker) return readiness.topBlocker;
  if (readiness.readinessStatus === "READY_FOR_REVIEW") {
    return readiness.report.nextRequiredActions[0] ?? fallback;
  }
  return readiness.report.nextRequiredActions[0] ?? fallback;
}
