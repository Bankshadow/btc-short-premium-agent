import type { AnalysisContext } from "./analysis-state";
import type { AnalysisResult } from "./analysis-result";
import { buildReportSummary } from "./analysis-result";

export interface AnalysisReportBridgePayload {
  reportSummary: string;
  headline: string;
  verdictLabel: string;
  blockersSummary: string | null;
  missionProgressLabel: string | null;
}

export function buildAnalysisReportBridge(input: {
  context: AnalysisContext;
  result: Pick<
    AnalysisResult,
    "finalVerdict" | "confidence" | "blockers" | "reasons" | "missionImpact"
  >;
}): AnalysisReportBridgePayload {
  const reportSummary = buildReportSummary(input.result);
  const mission = input.context.missionSnapshot;

  return {
    reportSummary,
    headline: reportSummary,
    verdictLabel: input.result.finalVerdict,
    blockersSummary:
      input.result.blockers.length > 0 ? input.result.blockers.join("; ") : null,
    missionProgressLabel: mission
      ? `${mission.progressPct ?? 0}% mission progress`
      : input.result.missionImpact.progressPct != null
        ? `${input.result.missionImpact.progressPct}% mission progress`
        : null,
  };
}
