import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type {
  OptionsDryRunPerformanceReport,
  OptionsDryRunResult,
  RejectedTradeAnalysis,
} from "./types";
import { OPTIONS_DRY_RUN_SAFETY_NOTICE } from "./types";

const MIN_DRY_RUNS_FOR_READINESS = 5;
const MIN_WOULD_SUBMIT_RATE_PCT = 40;

function groupRejections(results: OptionsDryRunResult[]): RejectedTradeAnalysis[] {
  const map = new Map<string, RejectedTradeAnalysis>();
  for (const r of results) {
    if (r.wouldSubmit) continue;
    const key = r.rejectionCategory ?? "other";
    const reason =
      r.rejectionReasons[0] ?? r.rejectionCategory ?? "Unknown rejection";
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      map.set(key, { reason, count: 1, category: key });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export function buildOptionsDryRunPerformanceReport(input: {
  history: OptionsDryRunResult[];
  paperOrders?: PaperOrder[];
}): OptionsDryRunPerformanceReport {
  const history = input.history;
  const paperOrders = (input.paperOrders ?? []).filter(
    (o) =>
      o.instrument === "sell_call" ||
      o.instrument === "sell_put",
  );

  const wouldSubmit = history.filter((r) => r.wouldSubmit);
  const wouldSubmitRate =
    history.length > 0
      ? Number(((wouldSubmit.length / history.length) * 100).toFixed(1))
      : 0;

  const closedPaper = paperOrders.filter((o) => o.status === "CLOSED");
  const paperWins = closedPaper.filter((o) => (o.realizedPnlPct ?? 0) > 0);
  const wouldBeLiveWinRatePct =
    wouldSubmit.length > 0 && closedPaper.length > 0
      ? Number(((paperWins.length / closedPaper.length) * 100).toFixed(1))
      : null;

  const aligned = history.filter((r) => {
    const paper = paperOrders.find(
      (o) => o.decisionLogId === r.decisionLogId,
    );
    if (!paper) return false;
    const paperWould = paper.status !== "CANCELLED";
    return paperWould === r.wouldSubmit;
  });

  const blockers: string[] = [];
  if (history.length < MIN_DRY_RUNS_FOR_READINESS) {
    blockers.push(
      `Need ${MIN_DRY_RUNS_FOR_READINESS} dry-runs (have ${history.length}).`,
    );
  }
  if (wouldSubmitRate < MIN_WOULD_SUBMIT_RATE_PCT && history.length >= 3) {
    blockers.push(
      `Would-submit rate ${wouldSubmitRate}% below ${MIN_WOULD_SUBMIT_RATE_PCT}% threshold.`,
    );
  }

  return {
    generatedAt: new Date().toISOString(),
    totalDryRuns: history.length,
    wouldSubmitCount: wouldSubmit.length,
    wouldBeLiveWinRatePct,
    rejectedTradeAnalysis: groupRejections(history),
    paperVsDryRun: {
      paperTrades: paperOrders.length,
      dryRuns: history.length,
      paperWouldSubmitMatchPct:
        history.length > 0
          ? Number(((aligned.length / history.length) * 100).toFixed(1))
          : 0,
      dryRunWouldSubmitCount: wouldSubmit.length,
      alignedDecisions: aligned.length,
    },
    missedDueToLiquidity: history.filter((r) => r.rejectionCategory === "liquidity").length,
    missedDueToMargin: history.filter((r) => r.rejectionCategory === "margin").length,
    rejectedByGovernance: history.filter((r) => r.rejectionCategory === "governance").length,
    rejectedByRiskEngine: history.filter((r) => r.rejectionCategory === "risk_engine").length,
    recentResults: history.slice(0, 20),
    readinessContribution: {
      dryRunSampleSize: history.length,
      wouldSubmitRatePct: wouldSubmitRate,
      readyForLiveGate: blockers.length === 0 && history.length >= MIN_DRY_RUNS_FOR_READINESS,
      blockers,
    },
    safetyNotice: OPTIONS_DRY_RUN_SAFETY_NOTICE,
    cannotEnableLive: true,
  };
}
