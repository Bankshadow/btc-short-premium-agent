import { BACKBONE_STALE_MINUTES } from "./config";
import type {
  DeskBackboneHealth,
  DeskLearningSnapshot,
  DeskPortfolioSnapshot,
  DeskRiskSnapshot,
  DataSourceKind,
  SyncStatus,
} from "./types";

export function evaluateBackboneHealth(input: {
  lastWriteAt: string | null;
  syncStatus: SyncStatus;
  source: DataSourceKind;
  portfolio: DeskPortfolioSnapshot;
  learning: DeskLearningSnapshot;
  risk: DeskRiskSnapshot;
  writeOk: boolean;
  writeError?: string | null;
}): DeskBackboneHealth {
  const missingFields: string[] = [];
  const writeBlockers: string[] = [];

  if (!input.lastWriteAt) missingFields.push("lastWriteAt");
  if (input.portfolio.sampleSize === undefined) missingFields.push("portfolio.sampleSize");
  if (input.learning.strategySampleSize === undefined) {
    missingFields.push("learning.strategySampleSize");
  }

  let staleWarning: string | null = null;
  if (input.lastWriteAt) {
    const ageMs = Date.now() - new Date(input.lastWriteAt).getTime();
    const staleMs = BACKBONE_STALE_MINUTES * 60_000;
    if (ageMs > staleMs) {
      staleWarning = `Desk data is stale (${Math.round(ageMs / 60_000)}m old). Run a desk cycle.`;
    }
  } else {
    staleWarning = "No backbone write yet — run first desk cycle.";
  }

  if (!input.writeOk) {
    writeBlockers.push(input.writeError ?? "Backbone write failed");
  }
  if (input.risk.blockers.length > 0) {
    writeBlockers.push(...input.risk.blockers.slice(0, 3));
  }

  const healthy = input.writeOk && writeBlockers.length === 0 && !staleWarning?.includes("No backbone");

  return {
    healthy,
    lastWriteAt: input.lastWriteAt,
    syncStatus: input.syncStatus,
    source: input.source,
    missingFields,
    staleWarning,
    writeBlockers,
    liveModeAllowed: healthy && !input.risk.liveReadinessBlocked && input.writeOk,
  };
}

export function isBackboneHealthyForLive(health: DeskBackboneHealth): boolean {
  return health.liveModeAllowed && health.healthy;
}
