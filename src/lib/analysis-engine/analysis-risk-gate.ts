import { blockBinanceProductionOrder } from "@/lib/exchange/binance/binance-config";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { AnalysisContext } from "./analysis-state";
import type { AnalysisFinalVerdict } from "./analysis-result";

export interface AnalysisRiskGateResult {
  riskStatus: "SAFE" | "CAUTION" | "BLOCKED";
  blockers: string[];
  reasons: string[];
  executionReady: boolean;
  humanActionRequired: boolean;
  nextAction: string;
}

export function runAnalysisRiskGate(input: {
  context: AnalysisContext;
  analysis: AnalyzeApiResponse;
  finalVerdict: AnalysisFinalVerdict;
}): AnalysisRiskGateResult {
  const blockers: string[] = [];
  const reasons: string[] = [];

  if (input.context.killSwitch.active) {
    blockers.push(input.context.killSwitch.reason ?? "Kill switch active");
  }

  for (const limit of input.context.riskPolicy.triggeredLimits) {
    if (!blockers.includes(limit)) blockers.push(limit);
  }

  if (input.context.governance?.pauseAnalysis) {
    blockers.push("Governance paused analysis");
  }

  if (input.context.governance?.safeMode) {
    blockers.push("Governance safe mode active");
  }

  const hardRules = input.context.governance?.hardRules;
  if (hardRules?.locked) {
    for (const msg of hardRules.messages) {
      blockers.push(msg);
    }
  }

  if (input.context.incidentState.criticalOpen) {
    blockers.push(
      input.context.incidentState.topTitle
        ? `Critical incident: ${input.context.incidentState.topTitle}`
        : "Critical incident open",
    );
  }

  if (input.context.consistency?.blocksNewTrades) {
    blockers.push(
      input.context.consistency.topIssue ??
        "Engine consistency blocked — position state uncertain.",
    );
  }

  const liveBlock = blockBinanceProductionOrder();
  if (liveBlock) {
    blockers.push(liveBlock);
  }

  if (input.context.testnetStatus.autoExecuteEnabled) {
    reasons.push("Testnet auto-execute is disabled by policy — double confirm required.");
  }

  const committeeReason =
    input.analysis.tradingDesk?.weightedCommittee?.explanation ??
    input.analysis.step5_verdict?.summary ??
    input.analysis.step5_verdict?.recommendation;
  if (committeeReason) {
    reasons.push(String(committeeReason));
  }

  const registryBlocked = input.context.strategyRegistry?.strategies?.some(
    (s) => s.status === "DISABLED" || s.status === "DEPRECATED",
  );
  if (registryBlocked) {
    reasons.push("One or more strategy registry entries are disabled.");
  }

  let riskStatus: AnalysisRiskGateResult["riskStatus"] = "SAFE";
  if (blockers.length > 0) {
    riskStatus = "BLOCKED";
  } else if (
    input.context.riskPolicy.blockNewTrades ||
    input.context.incidentState.openCount > 0
  ) {
    riskStatus = "CAUTION";
  }

  const executionReady =
    blockers.length === 0 &&
    input.finalVerdict === "TRADE" &&
    input.context.testnetStatus.connected &&
    !input.context.testnetStatus.autoExecuteEnabled;

  const humanActionRequired =
    input.finalVerdict === "TRADE" ||
    blockers.length > 0 ||
    input.context.learningRecords.some(
      (r) => r.status === "PENDING_REVIEW" || r.status === "REFLECTION_READY",
    );

  let nextAction = "Monitor market and wait for next cycle.";
  if (blockers.length > 0) {
    nextAction = `Resolve blocker: ${blockers[0]}`;
  } else if (input.finalVerdict === "TRADE") {
    nextAction = executionReady
      ? "Review testnet preview and double-confirm execution on Dashboard."
      : "TRADE verdict — connect testnet or resolve readiness blockers.";
  } else if (input.finalVerdict === "WAIT") {
    nextAction = "Wait for clearer setup — no trade candidate.";
  }

  return {
    riskStatus,
    blockers,
    reasons,
    executionReady,
    humanActionRequired,
    nextAction,
  };
}
