import { applyDeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import { runAnalysisEngine, runDecisionEngineFromInput } from "./analyze";
import { normalizeAnalyzeRequest } from "./analyze-request";
import type { DeskMemoryClientPayload } from "@/lib/memory/types";
import type { SpotQuote } from "@/lib/types/market";
import type { StrategyRegistryAnalyzePayload } from "@/lib/strategy-registry/strategy-registry-types";
import type { GovernanceAnalyzePayload } from "@/lib/governance/governance-types";
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
  const deskMemory = (raw as AnalyzeRequestBody).deskMemory as
    | DeskMemoryClientPayload
    | undefined;
  const ethQuote = (raw as AnalyzeRequestBody).ethQuote as SpotQuote | undefined;
  const deskRiskProfile = (raw as AnalyzeRequestBody).deskRiskProfile as
    | "balanced"
    | "aggressive"
    | undefined;
  const strategyRegistry = (raw as AnalyzeRequestBody).strategyRegistry as
    | StrategyRegistryAnalyzePayload
    | undefined;
  const governance = (raw as AnalyzeRequestBody).governance as
    | GovernanceAnalyzePayload
    | undefined;
  applyDeskRiskProfile(deskRiskProfile);

  if (hasFullEngineInput(body)) {
    return runDecisionEngineFromInput(
      body,
      body.derivativesOverrides,
      deskMemory,
      ethQuote,
      strategyRegistry,
      governance,
    );
  }

  return runAnalysisEngine({
    ...body,
    deskMemory,
    ethQuote,
    strategyRegistry,
    governance,
  });
}
