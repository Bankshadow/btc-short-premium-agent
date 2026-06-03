import { runAnalysisEngine, runDecisionEngineFromInput } from "./analyze";
import { normalizeAnalyzeRequest } from "./analyze-request";
import type {
  AnalysisInput,
  AnalyzeApiResponse,
  DecisionEngineInput,
} from "@/lib/types/market";

type AnalyzeRequestBody = Partial<DecisionEngineInput> &
  AnalysisInput &
  Record<string, unknown>;

function hasFullEngineInput(
  body: Partial<DecisionEngineInput>,
): body is DecisionEngineInput {
  return Boolean(
    body.market &&
      body.optionCandidates &&
      body.technicalDaily &&
      body.technical4h &&
      body.technical1h &&
      body.macroEvent &&
      body.liquidation,
  );
}

/** Shared analyze pipeline used by /api/analyze and /api/cron/analyze. */
export async function runAnalyzeRequest(
  raw: Partial<DecisionEngineInput> & AnalysisInput = {},
): Promise<AnalyzeApiResponse> {
  const body = normalizeAnalyzeRequest(
    raw as AnalyzeRequestBody,
  );

  if (hasFullEngineInput(body)) {
    return runDecisionEngineFromInput(body, body.derivativesOverrides);
  }

  return runAnalysisEngine(body);
}
