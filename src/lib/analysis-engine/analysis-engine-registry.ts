import type { AnalysisContext } from "./analysis-state";
import type { AnalysisResult } from "./analysis-result";

export type AnalysisPipelineStageId =
  | "build_context"
  | "playbook_analyzer"
  | "agent_committee"
  | "strategy_registry"
  | "governance"
  | "validation_kill_switch"
  | "execution_readiness"
  | "learning_bridge"
  | "final_result"
  | "journal_events"
  | "mission_snapshot"
  | "ai_status";

export interface AnalysisPipelineStage {
  id: AnalysisPipelineStageId;
  label: string;
  order: number;
}

export const ANALYSIS_PIPELINE_STAGES: AnalysisPipelineStage[] = [
  { id: "build_context", label: "Build context", order: 1 },
  { id: "playbook_analyzer", label: "Playbook analyzer", order: 2 },
  { id: "agent_committee", label: "Agent committee", order: 3 },
  { id: "strategy_registry", label: "Strategy registry", order: 4 },
  { id: "governance", label: "Governance check", order: 5 },
  { id: "validation_kill_switch", label: "Validation / kill switch", order: 6 },
  { id: "execution_readiness", label: "Execution readiness", order: 7 },
  { id: "learning_bridge", label: "Learning bridge", order: 8 },
  { id: "final_result", label: "Final AnalysisResult", order: 9 },
  { id: "journal_events", label: "Journal events", order: 10 },
  { id: "mission_snapshot", label: "Mission snapshot", order: 11 },
  { id: "ai_status", label: "AI status", order: 12 },
];

export function listAnalysisPipelineStages(): AnalysisPipelineStage[] {
  return [...ANALYSIS_PIPELINE_STAGES].sort((a, b) => a.order - b.order);
}

export function resolveAnalysisAiState(input: {
  result: Pick<AnalysisResult, "finalVerdict" | "blockers" | "humanActionRequired">;
  context: AnalysisContext | null;
}): AnalysisResult["aiState"] {
  if (input.result.blockers.length > 0) return "BLOCKED";
  if (input.result.humanActionRequired && input.result.finalVerdict === "TRADE") {
    return "WAITING";
  }
  if ((input.context?.positions.length ?? 0) > 0) return "MONITORING";
  if (input.result.finalVerdict === "WAIT") return "WAITING";
  return "IDLE";
}
