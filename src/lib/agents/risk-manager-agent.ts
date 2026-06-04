import type { AgentOutput } from "./types";
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
  MAX_RISK_PER_TRADE_PCT,
  MAX_WEEKLY_LOSS_PCT,
  selectBestOptionCandidate,
  type TradingDeskContext,
} from "./shared";

export function runRiskManagerAgent(ctx: TradingDeskContext): AgentOutput {
  const { market, liquidation, macroEvent } = ctx.input;
  const candidate = selectBestOptionCandidate(ctx.input.optionCandidates);
  const shortPremium =
    isIntendedShortCall(ctx.input.macroView ?? "neutral", candidate);
  const missing = getMissingDataLabels(ctx);

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

  if (missing.length > 0) {
    vetoReasons.push(
      `Missing critical data (${missing.join(", ")}) — no TRADE allowed.`,
    );
  }

  const liq = liquidation.liquidation24h;
  if (liq != null && liq > LIQUIDATION_SKIP) {
    vetoReasons.push(
      `Liquidation 24h $${(liq / 1e6).toFixed(0)}M > $200M — SKIP.`,
    );
  }

  if (shortPremium && market.ivHvRatio > 0 && market.ivHvRatio < IV_HV_SKIP_THRESHOLD) {
    vetoReasons.push(
      `IV/HV ${market.ivHvRatio.toFixed(2)} < ${IV_HV_SKIP_THRESHOLD} — SKIP short premium.`,
    );
  }

  if (candidate && shortPremium && candidate.sdDistance < SD_SKIP_THRESHOLD) {
    vetoReasons.push(
      `SD ${candidate.sdDistance.toFixed(2)} < ${SD_SKIP_THRESHOLD} — options SKIP.`,
    );
  }

  if (macroEvent.hasEventBeforeSettlement) {
    vetoReasons.push("High-impact macro before settlement — SKIP or cut risk.");
  }

  const consecutive = ctx.input.consecutiveLosses ?? 0;
  if (consecutive >= 1) {
    reasons.push(
      "No martingale — do not increase size after a loss; flat or smaller only.",
    );
    if (consecutive >= 2) {
      vetoReasons.push(
        `${consecutive} consecutive losses — desk pauses new risk (martingale / weekly guard).`,
      );
    }
  }

  reasons.push(`Max risk per trade: ${MAX_RISK_PER_TRADE_PCT}% equity.`);
  reasons.push(`Max daily loss: ${MAX_DAILY_LOSS_PCT}% equity.`);
  reasons.push(`Max weekly loss policy: ${MAX_WEEKLY_LOSS_PCT}% equity.`);
  reasons.push("No auto execution — human approval required.");

  const veto = vetoReasons.length > 0;
  const recommendation: AgentOutput["recommendation"] = veto
    ? "SKIP"
    : ctx.response.step5_verdict.recommendation === "trade"
      ? "TRADE"
      : ctx.response.step5_verdict.recommendation === "skip"
        ? "SKIP"
        : "WAIT";

  if (!veto) {
    reasons.push("No hard veto — committee may consider TRADE with caps.");
  }

  return buildAgentOutput(
    {
      agentName: "Risk Manager Agent",
      strategyType: "RISK",
      marketView: "neutral",
      recommendation,
      confidence: veto ? 100 : 82,
      reasons,
      risks: [
        ...risks,
        "Binding veto over all strategy agents.",
        "Analysis-only — never routes orders.",
      ],
      veto,
      vetoReasons: [...new Set(vetoReasons)],
      proposedAction: {
        instrument: "portfolio risk",
        side: "none",
        sizePct: veto
          ? 0
          : Math.min(
              MAX_RISK_PER_TRADE_PCT,
              ctx.response.step6_actionPlan.suggestedSizePct,
            ),
        notes: veto
          ? "Risk veto — committee must not approve live TRADE."
          : `Cap size at ${MAX_RISK_PER_TRADE_PCT}% risk per trade.`,
      },
      missingData: missing,
    },
    ctx,
  );
}
