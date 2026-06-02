import type {
  AnalyzeApiResponse,
  DataSourceError,
  DecisionEngineOutput,
} from "@/lib/types/market";

/** Attach friendly API field aliases to decision engine output. */
export function buildAnalyzeApiResponse(
  output: DecisionEngineOutput,
  sourceErrors: DataSourceError[],
): AnalyzeApiResponse {
  return {
    ...output,
    sourceErrors,
    marketSnapshot: output.step1_marketSnapshot,
    technicalSnapshot: output.technical,
    checks: output.step2_eightCheckFramework,
    noTradeRules: output.step3_noTradeRules,
    combinationRead: output.step4_combinationRead,
    verdict: output.step5_verdict,
    actionPlan: output.step6_actionPlan,
    dataTimestamp: output.step5_verdict.analyzedAt,
    dataSourceIssues: sourceErrors,
  };
}
