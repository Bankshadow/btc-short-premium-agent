import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { AutoDiscoveredRuleProposal } from "@/lib/rule-discovery/types";
import type { AdaptationAuditEntry } from "@/lib/strategy-adaptation/types";
import type { PersistedStrategyRegistry } from "@/lib/strategy-registry/strategy-registry-store";
import { strategyIdFromPaperOrder } from "@/lib/strategy-adaptation/map-strategy";
import type { StrategyId } from "@/lib/validation/validation-types";
import type {
  RuleImpactSlice,
  StrategyChangeImpactSlice,
  StrategyVersionPnlSlice,
  VersionComparisonReport,
} from "./types";
import type { PeriodPerformanceSlice } from "./types";

function sliceStats(rows: DecisionLogEntry[]) {
  const wins = rows.filter((e) => (e.paperPnl ?? 0) > 0).length;
  const net = rows.reduce((s, e) => s + (e.paperPnl ?? 0), 0);
  return {
    trades: rows.length,
    winRate: rows.length ? Number(((wins / rows.length) * 100).toFixed(1)) : 0,
    netPnl: Number(net.toFixed(2)),
  };
}

export function buildRuleImpact(
  entries: DecisionLogEntry[],
  proposals: AutoDiscoveredRuleProposal[],
): RuleImpactSlice[] {
  return proposals
    .filter((p) => p.reviewedAt && ["approved", "active"].includes(p.lifecycle))
    .slice(0, 10)
    .map((rule) => {
      const approvedAt = rule.reviewedAt!;
      const before = entries.filter(
        (e) =>
          e.outcomeStatus === "RESOLVED" &&
          (e.resolution?.resolvedAt ?? e.timestamp) < approvedAt,
      );
      const after = entries.filter(
        (e) =>
          e.outcomeStatus === "RESOLVED" &&
          (e.resolution?.resolvedAt ?? e.timestamp) >= approvedAt,
      );
      const b = sliceStats(before);
      const a = sliceStats(after);
      return {
        ruleId: rule.ruleId,
        title: rule.title,
        approvedAt,
        tradesBefore: b.trades,
        tradesAfter: a.trades,
        winRateBefore: b.winRate,
        winRateAfter: a.winRate,
        netPnlBefore: b.netPnl,
        netPnlAfter: a.netPnl,
        estimatedImpactPct: rule.estimatedImpact.netImpactPct,
      };
    });
}

export function buildStrategyVersionPnl(
  entries: DecisionLogEntry[],
  orders: PaperOrder[],
  registry?: PersistedStrategyRegistry,
): StrategyVersionPnlSlice[] {
  const slices: StrategyVersionPnlSlice[] = [];
  const history = registry?.versionHistory ?? {};

  for (const [strategyId, versions] of Object.entries(history)) {
    for (const version of versions ?? []) {
      const relatedOrders = orders.filter(
        (o) =>
          o.status === "CLOSED" &&
          strategyIdFromPaperOrder(o) === strategyId &&
          (o.closedAt ?? o.openedAt) >= version.changedAt,
      );
      const wins = relatedOrders.filter((o) => (o.realizedPnlPct ?? 0) > 0).length;
      const avg =
        relatedOrders.length > 0
          ? relatedOrders.reduce((s, o) => s + (o.realizedPnlPct ?? 0), 0) /
            relatedOrders.length
          : 0;
      let equity = 0;
      let peak = 0;
      let maxDd = 0;
      for (const o of relatedOrders) {
        equity += o.realizedPnlPct ?? 0;
        if (equity > peak) peak = equity;
        maxDd = Math.max(maxDd, peak - equity);
      }

      slices.push({
        strategyId: strategyId as StrategyId,
        version: version.version,
        changedAt: version.changedAt,
        trades: relatedOrders.length,
        winRate: relatedOrders.length
          ? Number(((wins / relatedOrders.length) * 100).toFixed(1))
          : 0,
        avgPnlPct: Number(avg.toFixed(2)),
        maxDrawdownPct: Number(maxDd.toFixed(2)),
      });
    }
  }

  return slices.sort((a, b) => b.changedAt.localeCompare(a.changedAt)).slice(0, 12);
}

export function buildStrategyChangeImpact(
  entries: DecisionLogEntry[],
  audit: AdaptationAuditEntry[],
): StrategyChangeImpactSlice[] {
  return audit
    .filter((a) => a.action === "APPLIED")
    .slice(0, 8)
    .map((row) => {
      const before = entries.filter(
        (e) =>
          e.outcomeStatus === "RESOLVED" &&
          (e.resolution?.resolvedAt ?? e.timestamp) < row.timestamp,
      );
      const after = entries.filter(
        (e) =>
          e.outcomeStatus === "RESOLVED" &&
          (e.resolution?.resolvedAt ?? e.timestamp) >= row.timestamp,
      );
      const b = sliceStats(before);
      const a = sliceStats(after);

      let equity = 0;
      let peak = 0;
      let maxDd = 0;
      for (const e of after) {
        equity += e.paperPnl ?? 0;
        if (equity > peak) peak = equity;
        maxDd = Math.max(maxDd, peak - equity);
      }

      return {
        strategyId: row.targetStrategy,
        changeAt: row.timestamp,
        changeNote: `${row.proposalType}: ${row.beforeStatus} → ${row.afterStatus}`,
        pnlBefore: b.netPnl,
        pnlAfter: a.netPnl,
        winRateBefore: b.winRate,
        winRateAfter: a.winRate,
        drawdownAfterChange: Number(maxDd.toFixed(2)),
      };
    });
}

export function buildVersionComparisons(
  weekly: PeriodPerformanceSlice[],
  monthly: PeriodPerformanceSlice[],
): VersionComparisonReport[] {
  const comparisons: VersionComparisonReport[] = [];

  if (weekly.length >= 2) {
    const cur = weekly[weekly.length - 1];
    const prev = weekly[weekly.length - 2];
    comparisons.push({
      dimension: "Weekly win rate",
      currentLabel: cur.periodLabel,
      previousLabel: prev.periodLabel,
      currentValue: cur.winRate,
      previousValue: prev.winRate,
      delta: Number((cur.winRate - prev.winRate).toFixed(1)),
      deltaPct: prev.winRate
        ? Number((((cur.winRate - prev.winRate) / prev.winRate) * 100).toFixed(1))
        : 0,
      interpretation:
        cur.winRate > prev.winRate
          ? "Win rate improved week-over-week."
          : "Win rate declined week-over-week.",
    });
    comparisons.push({
      dimension: "Weekly committee accuracy",
      currentLabel: cur.periodLabel,
      previousLabel: prev.periodLabel,
      currentValue: cur.committeeAccuracy,
      previousValue: prev.committeeAccuracy,
      delta: Number((cur.committeeAccuracy - prev.committeeAccuracy).toFixed(1)),
      deltaPct: 0,
      interpretation: "Committee verdict accuracy vs resolved outcomes.",
    });
  }

  if (monthly.length >= 2) {
    const cur = monthly[monthly.length - 1];
    const prev = monthly[monthly.length - 2];
    comparisons.push({
      dimension: "Monthly net PnL %",
      currentLabel: cur.periodLabel,
      previousLabel: prev.periodLabel,
      currentValue: cur.netPnlPct,
      previousValue: prev.netPnlPct,
      delta: Number((cur.netPnlPct - prev.netPnlPct).toFixed(2)),
      deltaPct: 0,
      interpretation:
        cur.netPnlPct > prev.netPnlPct
          ? "Monthly PnL improved."
          : "Monthly PnL declined.",
    });
  }

  return comparisons;
}
