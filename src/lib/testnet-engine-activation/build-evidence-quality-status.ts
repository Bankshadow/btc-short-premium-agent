import { GOAL_MIN_TRADES_FOR_TRUST } from "@/lib/goal-engine/types";
import { buildEvidenceQualityServerSnapshot } from "@/lib/evidence-quality/build-evidence-quality-server";
import { readTestnetMonitorSnapshotCache } from "@/lib/testnet-monitor/snapshot-cache";
import {
  TESTNET_ENGINE_ACTIVATION_MVP,
  type EvidenceQualityActivationStatus,
  type EvidenceQualityStatusResponse,
} from "./types";

/** MVP 95 evidence quality status with explicit zero-state. */
export async function buildEvidenceQualityActivationStatus(): Promise<EvidenceQualityStatusResponse> {
  const updatedAt = new Date().toISOString();
  const cached = readTestnetMonitorSnapshotCache()?.snapshot?.evidenceQuality;

  const snapshot = cached ?? (await buildEvidenceQualityServerSnapshot());

  if (snapshot.totalCompletedTrades === 0) {
    return {
      mvp: TESTNET_ENGINE_ACTIVATION_MVP,
      status: "INSUFFICIENT",
      validEvidenceCount: 0,
      requiredEvidenceCount: GOAL_MIN_TRADES_FOR_TRUST,
      invalidEvidenceCount: 0,
      evidenceConfidence: 0,
      missingFields: [],
      message: "No completed trades yet.",
      updatedAt,
      liveTradingLocked: true,
    };
  }

  let status: EvidenceQualityActivationStatus = "OK";
  if (snapshot.evidenceQualityLevel === "INSUFFICIENT") status = "INSUFFICIENT";
  else if (snapshot.blocksStrategyHealthReview) status = "BLOCKED";
  else if (snapshot.evidenceQualityLevel === "POOR") status = "WARNING";

  return {
    mvp: TESTNET_ENGINE_ACTIVATION_MVP,
    status,
    validEvidenceCount: snapshot.validEvidenceCount,
    requiredEvidenceCount: GOAL_MIN_TRADES_FOR_TRUST,
    invalidEvidenceCount: snapshot.invalidEvidenceCount,
    evidenceConfidence: snapshot.evidenceConfidence,
    missingFields: snapshot.missingFields.map((m) => ({
      field: m.field,
      count: m.count,
    })),
    message:
      status === "INSUFFICIENT"
        ? `${snapshot.validEvidenceCount}/${GOAL_MIN_TRADES_FOR_TRUST} valid evidence trades.`
        : snapshot.blockReason ??
          `${snapshot.validEvidenceCount} valid · ${snapshot.invalidEvidenceCount} invalid evidence trade(s).`,
    updatedAt,
    liveTradingLocked: true,
  };
}
