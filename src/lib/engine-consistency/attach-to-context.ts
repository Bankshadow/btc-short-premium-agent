import type { AnalysisContext } from "@/lib/analysis-engine/analysis-state";
import { readTestnetMonitorSnapshotCache } from "@/lib/testnet-monitor/snapshot-cache";
import {
  buildEngineConsistencySnapshot,
  toAnalysisContextConsistencyLink,
} from "@/lib/engine-consistency/build-engine-consistency";

export async function attachConsistencyToContext(
  context: AnalysisContext,
): Promise<AnalysisContext> {
  const cached = readTestnetMonitorSnapshotCache()?.snapshot;
  if (cached?.engineConsistency) {
    return {
      ...context,
      consistency: toAnalysisContextConsistencyLink(cached.engineConsistency),
    };
  }

  const snapshot = await buildEngineConsistencySnapshot();
  return {
    ...context,
    consistency: toAnalysisContextConsistencyLink(snapshot),
  };
}
