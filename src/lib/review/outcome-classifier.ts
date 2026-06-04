import type { AgentRecommendation } from "@/lib/agents/types";
import type { DecisionLogEntry, PaperResolution } from "@/lib/journal/decision-log-types";

export type OutcomeClassification =
  | "CORRECT_TRADE"
  | "FALSE_TRADE"
  | "CORRECT_SKIP"
  | "FALSE_SKIP"
  | "CORRECT_WAIT"
  | "MISSED_OPPORTUNITY"
  | "RISK_VETO_SAVED_LOSS"
  | "RISK_VETO_TOO_CONSERVATIVE";

export function classifyResolvedOutcome(
  entry: DecisionLogEntry,
  resolution: PaperResolution,
): OutcomeClassification {
  const { finalVerdict, riskVeto } = entry;
  const win = resolution.tradeWouldWin;

  if (riskVeto) {
    if (win === false || finalVerdict === "SKIP") {
      return "RISK_VETO_SAVED_LOSS";
    }
    if (win === true) {
      return "RISK_VETO_TOO_CONSERVATIVE";
    }
  }

  if (finalVerdict === "TRADE") {
    if (win === true) return "CORRECT_TRADE";
    if (win === false) return "FALSE_TRADE";
    return entry.paperPnl != null && entry.paperPnl < 0
      ? "FALSE_TRADE"
      : "CORRECT_TRADE";
  }

  if (finalVerdict === "SKIP") {
    if (win === false) return "CORRECT_SKIP";
    if (win === true) return "FALSE_SKIP";
    return "CORRECT_SKIP";
  }

  if (finalVerdict === "WAIT") {
    if (win === true) return "MISSED_OPPORTUNITY";
    if (win === false) return "CORRECT_WAIT";
    return "CORRECT_WAIT";
  }

  return "CORRECT_WAIT";
}

export function lessonTagsForClassification(
  c: OutcomeClassification,
): string[] {
  const map: Record<OutcomeClassification, string[]> = {
    CORRECT_TRADE: ["execution-aligned", "committee-validated"],
    FALSE_TRADE: ["false-trade", "review-agents", "pre-mortem-gap"],
    CORRECT_SKIP: ["discipline", "risk-avoidance"],
    FALSE_SKIP: ["missed-edge", "calibration"],
    CORRECT_WAIT: ["patience", "incomplete-tape"],
    MISSED_OPPORTUNITY: ["missed-edge", "wait-too-long"],
    RISK_VETO_SAVED_LOSS: ["risk-veto-win", "governance"],
    RISK_VETO_TOO_CONSERVATIVE: ["risk-veto-miss", "calibration"],
  };
  return map[c];
}

export function needsLossAutopsy(c: OutcomeClassification): boolean {
  return c === "FALSE_TRADE";
}

export function classificationImpliesLoss(
  c: OutcomeClassification,
  entry: DecisionLogEntry,
): boolean {
  if (c === "FALSE_TRADE") return true;
  if (entry.paperPnl != null && entry.paperPnl < 0 && entry.finalVerdict === "TRADE") {
    return true;
  }
  return false;
}
