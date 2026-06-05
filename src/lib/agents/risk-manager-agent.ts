import type { AgentOutput } from "./types";
import {
  evaluateNoTradeRules,
  isIntendedShortCall,
} from "@/lib/decision/no-trade-rules";
import {
  LIQUIDATION_SKIP,
} from "@/lib/decision/thresholds";
import {
  isAggressiveDeskRisk,
  riskConsecutiveLossVeto,
  riskIvHvFloor,
  riskMissingFieldVetoCount,
  riskSdFloor,
} from "@/lib/desk/desk-risk-policy";
import { tradeRecToAgent } from "./types";
import {
  buildAgentOutput,
  formatProposedAction,
  getMissingDataLabels,
  MAX_DAILY_LOSS_PCT,
  selectBestOptionCandidate,
  withDeskMemoryReasons,
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

  if (missing.length >= riskMissingFieldVetoCount()) {
    vetoReasons.push(
      `Missing critical data (${missing.join(", ")}) — no TRADE.`,
    );
  } else if (missing.length > 0) {
    reasons.push(
      `Partial tape (${missing.join(", ")}) — size down, desk may still TRADE.`,
    );
  }

  const liq = liquidation.liquidation24h;
  if (liq != null && liq > LIQUIDATION_SKIP) {
    vetoReasons.push(`Liquidation > $200M — SKIP.`);
  }

  const ivFloor = riskIvHvFloor();
  if (shortPremium && market.ivHvRatio > 0 && market.ivHvRatio < ivFloor) {
    if (!isAggressiveDeskRisk()) {
      vetoReasons.push(`IV/HV < ${ivFloor} — SKIP short premium.`);
    } else {
      reasons.push(`IV/HV ${market.ivHvRatio.toFixed(2)} below ideal — trade smaller.`);
    }
  }

  const sdFloor = riskSdFloor();
  if (candidate && shortPremium && candidate.sdDistance < sdFloor) {
    if (!isAggressiveDeskRisk()) {
      vetoReasons.push(`SD distance < ${sdFloor} — SKIP options.`);
    } else {
      reasons.push(`SD ${candidate.sdDistance.toFixed(2)} tight — reduced premium size.`);
    }
  }

  if (macroEvent.hasEventBeforeSettlement) {
    vetoReasons.push("High-impact macro event — SKIP.");
  }

  const consecutive = ctx.input.consecutiveLosses ?? 0;
  if (consecutive >= riskConsecutiveLossVeto()) {
    vetoReasons.push(
      `${consecutive} consecutive losses — SKIP (desk pause).`,
    );
  }

  if (ctx.dailyLossLimitHit) {
    vetoReasons.push(
      `Max daily loss policy (~${MAX_DAILY_LOSS_PCT}%) — SKIP new risk.`,
    );
  }

  if (ctx.regimeBrain) {
    for (const risk of ctx.regimeBrain.regimeRisks.slice(0, 2)) {
      risks.push(`Regime Brain: ${risk}`);
    }
    if (ctx.regimeBrain.tradeFrequencyRecommendation === "PAUSE") {
      reasons.push("Regime Brain recommends PAUSE — advisory (veto rules still apply).");
    }
  }

  reasons.push("No martingale — never increase size after losses.");
  reasons.push("No futures average down — Risk Manager blocks DCA perps.");
  reasons.push("No auto execution.");

  if (bull.recommendation === "TRADE" && bear.recommendation === "SKIP") {
    reasons.push(
      `Challenges bull thesis: ${bear.reasons[0] ?? "bear case dominant"}.`,
    );
  }
  const playbookRec = tradeRecToAgent(ctx.response.step5_verdict.recommendation);
  if (bear.recommendation === "SKIP" && bull.recommendation === "TRADE") {
    reasons.push(
      isAggressiveDeskRisk()
        ? "Bear challenges bull — committee may still TRADE with smaller size."
        : "Bear thesis challenges bull — prefer WAIT.",
    );
  }

  const veto = vetoReasons.length > 0;
  let recommendation: AgentOutput["recommendation"] = veto ? "SKIP" : "WAIT";
  if (!veto && playbookRec === "TRADE") {
    recommendation = "TRADE";
  } else if (!veto && isAggressiveDeskRisk() && playbookRec === "WAIT") {
    recommendation = "WAIT";
  }

  return buildAgentOutput(
    {
      agentName: "Risk Manager Agent",
      strategyType: "RISK",
      marketView: "Risk overlay — challenges bull & bear",
      recommendation: veto ? "SKIP" : recommendation,
      confidence: veto ? 95 : 70,
      reasons: withDeskMemoryReasons(ctx, reasons, "Risk Manager Agent"),
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
