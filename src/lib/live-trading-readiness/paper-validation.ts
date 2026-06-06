import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import {
  countProductionResolved,
  filterProductionEntries,
  filterProductionOrders,
} from "@/lib/journal/production-filter";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import { getPendingResolutionQueue } from "@/lib/paper-autopilot/resolve-queue";
import type { PaperValidationSnapshot } from "./types";

export function buildPaperValidationSnapshot(
  entries: DecisionLogEntry[],
  orders: PaperOrder[],
): PaperValidationSnapshot {
  const productionEntries = filterProductionEntries(entries);
  const productionOrders = filterProductionOrders(orders);
  const pending = getPendingResolutionQueue();
  const resolvedTrades = countProductionResolved(entries);

  const linkedPaper = productionOrders.filter(
    (o) => o.paperMode !== "RELAXED_PAPER" && o.decisionLogId,
  ).length;
  const linkedShadow = productionOrders.filter(
    (o) => o.paperMode === "RELAXED_PAPER" && o.decisionLogId,
  ).length;
  const unlinked = productionOrders.filter((o) => !o.decisionLogId).length;

  const blockers: string[] = [];
  if (productionEntries.length === 0) {
    blockers.push("No production decision logs — run desk analyze first.");
  }
  if (unlinked > 0) {
    blockers.push(`${unlinked} paper trade(s) missing decisionLogId link.`);
  }
  if (resolvedTrades === 0) {
    blockers.push("No resolved paper outcomes — close and resolve trades.");
  }
  if (pending.length > 5) {
    blockers.push(`${pending.length} trades awaiting outcome resolution.`);
  }

  return {
    decisionLogCount: entries.length,
    productionDecisionLogCount: productionEntries.length,
    linkedPaperTrades: linkedPaper,
    linkedShadowTrades: linkedShadow,
    unlinkedTrades: unlinked,
    pendingResolutions: pending.length,
    resolvedTrades,
    everyAnalyzeCreatesLog: productionEntries.length > 0,
    paperAutopilotLinked: unlinked === 0 && productionOrders.length > 0,
    outcomePipelineReady: resolvedTrades > 0 && pending.length <= 5,
    blockers,
  };
}

/** Documents downstream effects triggered by resolveDecisionOutcome. */
export const PAPER_OUTCOME_DOWNSTREAM = [
  "portfolio metrics (strict paper PnL, drawdown)",
  "agent scoreboard (resolved entry reflections)",
  "strategy sample size (validation report)",
  "capital scaling recommendations",
  "reflection agent output on log entry",
  "draft rules from reflection suggestions",
  "self-learning post-trade evaluation",
] as const;
