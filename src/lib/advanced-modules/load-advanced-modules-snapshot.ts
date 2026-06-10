import { loadCentralAnalysisBundle } from "@/lib/analysis-engine/analysis-orchestrator";
import { queryEngineEvents } from "@/lib/engine-event-bus/engine-event-bus";
import { buildAdvancedModulesSnapshot } from "./build-module-status";
import type { AdvancedModuleId, AdvancedModulesSnapshot } from "./types";
import type { AdvancedModuleStatus } from "./types";

export async function loadAdvancedModulesSnapshotForApi(input?: {
  moduleId?: AdvancedModuleId;
}): Promise<{
  snapshot: AdvancedModulesSnapshot;
  module: AdvancedModuleStatus | null;
}> {
  const [{ state, latest }, eventsResult] = await Promise.all([
    loadCentralAnalysisBundle(),
    queryEngineEvents({ limit: 100 }),
  ]);

  const snapshot = await buildAdvancedModulesSnapshot({
    context: state.context,
    latestResult: latest,
    events: eventsResult.events,
  });

  const module = input?.moduleId
    ? snapshot.modules.find((m) => m.id === input.moduleId) ?? null
    : null;

  return { snapshot, module };
}
