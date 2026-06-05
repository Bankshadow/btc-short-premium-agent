import type { AgentOutput } from "./types";
import { tradeRecToAgent } from "./types";
import { evaluateDeltaVerdict } from "@/lib/decision/no-trade-rules";
import {
  IV_HV_SKIP_THRESHOLD,
  SD_SKIP_THRESHOLD,
} from "@/lib/decision/thresholds";
import { isAggressiveDeskRisk } from "@/lib/desk/desk-risk-policy";
import {
  buildAgentOutput,
  formatProposedAction,
  getMissingDataLabels,
  selectBestOptionCandidate,
  toConfidenceLevel,
  withDeskMemoryReasons,
  type TradingDeskContext,
} from "./shared";

export function runOptionsStrategyAgent(ctx: TradingDeskContext): AgentOutput {
  const verdict = ctx.response.step5_verdict;
  const plan = ctx.response.step6_actionPlan;
  const candidate =
    verdict.candidate ?? selectBestOptionCandidate(ctx.input.optionCandidates);
  const missing = getMissingDataLabels(ctx);
  const market = ctx.input.market;
  const reasons: string[] = [];
  const risks: string[] = [...verdict.risks];

  let recommendation = tradeRecToAgent(verdict.recommendation);
  if (
    isAggressiveDeskRisk() &&
    recommendation === "WAIT" &&
    verdict.confidence >= 52 &&
    candidate &&
    evaluateDeltaVerdict(Math.abs(candidate.delta)) !== "skip"
  ) {
    recommendation = "TRADE";
    reasons.push("Aggressive desk: delta acceptable — options desk approves TRADE.");
  }
  const confidence = toConfidenceLevel(verdict.confidence, recommendation);

  if (candidate) {
    reasons.push(
      `${candidate.symbol} Δ${candidate.delta.toFixed(2)} SD${candidate.sdDistance.toFixed(2)}.`,
    );
    const dv = evaluateDeltaVerdict(Math.abs(candidate.delta));
    if (dv === "trade_ok") reasons.push("Delta sweet spot.");
    else if (dv === "skip") risks.push("Delta outside bands.");
  }

  if (market.ivHvRatio > 0 && market.ivHvRatio < IV_HV_SKIP_THRESHOLD) {
    reasons.push(`IV/HV ${market.ivHvRatio.toFixed(2)} < ${IV_HV_SKIP_THRESHOLD}.`);
  }
  if (ctx.regimeBrain) {
    reasons.push(
      `Regime context: ${ctx.regimeBrain.primaryRegime} · sizing ×${ctx.regimeBrain.sizingMultiplier}`,
    );
    if (ctx.regimeBrain.blockedStrategies.includes("options_short_premium")) {
      risks.push("Regime Brain blocks options short premium in current tape.");
    }
  }
  reasons.push(verdict.summary);

  const action =
    plan.action === "sell_call" || plan.action === "sell_put"
      ? "sell premium"
      : "no trade";

  return buildAgentOutput(
    {
      agentName: "Options Strategy Agent",
      strategyType: "OPTIONS",
      marketView: `Options · ${ctx.input.macroView ?? "neutral"} playbook`,
      recommendation,
      confidence,
      reasons: withDeskMemoryReasons(ctx, reasons.slice(0, 6), "Options Strategy Agent"),
      risks,
      proposedAction: formatProposedAction({
        instrument: candidate?.symbol ?? "BTC options",
        sizePct: Math.min(plan.suggestedSizePct, 1),
        notes: `${action} — ${plan.entryNotes || "human approval only"}`,
      }),
      missingData: missing,
    },
    ctx,
  );
}
