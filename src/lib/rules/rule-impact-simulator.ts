import type { DraftRule } from "@/lib/journal/draft-rules";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { RuleImpactSimulatorOutput } from "@/lib/simulation/types";

function ruleText(rule: DraftRule | { id: string; description: string }): string {
  return `${"title" in rule ? rule.title : ""} ${rule.description}`.toLowerCase();
}

/** Heuristic: would this draft rule have blocked a TRADE signal? */
export function wouldRuleBlockTrade(
  rule: { description: string; title?: string },
  entry: DecisionLogEntry,
): boolean {
  const text = ruleText(rule as DraftRule);
  const tradeSignal = entry.finalVerdict === "TRADE";

  if (!tradeSignal) return false;

  if (text.includes("funding") && text.includes("futures")) {
    const futures = entry.agentOutputs.find((a) => a.strategyType === "FUTURES");
    if (futures?.recommendation === "TRADE") return true;
  }
  if (text.includes("funding") && text.includes("0.01")) {
    return entry.topReasons.some((r) => r.toLowerCase().includes("funding"));
  }
  if (text.includes("liquidation") && text.includes("block")) {
    return entry.topReasons.some((r) => r.toLowerCase().includes("liquidation"));
  }
  if (text.includes("aggressive") && entry.deskRiskProfile === "aggressive") {
    return true;
  }
  if (text.includes("pre-mortem") || text.includes("block")) {
    if (entry.preMortem?.preMortemVerdict === "BLOCK") return true;
  }
  if (text.includes("data trust") || text.includes("stale")) {
    if (entry.learningSnapshot?.dataTrustGrade === "LOW") return true;
    if (entry.learningSnapshot?.dataTrustGrade === "CRITICAL") return true;
  }
  if (text.includes("risk veto") && entry.riskVeto) return true;
  if (text.includes("skip") && text.includes("committee")) return tradeSignal;

  if (text.includes("block") || text.includes("no trade")) {
    const hash = entry.id.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
    return tradeSignal && hash % 3 !== 0;
  }

  return false;
}

function tradeOutcomeR(entry: DecisionLogEntry): number | null {
  if (entry.outcomeStatus !== "RESOLVED") return null;
  if (entry.finalVerdict !== "TRADE") return null;
  if (entry.resolution?.tradeWouldWin === true) return entry.paperPnl ?? 1;
  if (entry.resolution?.tradeWouldWin === false) return -(entry.paperPnl ?? 1);
  if (entry.paperPnl != null) return entry.paperPnl;
  return null;
}

export function simulateRuleImpact(input: {
  rule: DraftRule | { id: string; description: string; title?: string };
  entries: DecisionLogEntry[];
  orders?: PaperOrder[];
}): RuleImpactSimulatorOutput {
  void input.orders;
  const resolvedTrades = input.entries.filter(
    (e) => e.outcomeStatus === "RESOLVED" && e.finalVerdict === "TRADE",
  );

  let blockedWinning = 0;
  let blockedLosing = 0;
  let allowedWinning = 0;
  let allowedLosing = 0;
  let affected = 0;

  for (const entry of resolvedTrades) {
    const r = tradeOutcomeR(entry);
    if (r == null) continue;
    const blocked = wouldRuleBlockTrade(input.rule, entry);
    if (!blocked) {
      if (r > 0) allowedWinning += 1;
      else allowedLosing += 1;
      continue;
    }
    affected += 1;
    if (r > 0) blockedWinning += 1;
    else blockedLosing += 1;
  }

  const adjustedNet = Number(
    (blockedLosing * 1.2 - blockedWinning * 1).toFixed(2),
  );

  let recommendation: RuleImpactSimulatorOutput["recommendation"] = "NEED_MORE_DATA";
  let explanation = "";

  if (resolvedTrades.length < 5) {
    explanation = `Only ${resolvedTrades.length} resolved TRADE sessions — need more data.`;
  } else if (adjustedNet >= 1.5 && blockedLosing >= blockedWinning) {
    recommendation = "APPROVE_FOR_PAPER_TEST";
    explanation = `Blocked ${affected} trades — avoided ${blockedLosing} losses, missed ${blockedWinning} wins. Net impact ~+${adjustedNet}R.`;
  } else if (adjustedNet < -1 || blockedWinning > blockedLosing * 1.5) {
    recommendation = "REJECT";
    explanation = `Rule would miss too many winners (${blockedWinning}) vs losses avoided (${blockedLosing}).`;
  } else {
    recommendation = "APPROVE_FOR_PAPER_TEST";
    explanation = `Marginal edge — paper test only. Net heuristic impact ${adjustedNet}R.`;
  }

  return {
    ruleId: input.rule.id,
    affectedDecisions: affected,
    blockedWinningTrades: blockedWinning,
    blockedLosingTrades: blockedLosing,
    allowedWinningTrades: allowedWinning,
    allowedLosingTrades: allowedLosing,
    netImpactR: adjustedNet,
    recommendation,
    explanation,
  };
}
