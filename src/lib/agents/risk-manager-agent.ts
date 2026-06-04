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
  formatProposedAction,
  getMissingDataLabels,
  MAX_CONSECUTIVE_LOSSES_SKIP,
  MAX_DAILY_LOSS_PCT,
  selectBestOptionCandidate,
  type TradingDeskContext,
} from "./shared";

export function runRiskManagerAgent(
  ctx: TradingDeskContext,
  bull: AgentOutput,
  bear: AgentOutput,
): AgentOutput {
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
  const reasons: string[] = [];
  const risks: string[] = [];

  for (const rule of noTradeRules) {
    if (rule.triggered && rule.severity === "hard") {
      vetoReasons.push(rule.message);
    }
  }

  if (missing.length > 0) {
    vetoReasons.push(
      `Missing critical data (${missing.join(", ")}) — no TRADE.`,
    );
  }

  const liq = liquidation.liquidation24h;
  if (liq != null && liq > LIQUIDATION_SKIP) {
    vetoReasons.push(`Liquidation > $200M — SKIP.`);
  }

  if (shortPremium && market.ivHvRatio > 0 && market.ivHvRatio < IV_HV_SKIP_THRESHOLD) {
    vetoReasons.push(`IV/HV < ${IV_HV_SKIP_THRESHOLD} — SKIP short premium.`);
  }

  if (candidate && shortPremium && candidate.sdDistance < SD_SKIP_THRESHOLD) {
    vetoReasons.push(`SD distance < ${SD_SKIP_THRESHOLD} — SKIP options.`);
  }

  if (macroEvent.hasEventBeforeSettlement) {
    vetoReasons.push("High-impact macro event — SKIP.");
  }

  const consecutive = ctx.input.consecutiveLosses ?? 0;
  if (consecutive >= MAX_CONSECUTIVE_LOSSES_SKIP) {
    vetoReasons.push(
      `${consecutive} consecutive losses — SKIP (desk pause).`,
    );
  }

  if (ctx.dailyLossLimitHit) {
    vetoReasons.push(
      `Max daily loss policy (~${MAX_DAILY_LOSS_PCT}%) — SKIP new risk.`,
    );
  }

  reasons.push("No martingale — never increase size after losses.");
  reasons.push("No futures average down — Risk Manager blocks DCA perps.");
  reasons.push("No auto execution.");

  if (bull.recommendation === "TRADE" && bear.recommendation === "SKIP") {
    reasons.push(
      `Challenges bull thesis: ${bear.reasons[0] ?? "bear case dominant"}.`,
    );
  }
  if (bear.recommendation === "SKIP" && bull.recommendation === "TRADE") {
    reasons.push("Bear thesis overrides bull — veto bias toward SKIP/WAIT.");
  }

  const veto = vetoReasons.length > 0;
  const recommendation: AgentOutput["recommendation"] = veto ? "SKIP" : "WAIT";

  return buildAgentOutput(
    {
      agentName: "Risk Manager Agent",
      strategyType: "RISK",
      marketView: "Risk overlay — challenges bull & bear",
      recommendation: veto ? "SKIP" : recommendation,
      confidence: veto ? 95 : 70,
      reasons,
      risks: [
        ...risks,
        "Binding veto authority over committee.",
      ],
      veto,
      vetoReasons: [...new Set(vetoReasons)],
      proposedAction: formatProposedAction({
        instrument: "Risk gate",
        notes: veto
          ? "Veto active — committee cannot approve TRADE."
          : "Risk pass — committee may deliberate.",
      }),
      missingData: missing,
    },
    ctx,
  );
}
