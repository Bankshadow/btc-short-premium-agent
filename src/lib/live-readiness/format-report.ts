import type { LiveReadinessReport, ReadinessReportExport } from "./types";

function statusEmoji(status: string): string {
  if (status === "PASS") return "PASS";
  if (status === "WARNING") return "WARN";
  return "FAIL";
}

export function formatReadinessReport(
  report: LiveReadinessReport,
): ReadinessReportExport {
  const lines: string[] = [
    "# Live Readiness Report",
    `Generated: ${report.generatedAt}`,
    `Overall: ${report.overallStatus} (${report.overallScore}/100)`,
    `Ready for small live perp pilot: ${report.readyForSmallLivePerpPilot ? "YES" : "NO"}`,
    `BTC options live: NOT SUPPORTED`,
    "",
    "## Hard blockers",
    ...(report.hardBlockers.length
      ? report.hardBlockers.map((b) => `- ${b}`)
      : ["- None"]),
    "",
    "## Recommended next actions",
    ...report.recommendedNextActions.map((a) => `- ${a}`),
    "",
    "## Strict paper metrics",
    `- Closed trades: ${report.strictPaperMetrics.closedTrades}`,
    `- Win rate: ${report.strictPaperMetrics.winRate}%`,
    `- Avg PnL: ${report.strictPaperMetrics.avgPnlPct}%`,
    `- Max drawdown: ${report.strictPaperMetrics.maxDrawdownPct}%`,
    `- Loss streak: ${report.strictPaperMetrics.recentLossStreak}`,
    `- Relaxed excluded: ${report.strictPaperMetrics.relaxedExcludedCount}`,
    "",
    "## Live mode (read-only visibility)",
    `- LIVE_EXECUTION_ENABLED: ${report.liveModeVisibility.liveExecutionEnabled}`,
    `- Double confirm required: ${report.liveModeVisibility.requireDoubleConfirm}`,
    `- Exchange: ${report.liveModeVisibility.exchangeConfigured ? "configured" : "missing"} / ${report.liveModeVisibility.exchangeConnected ? "connected" : "disconnected"}`,
    `- Network: ${report.liveModeVisibility.network ?? "n/a"}`,
    `- Max notional: $${report.liveModeVisibility.maxLiveNotionalUsd}`,
    "",
    "## Categories",
  ];

  for (const cat of report.categories) {
    lines.push(
      "",
      `### ${cat.label} — ${statusEmoji(cat.status)} (${cat.score}/100)`,
      ...cat.reasons.map((r) => `- ${r}`),
    );
    if (cat.blockingIssues.length) {
      lines.push("Blockers:");
      lines.push(...cat.blockingIssues.map((b) => `  ! ${b}`));
    }
  }

  lines.push("", report.safetyNotice);

  const markdown = lines.join("\n");
  const text = markdown.replace(/^#+ /gm, "").replace(/\*\*/g, "");

  return { markdown, text, json: report };
}
