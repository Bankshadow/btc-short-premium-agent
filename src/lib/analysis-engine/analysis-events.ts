import { emitAnalyzePipelineEvents } from "@/lib/ai-status/emit-pipeline";
import { emitAnalysisPipelineEngineEvents } from "@/lib/engine-event-bus/emit-analysis-pipeline";
import { emitEngineEvent } from "@/lib/engine-event-bus/emit-engine-event";
import { queryEngineEvents } from "@/lib/engine-event-bus/engine-event-store";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { AutopilotRunResult } from "@/lib/autopilot/types";
import type { AnalysisAuditEvent, AnalysisResult } from "./analysis-result";
import type { AnalysisContext } from "./analysis-state";

export function newAnalysisRunId(prefix = "cae"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function emitCentralAnalysisAuditEvents(input: {
  runId: string;
  result: AnalysisResult;
  analysis: AnalyzeApiResponse;
  context: AnalysisContext;
  autopilot?: AutopilotRunResult | null;
  previewCreated?: boolean;
  previousBlockers?: string[];
}): Promise<AnalysisAuditEvent[]> {
  const engineEvents = await emitAnalysisPipelineEngineEvents({
    runId: input.runId,
    context: input.context,
    analysis: input.analysis,
    result: input.result,
    previewCreated: Boolean(input.previewCreated),
  });

  if (
    input.previousBlockers &&
    input.previousBlockers.length > 0 &&
    input.result.blockers.length === 0
  ) {
    await emitEngineEvent({
      type: "BLOCKER_RESOLVED",
      runId: input.runId,
      decisionLogId: input.result.decisionLogId,
      summary: "Previous blockers cleared",
      meaningful: true,
      severity: "success",
    });
  }

  await emitAnalyzePipelineEvents({
    runId: input.runId,
    analysis: input.analysis,
    autopilot: input.autopilot,
    previewCreated: input.previewCreated,
  });

  return engineEvents.map((e) => ({
    id: e.id,
    type: e.type,
    detail: e.detail,
    timestamp: e.timestamp,
    linkedDecisionLogId: e.decisionLogId,
  }));
}
