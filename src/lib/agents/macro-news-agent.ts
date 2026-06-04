import type { AgentOutput } from "./types";
import { buildAgentOutput, type TradingDeskContext, withDeskMemoryReasons } from "./shared";

/** Macro / News Agent — calendar + desk macro view (MVP 5). */
export function runMacroNewsAgent(ctx: TradingDeskContext): AgentOutput {
  const { macroEvent, macroView } = ctx.input;
  const reasons: string[] = [];
  const risks: string[] = [];

  reasons.push(`Desk macro view: ${macroView ?? "neutral"}`);

  if (macroEvent.hasEventBeforeSettlement) {
    reasons.push(
      `High-impact event before 15:00 TH settlement${macroEvent.eventName ? `: ${macroEvent.eventName}` : ""}.`,
    );
    risks.push("No-trade macro rule likely triggers SKIP.");
  } else {
    reasons.push("No macro block flagged before settlement window.");
  }

  const hardMacro = ctx.response.step3_noTradeRules.find(
    (r) => r.id === "macro-event" && r.triggered,
  );
  if (hardMacro) {
    reasons.push(hardMacro.message);
  }

  let recommendation: AgentOutput["recommendation"] = "WAIT";
  if (macroEvent.hasEventBeforeSettlement || hardMacro) {
    recommendation = "SKIP";
  } else if (macroView === "bearish") {
    recommendation = "WAIT";
    reasons.push("Bearish macro view — favors short premium discipline, not rush.");
  }

  return buildAgentOutput(
    {
      agentName: "Macro & News Agent",
      strategyType: "RESEARCH",
      marketView: macroEvent.hasEventBeforeSettlement
        ? "Macro headwind"
        : `${macroView ?? "neutral"} calendar`,
      recommendation,
      confidence: macroEvent.hasEventBeforeSettlement ? 90 : 60,
      reasons: withDeskMemoryReasons(ctx, reasons),
      risks,
      proposedAction: "Macro overlay for committee — human confirms calendar.",
    },
    ctx,
  );
}
