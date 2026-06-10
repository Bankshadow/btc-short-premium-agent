import type { MissionFlowSnapshot } from "@/lib/mission-flow/types";
import type { AnalysisResult, AnalysisFinalVerdict } from "./analysis-result";
import type { CentralAnalysisState } from "./analysis-state";

/** Thin display-layer view — pages should consume this instead of rebuilding analysis. */
export interface AnalysisUiView {
  runId: string | null;
  decisionLogId: string | null;
  finalVerdict: AnalysisResult["finalVerdict"] | null;
  confidence: number | null;
  riskStatus: AnalysisResult["riskStatus"] | null;
  blockers: string[];
  nextAction: string | null;
  humanActionRequired: boolean;
  aiState: AnalysisResult["aiState"];
  reportSummary: string | null;
  previewId: string | null;
  liveTradingLocked: true;
  missionProgressPct: number | null;
  pendingLearningCount: number;
  lastUpdatedAt: string | null;
}

function normalizeVerdict(raw: string | null | undefined): AnalysisFinalVerdict | null {
  if (!raw) return null;
  const v = raw.toUpperCase();
  if (v === "TRADE" || v === "WAIT" || v === "SKIP" || v === "HOLD") return v;
  return null;
}

export function toAnalysisUiView(input: {
  state: CentralAnalysisState;
  result: AnalysisResult | null;
  mission?: MissionFlowSnapshot | null;
}): AnalysisUiView {
  const result = input.result;
  const mission = input.mission ?? input.state.context?.missionSnapshot ?? null;

  return {
    runId: result?.runId ?? input.state.latestRunId,
    decisionLogId: result?.decisionLogId ?? input.state.latestDecisionLogId,
    finalVerdict:
      result?.finalVerdict ?? normalizeVerdict(mission?.lastVerdict) ?? null,
    confidence: result?.confidence ?? null,
    riskStatus: result?.riskStatus ?? null,
    blockers: result?.blockers ?? [],
    nextAction: result?.nextAction ?? mission?.aiStatus?.nextAction ?? null,
    humanActionRequired: result?.humanActionRequired ?? false,
    aiState: result?.aiState ?? "IDLE",
    reportSummary: result?.reportSummary ?? null,
    previewId: result?.tradeCandidate?.previewId ?? mission?.pendingTestnetPreview?.previewId ?? null,
    liveTradingLocked: true,
    missionProgressPct: result?.missionImpact.progressPct ?? mission?.progressPct ?? null,
    pendingLearningCount:
      result?.learningImpact.pendingReviewCount ??
      mission?.learningProgress?.pendingCount ??
      0,
    lastUpdatedAt: result?.generatedAt ?? input.state.lastUpdatedAt,
  };
}

export function stripAnalysisResultForClient(
  result: AnalysisResult,
): Omit<AnalysisResult, "analyzeResponse" | "context"> {
  const { analyzeResponse: _a, context: _c, ...rest } = result;
  return rest;
}
