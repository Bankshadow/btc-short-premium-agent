import type { LiveReadinessReport } from "@/lib/live-readiness/types";
import type { TradingEnvironment } from "./types";

export interface LiveEnableGateResult {
  allowed: boolean;
  blockers: string[];
}

export function evaluateLiveEnableGate(input: {
  targetEnvironment: TradingEnvironment;
  readiness: LiveReadinessReport | null;
  operationalBlockers?: string[];
}): LiveEnableGateResult {
  if (input.targetEnvironment !== "LIVE_ENABLED") {
    return { allowed: true, blockers: [] };
  }

  const blockers: string[] = [];
  const readiness = input.readiness;

  if (!readiness) {
    blockers.push("Live readiness report unavailable — refresh /live-readiness first.");
  } else {
    if (readiness.overallStatus === "FAIL") {
      blockers.push("Live readiness checklist FAIL.");
    }
    if (readiness.hardBlockers.length > 0) {
      blockers.push(...readiness.hardBlockers.slice(0, 5));
    }
    if (!readiness.readyForSmallLivePerpPilot) {
      blockers.push("Not ready for small live perp pilot.");
    }
  }

  for (const b of input.operationalBlockers ?? []) {
    blockers.push(b);
  }

  return {
    allowed: blockers.length === 0,
    blockers: [...new Set(blockers)],
  };
}
