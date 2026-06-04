import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { AgentOutput, TradingDeskOutput } from "@/lib/agents/types";
import { tradeRecToAgent } from "@/lib/agents/types";
import { buildDataProvenance } from "./data-provenance";
import { computeDataConfidence } from "./data-confidence";
import { detectStrategyConflicts } from "@/lib/conflict/strategy-conflict-detector";
import {
  alignPlaybookVerdictWithGate,
  applyConflictGate,
  injectRiskManagerReliability,
} from "@/lib/conflict/conflict-gate";
import type { DataTrustPipelineResult } from "./types";
import type { SpotQuote } from "@/lib/types/market";
import type { DeskMemoryClientPayload } from "@/lib/memory/types";
import type { DecisionEngineInput } from "@/lib/types/market";

export function isProductionRuntime(): boolean {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  );
}

function agentByStrategy(
  desk: TradingDeskOutput,
  strategyType: AgentOutput["strategyType"],
): AgentOutput {
  return (
    desk.agents.find((a) => a.strategyType === strategyType) ?? desk.riskManager
  );
}

export function runDataTrustPipeline(input: {
  engineInput: DecisionEngineInput;
  response: AnalyzeApiResponse;
  desk: TradingDeskOutput;
  ethQuote?: SpotQuote | null;
  deskMemoryPayload?: DeskMemoryClientPayload;
}): DataTrustPipelineResult {
  const analyzedAt =
    input.response.step5_verdict.analyzedAt ?? new Date().toISOString();

  const dataProvenance = buildDataProvenance({
    input: input.engineInput,
    response: input.response,
    ethQuote: input.ethQuote,
    deskMemoryPayload: input.deskMemoryPayload,
    analyzedAt,
    isProduction: isProductionRuntime(),
  });

  const dataTrust = computeDataConfidence(dataProvenance);

  const conflictAnalysis = detectStrategyConflicts({
    spot: agentByStrategy(input.desk, "SPOT"),
    futures: agentByStrategy(input.desk, "FUTURES"),
    options: agentByStrategy(input.desk, "OPTIONS"),
    bull: input.desk.bullThesis,
    bear: input.desk.bearThesis,
    riskManager: input.desk.riskManager,
    committeeRecommendation: input.desk.committee.finalVerdict,
    dataTrust,
    playbookRecommendation: tradeRecToAgent(input.response.step5_verdict.recommendation),
  });

  const { conflictGate } = applyConflictGate({
    committee: input.desk.committee,
    riskManager: input.desk.riskManager,
    dataTrust,
    conflict: conflictAnalysis,
  });

  return {
    dataTrust,
    dataProvenance,
    conflictAnalysis,
    conflictGate,
  };
}

export function applyReliabilityLayerToAnalyzeResponse(
  engineInput: DecisionEngineInput,
  response: AnalyzeApiResponse,
  ethQuote?: SpotQuote | null,
  deskMemoryPayload?: DeskMemoryClientPayload,
): AnalyzeApiResponse {
  if (!response.tradingDesk) return response;

  const pipeline = runDataTrustPipeline({
    engineInput,
    response,
    desk: response.tradingDesk,
    ethQuote,
    deskMemoryPayload,
  });

  const { committee, conflictGate } = applyConflictGate({
    committee: response.tradingDesk.committee,
    riskManager: response.tradingDesk.riskManager,
    dataTrust: pipeline.dataTrust,
    conflict: pipeline.conflictAnalysis,
  });

  const riskManager = injectRiskManagerReliability(
    response.tradingDesk.riskManager,
    pipeline.dataTrust,
    pipeline.conflictAnalysis,
    conflictGate,
  );

  const { verdict, actionPlan } = alignPlaybookVerdictWithGate(
    response.step5_verdict,
    response.step6_actionPlan,
    committee.finalVerdict,
    conflictGate.tradeBlocked,
  );

  const tradingDesk: TradingDeskOutput = {
    ...response.tradingDesk,
    committee,
    riskManager,
  };

  return {
    ...response,
    step5_verdict: verdict,
    step6_actionPlan: actionPlan,
    verdict,
    actionPlan,
    tradingDesk,
    dataTrust: pipeline.dataTrust,
    dataProvenance: pipeline.dataProvenance,
    conflictAnalysis: pipeline.conflictAnalysis,
    conflictGate,
    committeeVerdict: committee,
    finalVerdict: committee.finalVerdict,
  };
}
