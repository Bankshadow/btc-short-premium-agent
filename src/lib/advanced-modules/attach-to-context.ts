import type { AnalysisContext } from "@/lib/analysis-engine/analysis-state";
import type { AnalysisResult } from "@/lib/analysis-engine/analysis-result";
import type { EngineEvent } from "@/lib/engine-event-bus/types";
import {
  buildAdvancedModuleContextLinks,
  buildAdvancedModulesSnapshot,
} from "@/lib/advanced-modules/build-module-status";
import { queryEngineEvents } from "@/lib/engine-event-bus/engine-event-bus";

export async function attachAdvancedModulesToContext(input: {
  context: AnalysisContext;
  latestResult?: AnalysisResult | null;
  events?: EngineEvent[];
}): Promise<AnalysisContext> {
  const events =
    input.events ??
    (await queryEngineEvents({ limit: 100 })).events;

  const snapshot = await buildAdvancedModulesSnapshot({
    context: input.context,
    latestResult: input.latestResult ?? null,
    events,
  });

  return {
    ...input.context,
    advancedModules: buildAdvancedModuleContextLinks(snapshot),
  };
}
