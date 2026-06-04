import type { AgentRecommendation } from "@/lib/agents/types";
import type { DecisionLogEntry, PaperResolution } from "./decision-log-types";

/**
 * Hypothetical paper PnL in % of notional (analysis-only, not real fills).
 */
export function computePaperPnl(
  entry: Pick<DecisionLogEntry, "btcPrice" | "finalVerdict" | "riskVeto">,
  resolution: PaperResolution,
): number {
  if (entry.btcPrice <= 0 || resolution.btcPriceAfter <= 0) return 0;

  const movePct =
    ((resolution.btcPriceAfter - entry.btcPrice) / entry.btcPrice) * 100;

  if (entry.finalVerdict === "SKIP" || entry.finalVerdict === "WAIT") {
    if (resolution.tradeWouldWin === false) return 0.35;
    if (resolution.tradeWouldWin === true) return -0.35;
    if (entry.riskVeto) return 0.2;
    return 0;
  }

  if (entry.finalVerdict === "TRADE") {
    if (resolution.tradeWouldWin === true) {
      return Number(Math.min(2.5, 0.5 + Math.abs(movePct) * 0.15).toFixed(2));
    }
    if (resolution.tradeWouldWin === false) {
      return Number(-Math.min(2.5, 0.5 + Math.abs(movePct) * 0.15).toFixed(2));
    }
  }

  return 0;
}

export function labelPaperOutcome(
  verdict: AgentRecommendation,
  tradeWouldWin: boolean | null,
): string {
  if (tradeWouldWin === null) return "N/A";
  if (verdict === "TRADE") return tradeWouldWin ? "Win" : "Loss";
  return tradeWouldWin ? "Missed opportunity" : "Good skip";
}
