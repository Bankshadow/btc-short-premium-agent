import { applyDeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import { runAnalysisEngine, runDecisionEngineFromInput } from "./analyze";
import { normalizeAnalyzeRequest } from "./analyze-request";
import type { DeskMemoryClientPayload } from "@/lib/memory/types";
import type { SpotQuote } from "@/lib/types/market";
import type { StrategyRegistryAnalyzePayload } from "@/lib/strategy-registry/strategy-registry-types";
import type { GovernanceAnalyzePayload } from "@/lib/governance/governance-types";
import type { AdaptiveWeightingAnalyzePayload } from "@/lib/adaptive-agent-weighting/types";
import type {
  AnalysisInput,
  AnalyzeApiResponse,
  DecisionEngineInput,
} from "@/lib/types/market";
import { resolveApprovedStrategySignals } from "@/lib/strategy-signals/resolve-approved-signals";
import type { AdvisoryStrategySignal } from "@/lib/strategy-signals/types";
import { runForwardShadowCycle } from "@/lib/strategy-shadow/run-shadow-cycle";
import type { SecondBrainCycleSnapshot } from "@/lib/second-brain/types";

type AnalyzeRequestBody = Partial<DecisionEngineInput> &
  AnalysisInput &
  Record<string, unknown> & {
    secondBrain?: SecondBrainCycleSnapshot;
    secondBrainBullets?: string[];
  };

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
  const requestBody = raw as AnalyzeRequestBody;
  const body = normalizeAnalyzeRequest(requestBody);
  const deskMemoryRaw = requestBody.deskMemory as DeskMemoryClientPayload | undefined;
  const secondBrain = requestBody.secondBrain;
  const secondBrainBullets = requestBody.secondBrainBullets;
  const deskMemory: DeskMemoryClientPayload | undefined = deskMemoryRaw
    ? {
        ...deskMemoryRaw,
        secondBrainBullets:
          secondBrainBullets ?? deskMemoryRaw.secondBrainBullets,
      }
    : secondBrainBullets?.length
      ? { secondBrainBullets }
      : undefined;
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
  const adaptiveWeighting = (raw as AnalyzeRequestBody).adaptiveWeighting as
    | AdaptiveWeightingAnalyzePayload
    | undefined;
  applyDeskRiskProfile(deskRiskProfile);

  const clientSignals = (raw as AnalyzeRequestBody).advisoryStrategySignals as
    | AdvisoryStrategySignal[]
    | undefined;
  const advisoryStrategySignals =
    clientSignals ??
    (await resolveApprovedStrategySignals().catch(() => [] as AdvisoryStrategySignal[]));

  const response = hasFullEngineInput(body)
    ? runDecisionEngineFromInput(
        body,
        body.derivativesOverrides,
        deskMemory,
        ethQuote,
        strategyRegistry,
        governance,
        adaptiveWeighting,
        advisoryStrategySignals,
        secondBrain,
      )
    : await runAnalysisEngine({
        ...body,
        deskMemory,
        ethQuote,
        strategyRegistry,
        governance,
        adaptiveWeighting,
        advisoryStrategySignals,
        secondBrain,
      } as Parameters<typeof runAnalysisEngine>[0]);

  const spotPrice = response.step1_marketSnapshot?.spotPrice ?? 0;
  if (spotPrice > 0 && advisoryStrategySignals.length > 0) {
    void runForwardShadowCycle({
      signals: advisoryStrategySignals,
      spotPrice,
      committeeVerdict: response.tradingDesk?.committee?.finalVerdict,
    }).catch(() => undefined);
  }

  return response;
}
