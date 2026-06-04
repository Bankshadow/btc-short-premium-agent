import { STRATEGY_LABELS } from "@/lib/validation/validation-config";
import type { CouncilSessionContext } from "./council-context";
import type { CouncilAgentDebateRow } from "./types";

export interface PerformanceAnalystInsight {
  bestStrategy: string;
  worstStrategy: string;
  falsePositiveNote: string;
  falseNegativeNote: string;
  vetoNote: string;
  debate: CouncilAgentDebateRow;
}

export function runPerformanceAnalystAgent(
  ctx: CouncilSessionContext,
): PerformanceAnalystInsight {
  const matrix = ctx.validation.strategyMatrix;
  const sorted = [...matrix].sort((a, b) => b.averageR - a.averageR);
  const best = sorted.find((s) => s.resolvedSignals >= 3) ?? sorted[0];
  const worst = [...sorted].reverse().find((s) => s.resolvedSignals >= 2) ?? sorted[sorted.length - 1];

  const fpTotal = matrix.reduce((s, r) => s + r.falsePositives, 0);
  const fnTotal = matrix.reduce((s, r) => s + r.falseNegatives, 0);
  const correctSkips = matrix.reduce((s, r) => s + r.correctSkips, 0);

  const vetoAccuracy = ctx.scoreboard.riskVetoAccuracyPct;
  const vetoCount = ctx.scoreboard.riskVetoCount;

  const regimeBest = [...ctx.validation.regimePerformance].sort(
    (a, b) => b.netPnlPct - a.netPnlPct,
  )[0];

  const debate: CouncilAgentDebateRow = {
    agentName: "Performance Analyst Agent",
    role: "Journal, paper book, scoreboard, regimes",
    stance: best && best.averageR > 0 ? "support" : "neutral",
    statements: [
      `Best edge candidate: ${best?.label ?? "—"} (avg R ${best?.averageR ?? 0}, win ${best?.winRate ?? 0}%).`,
      `Weakest: ${worst?.label ?? "—"} (avg R ${worst?.averageR ?? 0}, DD ${worst?.maxDrawdownPct ?? 0}%).`,
      `False positives across strategies: ${fpTotal}; false negatives: ${fnTotal}; correct skips: ${correctSkips}.`,
      regimeBest
        ? `Strongest regime tape: ${regimeBest.label} (net ${regimeBest.netPnlPct}%).`
        : "Regime sample thin — gather more resolved sessions per regime.",
      vetoCount > 0
        ? `Risk vetoes: ${vetoCount} sessions, accuracy ${vetoAccuracy}% — ${vetoAccuracy >= 50 ? "useful protection" : "review veto calibration"}.`
        : "Few risk vetoes logged — ensure Risk Manager outputs are captured.",
      `Resolved sessions: ${ctx.scoreboard.totalResolved} · Net log PnL ${ctx.scoreboard.netPaperPnlPct}%.`,
    ],
  };

  return {
    bestStrategy: best?.label ?? "Insufficient data",
    worstStrategy: worst?.label ?? "Insufficient data",
    falsePositiveNote: `${fpTotal} false-positive TRADE signals — tighten entry filters or size.`,
    falseNegativeNote: `${fnTotal} false negatives — consider WATCHLIST promotion after paper proof.`,
    vetoNote:
      vetoCount > 0
        ? `Veto accuracy ${vetoAccuracy}% over ${vetoCount} vetoed sessions.`
        : "Insufficient veto history.",
    debate,
  };
}
