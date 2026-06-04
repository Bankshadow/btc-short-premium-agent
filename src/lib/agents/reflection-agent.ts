import type { AgentOutput } from "./types";
import type {
  DecisionLogEntry,
  PaperResolution,
  StructuredReflection,
} from "@/lib/journal/decision-log-types";

function agentsRecommendingTrade(outputs: AgentOutput[]): AgentOutput[] {
  return outputs.filter((a) => a.recommendation === "TRADE");
}

export function runReflectionAgent(
  entry: DecisionLogEntry,
  resolution: PaperResolution,
): StructuredReflection {
  const whatWasCorrect: string[] = [];
  const whatWasWrong: string[] = [];
  const tooAggressiveAgents: string[] = [];
  const helpfulRiskRules: string[] = [];

  const movePct =
    entry.btcPrice > 0
      ? ((resolution.btcPriceAfter - entry.btcPrice) / entry.btcPrice) * 100
      : 0;

  if (entry.riskVeto) {
    if (resolution.tradeWouldWin === false || entry.finalVerdict === "SKIP") {
      helpfulRiskRules.push("Risk veto avoided a losing or blocked setup.");
      whatWasCorrect.push("Risk Manager veto aligned with post-hoc outcome.");
    } else if (resolution.tradeWouldWin === true) {
      whatWasWrong.push("Risk veto may have blocked a winning hypothetical trade.");
    }
    for (const reason of entry.agentOutputs.find((a) => a.veto)?.vetoReasons ??
      []) {
      helpfulRiskRules.push(reason);
    }
  }

  if (entry.finalVerdict === "SKIP" && resolution.tradeWouldWin === false) {
    whatWasCorrect.push("Committee SKIP — market did not reward aggression.");
  }
  if (entry.finalVerdict === "TRADE" && resolution.tradeWouldWin === true) {
    whatWasCorrect.push("Committee TRADE matched favorable paper outcome.");
  }
  if (entry.finalVerdict === "TRADE" && resolution.tradeWouldWin === false) {
    whatWasWrong.push("Committee TRADE — hypothetical trade would have lost.");
  }
  if (
    (entry.finalVerdict === "SKIP" || entry.finalVerdict === "WAIT") &&
    resolution.tradeWouldWin === true
  ) {
    whatWasWrong.push("Desk stood aside while a hypothetical trade would have won.");
  }

  for (const agent of agentsRecommendingTrade(entry.agentOutputs)) {
    if (resolution.tradeWouldWin === false) {
      tooAggressiveAgents.push(
        `${agent.agentName} pushed TRADE (${agent.confidence} confidence) into a losing tape.`,
      );
    }
  }

  const bull = entry.agentOutputs.find((a) => a.agentName.includes("Bull"));
  const bear = entry.agentOutputs.find((a) => a.agentName.includes("Bear"));
  if (bull?.recommendation === "TRADE" && movePct < -1) {
    whatWasCorrect.push("Bull thesis matched upward follow-through.");
  }
  if (bear?.recommendation === "SKIP" && movePct < -2) {
    whatWasCorrect.push("Bear thesis warned before drawdown.");
  }

  if (whatWasCorrect.length === 0) {
    whatWasCorrect.push("Logged regime and agent debate for future calibration.");
  }
  if (whatWasWrong.length === 0 && entry.outcomeStatus === "RESOLVED") {
    whatWasWrong.push("No major miss flagged — review top reasons for nuance.");
  }

  const suggestedDraftRule = buildSuggestedDraftRule(
    entry,
    resolution,
    tooAggressiveAgents,
    helpfulRiskRules,
  );

  return {
    whatWasCorrect: [...new Set(whatWasCorrect)].slice(0, 5),
    whatWasWrong: [...new Set(whatWasWrong)].slice(0, 5),
    tooAggressiveAgents: [...new Set(tooAggressiveAgents)].slice(0, 4),
    helpfulRiskRules: [...new Set(helpfulRiskRules)].slice(0, 5),
    suggestedDraftRule,
    generatedAt: new Date().toISOString(),
  };
}

function buildSuggestedDraftRule(
  entry: DecisionLogEntry,
  resolution: PaperResolution,
  aggressive: string[],
  riskHelp: string[],
): string {
  if (entry.riskVeto && resolution.tradeWouldWin === false) {
    return `Draft: When ${entry.marketRegime} + risk veto, maintain SKIP until liquidation normalizes (learned from log ${entry.id.slice(0, 8)}).`;
  }
  if (aggressive.length > 0 && resolution.tradeWouldWin === false) {
    return `Draft: Require OPTIONS + RISK alignment before TRADE when ${entry.marketRegime} — ${aggressive[0]}`;
  }
  if (riskHelp.length > 0) {
    return `Draft: Reinforce existing rule — ${riskHelp[0]} (paper-validated).`;
  }
  return `Draft: Re-check IV/HV and liquidation inputs before TRADE in ${entry.marketRegime} regimes.`;
}
