import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import { strategiesSignaledOnEntry } from "@/lib/validation/classify-strategy";
import type { AutoDiscoveredRuleProposal, DiscoveredPattern } from "./types";

function entryText(entry: DecisionLogEntry): string {
  return [
    entry.marketRegime,
    ...entry.topReasons,
    ...entry.agentOutputs.flatMap((a) => [...a.reasons, ...a.risks]),
    entry.actionPlan,
  ]
    .join(" ")
    .toLowerCase();
}

export function patternMatchesEntry(
  pattern: Pick<DiscoveredPattern, "category" | "condition" | "suggestedScope">,
  entry: DecisionLogEntry,
  orders?: PaperOrder[],
): boolean {
  const text = entryText(entry);
  const regime = entry.marketRegime.toLowerCase();
  const scope = pattern.suggestedScope;

  if (scope.regime && !regime.includes(scope.regime.toLowerCase())) {
    return false;
  }
  if (scope.strategyId) {
    const signaled = strategiesSignaledOnEntry(entry);
    if (!signaled.includes(scope.strategyId)) return false;
  }
  if (scope.agentName) {
    const agent = entry.agentOutputs.find((a) => a.agentName === scope.agentName);
    if (!agent) return false;
  }
  if (scope.paperMode && orders) {
    const order = orders.find((o) => o.decisionLogId === entry.id);
    if (order && order.paperMode !== scope.paperMode) return false;
  }

  switch (pattern.category) {
    case "regime_loss":
    case "regime_win":
      return scope.regime ? regime.includes(scope.regime.toLowerCase()) : false;
    case "liquidation_risk":
      return regime.includes("liquidation") || text.includes("liquidation");
    case "macro_failure":
      return regime.includes("macro") || text.includes("macro");
    case "iv_hv_failure":
      return (
        text.includes("iv/hv") ||
        text.includes("iv hv") ||
        text.includes("low iv") ||
        text.includes("hv30")
      );
    case "funding_stress":
      return text.includes("funding");
    case "agent_disagreement":
      return (
        entry.agentOutputs.some(
          (a) => a.agentName === "Bull Thesis Agent" && a.recommendation === "TRADE",
        ) &&
        entry.agentOutputs.some(
          (a) => a.agentName === "Bear Thesis Agent" && a.recommendation === "SKIP",
        )
      );
    case "excessive_skip":
      return entry.falseSkipFlag === true || entry.finalVerdict === "SKIP";
    case "relaxed_outperform":
      return orders?.some(
        (o) => o.decisionLogId === entry.id && o.paperMode === "RELAXED_PAPER",
      ) ?? false;
    case "agent_weakness":
      return scope.agentName
        ? entry.agentOutputs.some((a) => a.agentName === scope.agentName)
        : false;
    case "memory_lesson":
      return pattern.condition
        .toLowerCase()
        .split(" ")
        .filter((w) => w.length > 4)
        .some((w) => text.includes(w));
    default:
      return pattern.condition
        .toLowerCase()
        .split(" ")
        .filter((w) => w.length > 4)
        .some((w) => text.includes(w));
  }
}

export function proposalMatchesEntry(
  proposal: AutoDiscoveredRuleProposal,
  entry: DecisionLogEntry,
  orders?: PaperOrder[],
): boolean {
  return patternMatchesEntry(
    {
      category: proposal.category,
      condition: proposal.editedCondition ?? proposal.condition,
      suggestedScope: proposal.suggestedScope,
    },
    entry,
    orders,
  );
}

export function wouldProposalAffectTrade(
  proposal: AutoDiscoveredRuleProposal,
  entry: DecisionLogEntry,
  orders?: PaperOrder[],
): boolean {
  if (entry.finalVerdict !== "TRADE") return false;
  if (!patternMatchesEntry(proposal, entry, orders)) return false;

  switch (proposal.ruleType) {
    case "BLOCK":
      return true;
    case "CAUTION":
    case "SIZE_REDUCE":
    case "REVIEW":
      return true;
    case "ALLOW_PAPER":
      return false;
    case "SIZE_INCREASE":
      return false;
    default:
      return false;
  }
}
