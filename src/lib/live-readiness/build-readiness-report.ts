import { evaluateAllCategories } from "./evaluate-categories";
import { LIVE_READINESS_SAFETY_NOTICE } from "./thresholds";
import type { LiveReadinessInput, LiveReadinessReport, ReadinessStatus } from "./types";

function overallFromCategories(
  categories: LiveReadinessReport["categories"],
): { status: ReadinessStatus; score: number } {
  if (categories.some((c) => c.status === "FAIL")) {
    const score = Math.round(
      categories.reduce((s, c) => s + c.score, 0) / categories.length,
    );
    return { status: "FAIL", score };
  }
  if (categories.some((c) => c.status === "WARNING")) {
    const score = Math.round(
      categories.reduce((s, c) => s + c.score, 0) / categories.length,
    );
    return { status: "WARNING", score };
  }
  const score = Math.round(
    categories.reduce((s, c) => s + c.score, 0) / categories.length,
  );
  return { status: "PASS", score };
}

export function buildLiveReadinessReport(
  input: LiveReadinessInput,
): LiveReadinessReport {
  const { categories, strictPaperMetrics } = evaluateAllCategories(input);

  const hardBlockers = [
    ...new Set(categories.flatMap((c) => c.blockingIssues)),
  ];

  const recommendedNextActions = [
    ...new Set(categories.flatMap((c) => c.recommendedActions)),
  ].slice(0, 12);

  const overall = overallFromCategories(categories);
  const live = input.serverContext.liveExecution;
  const ex = input.serverContext.exchangeStatus;

  const readyForSmallLivePerpPilot =
    overall.status === "PASS" &&
    hardBlockers.length === 0 &&
    ex.configured &&
    ex.connected &&
    strictPaperMetrics.closedTrades >= 5 &&
    strictPaperMetrics.expectancy >= 0;

  return {
    generatedAt: new Date().toISOString(),
    overallStatus: hardBlockers.length > 0 ? "FAIL" : overall.status,
    overallScore: overall.score,
    readyForSmallLivePerpPilot,
    btcOptionsLiveSupported: false,
    categories,
    hardBlockers,
    recommendedNextActions,
    strictPaperMetrics,
    liveModeVisibility: {
      liveExecutionEnabled: live.enabled,
      requireDoubleConfirm: live.requireDoubleConfirm,
      exchangeConfigured: ex.configured,
      exchangeConnected: ex.connected,
      network: ex.network,
      maxLiveNotionalUsd: input.serverContext.maxLiveNotionalUsd,
      note: live.enabled
        ? "Live execution is ON in server env — this dashboard cannot change it. Use double confirm on exchange preview."
        : "Live execution is OFF. Enable LIVE_EXECUTION_ENABLED in server env only after this checklist passes.",
    },
    safetyNotice: LIVE_READINESS_SAFETY_NOTICE,
  };
}
