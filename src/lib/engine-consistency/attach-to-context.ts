import type { AnalysisContext } from "@/lib/analysis-engine/analysis-state";
import {
  buildEngineConsistencySnapshot,
  toAnalysisContextConsistencyLink,
} from "@/lib/engine-consistency/build-engine-consistency";

export async function attachConsistencyToContext(
  context: AnalysisContext,
): Promise<AnalysisContext> {
  const snapshot = await buildEngineConsistencySnapshot();
  return {
    ...context,
    consistency: toAnalysisContextConsistencyLink(snapshot),
  };
}
