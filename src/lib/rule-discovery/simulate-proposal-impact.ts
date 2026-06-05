import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import { simulateRuleImpact } from "@/lib/rules/rule-impact-simulator";
import type { AutoDiscoveredRuleProposal, RuleDiscoveryImpact } from "./types";
import { proposalMatchesEntry, wouldProposalAffectTrade } from "./match-rule";

function tradePnl(entry: DecisionLogEntry): number {
  return entry.paperPnl ?? 0;
}

function isWin(entry: DecisionLogEntry): boolean {
  if (entry.resolution?.tradeWouldWin === true) return true;
  if (entry.resolution?.tradeWouldWin === false) return false;
  return (entry.paperPnl ?? 0) > 0;
}

export function simulateProposalImpact(input: {
  proposal: AutoDiscoveredRuleProposal;
  entries: DecisionLogEntry[];
  orders?: PaperOrder[];
}): RuleDiscoveryImpact {
  const { proposal, entries, orders } = input;
  const draftRule = {
    id: proposal.ruleId,
    title: proposal.title,
    description: `${proposal.condition}. ${proposal.rationale}`,
  };

  const base = simulateRuleImpact({ rule: draftRule, entries, orders });

  const resolvedTrades = entries.filter(
    (e) => e.outcomeStatus === "RESOLVED" && e.finalVerdict === "TRADE",
  );

  let expectedAvoidedLosses = 0;
  let missedProfits = 0;
  let affected = 0;

  for (const entry of resolvedTrades) {
    const blocked = wouldProposalAffectTrade(proposal, entry, orders);
    if (!blocked) continue;
    affected += 1;
    const pnl = tradePnl(entry);
    if (isWin(entry)) {
      missedProfits += Math.max(0, pnl);
    } else {
      expectedAvoidedLosses += Math.abs(Math.min(0, pnl));
    }
  }

  const totalTrades = resolvedTrades.length;
  const tradeFrequencyChangePct =
    totalTrades > 0
      ? Number((-100 * (affected / totalTrades)).toFixed(1))
      : 0;

  const netImpactPct = Number(
    (expectedAvoidedLosses - missedProfits).toFixed(2),
  );

  const matchCount = entries.filter(
    (e) =>
      e.outcomeStatus === "RESOLVED" &&
      proposalMatchesEntry(proposal, e, orders),
  ).length;

  return {
    ...base,
    ruleId: proposal.ruleId,
    affectedDecisions: Math.max(base.affectedDecisions, affected),
    blockedWinningTrades: base.blockedWinningTrades || Math.round(missedProfits > 0 ? 1 : 0),
    blockedLosingTrades: base.blockedLosingTrades || Math.round(expectedAvoidedLosses > 0 ? 1 : 0),
    expectedAvoidedLosses: Number(expectedAvoidedLosses.toFixed(2)),
    missedProfits: Number(missedProfits.toFixed(2)),
    tradeFrequencyChangePct,
    netImpactPct,
    explanation:
      matchCount < 3
        ? `Thin sample (${matchCount} matching sessions). ${base.explanation}`
        : `Would affect ~${affected} TRADE(s). Avoided losses ~${expectedAvoidedLosses}%, missed profits ~${missedProfits}%. Frequency change ${tradeFrequencyChangePct}%.`,
  };
}
