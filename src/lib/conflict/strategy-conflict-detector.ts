import type { AgentOutput } from "@/lib/agents/types";
import type { DataConfidenceResult } from "@/lib/data-trust/types";
import { computeAgentDisagreementScore } from "./agent-disagreement-score";
import type {
  ConflictLevel,
  ConflictSuggestedAction,
  StrategyConflictAnalysis,
} from "@/lib/data-trust/types";

export interface StrategyConflictInput {
  spot: AgentOutput;
  futures: AgentOutput;
  options: AgentOutput;
  bull: AgentOutput;
  bear: AgentOutput;
  riskManager: AgentOutput;
  committeeRecommendation: AgentOutput["recommendation"];
  dataTrust: DataConfidenceResult;
  playbookRecommendation: AgentOutput["recommendation"];
}

function levelFromScore(score: number): ConflictLevel {
  if (score >= 75) return "CRITICAL";
  if (score >= 55) return "HIGH";
  if (score >= 32) return "MEDIUM";
  return "LOW";
}

function suggestedFromLevel(level: ConflictLevel): ConflictSuggestedAction {
  if (level === "CRITICAL") return "SKIP";
  if (level === "HIGH") return "WAIT";
  if (level === "MEDIUM") return "REDUCE_SIZE";
  return "ALLOW";
}

function isBullish(rec: AgentOutput["recommendation"]): boolean {
  return rec === "TRADE";
}

function isBearish(rec: AgentOutput["recommendation"]): boolean {
  return rec === "SKIP";
}

export function detectStrategyConflicts(
  input: StrategyConflictInput,
): StrategyConflictAnalysis {
  const conflicts: string[] = [];
  let conflictScore = computeAgentDisagreementScore([
    input.spot,
    input.futures,
    input.options,
    input.bull,
    input.bear,
    input.riskManager,
  ]);

  if (isBullish(input.spot.recommendation) && isBearish(input.futures.recommendation)) {
    conflicts.push("Directional conflict: Spot bullish vs Futures bearish.");
    conflictScore = Math.min(100, conflictScore + 22);
  }
  if (isBearish(input.spot.recommendation) && isBullish(input.futures.recommendation)) {
    conflicts.push("Directional conflict: Spot bearish vs Futures bullish.");
    conflictScore = Math.min(100, conflictScore + 22);
  }

  if (
    input.options.recommendation === "TRADE" &&
    input.bull.recommendation === "TRADE" &&
    input.bull.confidence === "HIGH" &&
    input.options.proposedAction.toLowerCase().includes("call") &&
    input.bear.recommendation === "SKIP"
  ) {
    conflicts.push(
      "Product conflict: Options short call vs strongly bullish bull thesis with bear blocking.",
    );
    conflictScore = Math.min(100, conflictScore + 18);
  }

  if (
    input.committeeRecommendation === "TRADE" &&
    (input.riskManager.veto || input.riskManager.recommendation === "SKIP")
  ) {
    conflicts.push("Risk conflict: Committee leans TRADE but Risk Manager vetoes or SKIP.");
    conflictScore = Math.min(100, conflictScore + 28);
  }

  if (
    [input.spot, input.futures, input.options].some((a) => a.missingData.length > 0) &&
    [input.spot, input.futures, input.options].some((a) => a.recommendation === "TRADE")
  ) {
    conflicts.push(
      "Data conflict: Strategy TRADE while agents report missing/stale inputs.",
    );
    conflictScore = Math.min(100, conflictScore + 20);
  }

  if (!input.dataTrust.tradeAllowed || input.dataTrust.grade === "CRITICAL") {
    conflicts.push("Data trust conflict: critical or missing tape blocks confident TRADE.");
    conflictScore = Math.min(100, conflictScore + 25);
  }

  const highTrade = [
    input.spot,
    input.futures,
    input.options,
    input.bull,
    input.bear,
  ].filter((a) => a.recommendation === "TRADE" && a.confidence === "HIGH");
  const highSkip = [
    input.spot,
    input.futures,
    input.options,
    input.riskManager,
  ].filter((a) => a.recommendation === "SKIP" && a.confidence === "HIGH");

  if (highTrade.length > 0 && highSkip.length > 0) {
    conflicts.push(
      "Confidence conflict: HIGH-confidence TRADE and HIGH-confidence SKIP across agents.",
    );
    conflictScore = Math.min(100, conflictScore + 16);
  }

  if (
    input.playbookRecommendation === "TRADE" &&
    input.riskManager.recommendation === "SKIP" &&
    input.committeeRecommendation === "TRADE"
  ) {
    conflicts.push("Playbook TRADE vs Risk Manager SKIP with committee still TRADE.");
    conflictScore = Math.min(100, conflictScore + 14);
  }

  const conflictLevel = levelFromScore(conflictScore);
  return {
    conflictScore,
    conflictLevel,
    conflicts: [...new Set(conflicts)],
    suggestedAction: suggestedFromLevel(conflictLevel),
  };
}
