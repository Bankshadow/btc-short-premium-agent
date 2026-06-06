import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { TestnetDecisionLinkage } from "./types";

export function buildDecisionLinkage(
  decisionLogId: string | null,
  entry: DecisionLogEntry | null | undefined,
): TestnetDecisionLinkage {
  if (!decisionLogId) {
    return {
      decisionLogId: null,
      finalVerdict: null,
      committeeVerdict: null,
      confidence: null,
      topReasons: [],
      riskVeto: false,
      linked: false,
      message:
        "This trade was not linked to an AI decision. It can be monitored but cannot fully contribute to agent learning.",
    };
  }
  if (!entry) {
    return {
      decisionLogId,
      finalVerdict: null,
      committeeVerdict: null,
      confidence: null,
      topReasons: [],
      riskVeto: false,
      linked: false,
      message: `Decision log ${decisionLogId.slice(0, 8)}… not found in local journal.`,
    };
  }
  return {
    decisionLogId,
    finalVerdict: entry.finalVerdict,
    committeeVerdict: entry.finalVerdict,
    confidence: entry.paperPnl ?? null,
    topReasons: entry.topReasons?.slice(0, 5) ?? [],
    riskVeto: entry.riskVeto,
    linked: true,
    message: null,
  };
}

export function mapBinanceSource(
  source: string,
): "AI_SIGNAL" | "MANUAL_TEST" | "AUTOPILOT" {
  if (source === "ai_signal") return "AI_SIGNAL";
  if (source === "autopilot") return "AUTOPILOT";
  return "MANUAL_TEST";
}
