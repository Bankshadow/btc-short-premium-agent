import type { AgentOutput } from "./types";
import {
  buildAgentOutput,
  resolveMarketRegime,
  type TradingDeskContext,
  withDeskMemoryReasons,
} from "./shared";

/** Regime Agent — labels macro/liquidation/technical regime (MVP 5). */
export function runRegimeAgent(
  ctx: TradingDeskContext,
  regimeLabel: string,
): AgentOutput {
  const daily = ctx.input.technicalDaily;
  const combo = ctx.response.step4_combinationRead;
  const reasons: string[] = [];
  const risks: string[] = [];

  const brain = ctx.regimeBrain;
  if (brain) {
    reasons.push(
      `Regime Brain: ${brain.primaryRegime} (${brain.regimeConfidence}% confidence)`,
    );
    if (brain.secondaryRegimes.length > 0) {
      reasons.push(`Secondary: ${brain.secondaryRegimes.join(", ")}`);
    }
    reasons.push(
      `Strategy routing: ${brain.recommendedStrategies.join(", ") || "none"}`,
    );
  }
  reasons.push(`Desk regime: ${regimeLabel}`);
  reasons.push(`Daily trend: ${daily.trend} · 4H ${ctx.input.technical4h.trend}`);
  reasons.push(`Playbook combination: ${combo.pattern}`);

  if (ctx.input.macroEvent.hasEventBeforeSettlement) {
    reasons.push("Macro event before settlement — regime stressed.");
    risks.push("Regime favors SKIP on short premium.");
  }

  let recommendation: AgentOutput["recommendation"] = "WAIT";
  if (/stress|capitulation|Macro caution/i.test(regimeLabel)) {
    recommendation = "SKIP";
  } else if (/Risk-on/i.test(regimeLabel)) {
    recommendation = "WAIT";
  } else if (/Range|Mixed|Unclear/i.test(regimeLabel)) {
    recommendation = "WAIT";
  }

  return buildAgentOutput(
    {
      agentName: "Regime Agent",
      strategyType: "RESEARCH",
      marketView: regimeLabel,
      recommendation,
      confidence: /Unclear|partial/i.test(regimeLabel) ? 45 : 68,
      reasons: withDeskMemoryReasons(ctx, reasons),
      risks,
      proposedAction: "Regime label guides committee — advisory only.",
    },
    ctx,
  );
}

export function resolveRegimeLabel(ctx: TradingDeskContext): string {
  return resolveMarketRegime(ctx);
}
