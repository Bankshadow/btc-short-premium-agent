import { buildAnalysisEngineHealthSnapshot } from "@/lib/analysis-engine-health/build-engine-health";
import type { EngineHealthStatus } from "@/lib/analysis-engine-health/types";
import { buildEngineConsistencySnapshot } from "./build-engine-consistency";
import type { CombinedEngineStatusSnapshot, ConsistencyStatus } from "./types";

const STATUS_RANK: Record<ConsistencyStatus | EngineHealthStatus, number> = {
  OK: 0,
  WARNING: 1,
  BLOCKED: 2,
};

export async function buildCombinedEngineStatus(): Promise<CombinedEngineStatusSnapshot> {
  const [health, consistency] = await Promise.all([
    buildAnalysisEngineHealthSnapshot(),
    buildEngineConsistencySnapshot(),
  ]);

  let summary: ConsistencyStatus = "OK";
  for (const status of [health.summary, consistency.consistencyStatus]) {
    if (STATUS_RANK[status] > STATUS_RANK[summary]) {
      summary = status;
    }
  }

  const summaryLabel =
    summary === "OK" ? "Engine OK" : summary === "WARNING" ? "Warning" : "Blocked";

  return {
    mvp: 88,
    label: "Combined Engine Status",
    summary,
    summaryLabel,
    healthStatus: health.summary,
    consistencyStatus: consistency.consistencyStatus,
    positionStateUncertain: consistency.positionStateUncertain,
    blocksNewTrades: consistency.blocksNewTrades,
    generatedAt: new Date().toISOString(),
  };
}
