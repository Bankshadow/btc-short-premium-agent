import type { AgentOutput } from "./types";
import { tradeRecToAgent } from "./types";
import { evaluateDeltaVerdict } from "@/lib/decision/no-trade-rules";
import {
  IV_HV_SKIP_THRESHOLD,
  SD_SKIP_THRESHOLD,
} from "@/lib/decision/thresholds";
import {
  buildAgentOutput,
  getMissingDataLabels,
  selectBestOptionCandidate,
  type TradingDeskContext,
} from "./shared";

export function runOptionsStrategyAgent(ctx: TradingDeskContext): AgentOutput {
  const verdict = ctx.response.step5_verdict;
  const plan = ctx.response.step6_actionPlan;
  const candidate =
    verdict.candidate ?? selectBestOptionCandidate(ctx.input.optionCandidates);
  const missing = getMissingDataLabels(ctx);
  const market = ctx.input.market;
  const macroView = ctx.input.macroView ?? "neutral";
  const reasons: string[] = [];
  const risks: string[] = [...verdict.risks];

  const recommendation = tradeRecToAgent(verdict.recommendation);
  const confidence = verdict.confidence;

  if (candidate) {
    reasons.push(
      `Candidate ${candidate.symbol} Δ${candidate.delta.toFixed(2)} SD ${candidate.sdDistance.toFixed(2)}.`,
    );
    const deltaV = evaluateDeltaVerdict(Math.abs(candidate.delta));
    if (deltaV === "trade_ok") reasons.push("Delta in sweet spot (0.13–0.15).");
    else if (deltaV === "wait") reasons.push("Delta in fallback band.");
    else reasons.push("Delta outside playbook bands.");
  } else {
    reasons.push("No option candidate selected.");
  }

  if (market.ivHvRatio > 0 && market.ivHvRatio < IV_HV_SKIP_THRESHOLD) {
    reasons.push(
      `IV/HV ${market.ivHvRatio.toFixed(2)} < ${IV_HV_SKIP_THRESHOLD} — short premium unfavorable.`,
    );
  }

  if (candidate && candidate.sdDistance < SD_SKIP_THRESHOLD) {
    risks.push(`SD ${candidate.sdDistance.toFixed(2)} < ${SD_SKIP_THRESHOLD} — pin risk.`);
  }

  reasons.push(verdict.summary);
  reasons.push(`Macro ${macroView} — short-call bias when bearish.`);

  const side =
    plan.action === "sell_call" || plan.action === "sell_put" ? "short" : "none";

  return buildAgentOutput(
    {
      agentName: "Options Strategy Agent",
      strategyType: "OPTIONS",
      marketView:
        macroView === "bearish"
          ? "bearish"
          : macroView === "bullish"
            ? "bullish"
            : "neutral",
      recommendation,
      confidence,
      reasons: reasons.slice(0, 6),
      risks,
      proposedAction: {
        instrument: candidate?.symbol ?? "BTC options",
        side,
        sizePct: Math.min(plan.suggestedSizePct, 1),
        notes: plan.entryNotes || "Hypothetical premium — human approval only.",
      },
      missingData: missing,
    },
    ctx,
  );
}
