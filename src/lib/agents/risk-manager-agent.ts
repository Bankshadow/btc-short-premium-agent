import type { AgentOutput } from "@/lib/types/agent";
import {
  evaluateNoTradeRules,
  isIntendedShortCall,
} from "@/lib/decision/no-trade-rules";
import {
  IV_HV_SKIP_THRESHOLD,
  LIQUIDATION_SKIP,
  SD_SKIP_THRESHOLD,
} from "@/lib/decision/thresholds";
import {
  buildAgentOutput,
  getMissingDataLabels,
  MAX_DAILY_LOSS_PCT,
  MAX_LOSS_PER_TRADE_PCT,
  selectBestOptionCandidate,
  type TradingDeskContext,
} from "./shared";

export function runRiskManagerAgent(ctx: TradingDeskContext): AgentOutput {
  const { market, liquidation, macroEvent } = ctx.input;
  const candidate = selectBestOptionCandidate(ctx.input.optionCandidates);
  const shortPremium =
    isIntendedShortCall(ctx.input.macroView ?? "neutral", candidate);

  const noTradeRules = evaluateNoTradeRules(market, candidate, {
    macroEvent,
    liquidation,
    macroView: ctx.input.macroView,
    technical4h: ctx.input.technical4h,
    consecutiveLosses: ctx.input.consecutiveLosses,
    priorDayRallyPct: ctx.input.priorDayRallyPct,
  });

  const vetoReasons: string[] = [];
  const risks: string[] = [];
  const reasons: string[] = [];

  for (const rule of noTradeRules) {
    if (rule.triggered && rule.severity === "hard") {
      vetoReasons.push(rule.message);
    }
  }

  const missing = getMissingDataLabels(ctx);
  if (missing.length > 0) {
    vetoReasons.push(
      `Required data missing (${missing.join(", ")}) — no trade until complete.`,
    );
  }

  const liq = liquidation.liquidation24h;
  if (liq != null && liq > LIQUIDATION_SKIP) {
    vetoReasons.push(
      `Liquidation 24h $${(liq / 1e6).toFixed(0)}M > $200M — hard SKIP.`,
    );
  }

  if (shortPremium && market.ivHvRatio > 0 && market.ivHvRatio < IV_HV_SKIP_THRESHOLD) {
    vetoReasons.push(
      `IV/HV ${market.ivHvRatio.toFixed(2)} < ${IV_HV_SKIP_THRESHOLD} — SKIP short premium.`,
    );
  }

  if (
    candidate &&
    shortPremium &&
    candidate.sdDistance < SD_SKIP_THRESHOLD
  ) {
    vetoReasons.push(
      `SD distance ${candidate.sdDistance.toFixed(2)} < ${SD_SKIP_THRESHOLD} — options SKIP.`,
    );
  }

  if (macroEvent.hasEventBeforeSettlement) {
    vetoReasons.push("High-impact macro before settlement — reduce risk or SKIP.");
  }

  reasons.push(
    `Max loss per trade cap: ${MAX_LOSS_PER_TRADE_PCT}% of equity.`,
  );
  reasons.push(`Max daily loss cap: ${MAX_DAILY_LOSS_PCT}% of equity.`);
  reasons.push("No auto execution — human approval required.");

  if ((ctx.input.consecutiveLosses ?? 0) >= 2) {
    vetoReasons.push("Two+ consecutive losses — desk pauses new risk.");
  }

  const veto = vetoReasons.length > 0;
  const recommendation: AgentOutput["recommendation"] = veto
    ? "SKIP"
    : ctx.response.step5_verdict.recommendation === "trade"
      ? "TRADE"
      : ctx.response.step5_verdict.recommendation === "skip"
        ? "SKIP"
        : "WAIT";

  if (!veto) {
    reasons.push("No hard risk veto — strategy agents may proceed to committee.");
  }

  return buildAgentOutput({
    agentName: "Risk Manager Agent",
    strategyType: "risk",
    marketView: "neutral",
    recommendation,
    confidence: veto ? 100 : 80,
    reasons,
    risks: [
      ...risks,
      "Veto authority over all strategy agents.",
      "Analysis-only — orders are never sent automatically.",
    ],
    veto,
    vetoReasons: [...new Set(vetoReasons)],
    proposedAction: {
      instrument: "portfolio risk",
      side: "none",
      sizePct: veto ? 0 : Math.min(MAX_LOSS_PER_TRADE_PCT, ctx.response.step6_actionPlan.suggestedSizePct),
      notes: veto
        ? "Risk veto active — committee must SKIP or WAIT."
        : `Size capped at ${MAX_LOSS_PER_TRADE_PCT}% max loss per trade.`,
    },
  });
}
