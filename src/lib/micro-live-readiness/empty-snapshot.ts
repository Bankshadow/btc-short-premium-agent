import type { MicroLiveReadinessSnapshot } from "./types";
import {
  MICRO_LIVE_READINESS_LABEL,
  MICRO_LIVE_READINESS_MVP,
} from "./types";

export function emptyMicroLiveReadiness(): MicroLiveReadinessSnapshot {
  const now = new Date().toISOString();
  return {
    mvp: MICRO_LIVE_READINESS_MVP,
    label: MICRO_LIVE_READINESS_LABEL,
    readinessStatus: "NOT_READY",
    readinessScore: 0,
    report: {
      readinessStatus: "NOT_READY",
      readinessScore: 0,
      blockers: ["Insufficient evidence — complete 12 valid testnet trades."],
      warnings: [],
      evidenceLinks: [],
      nextRequiredActions: ["Complete 12 valid closed testnet trades with decisionLogId and PnL."],
      checklist: [],
      missingConfigItems: [],
      generatedAt: now,
    },
    liveTradingLocked: true,
    liveExecutionEnabled: false,
    topBlocker: "Insufficient evidence — complete 12 valid testnet trades.",
    governanceWarningActive: false,
    lastUpdatedAt: now,
  };
}
