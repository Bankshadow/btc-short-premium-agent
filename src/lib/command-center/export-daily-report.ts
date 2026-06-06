import type { CommandCenterReport } from "./types";

export function formatCommandCenterDailyReport(report: CommandCenterReport): string {
  const lines: string[] = [
    "# BTC Desk — Command Center Daily Report",
    `Generated: ${report.generatedAt}`,
    `Status: ${report.status} — ${report.statusLabel}`,
    "",
    "## Hard blockers",
    ...(report.blockers.length > 0
      ? report.blockers.map((b) => `- [${b.id}] ${b.label}: ${b.detail}`)
      : ["- None"]),
    "",
    "## Cautions",
    ...(report.cautions.length > 0
      ? report.cautions.map((c) => `- ${c}`)
      : ["- None"]),
    "",
    "## Recommended actions",
    ...(report.recommendedActions.length > 0
      ? report.recommendedActions.map((a) => `- ${a}`)
      : ["- None"]),
    "",
    "## Production reality (MVP 41C)",
    `- Live trading: ${report.realityCheck.domainStatuses.liveTrading}`,
    `- Paper learning: ${report.realityCheck.domainStatuses.paperLearning}`,
    `- Analysis only: ${report.realityCheck.domainStatuses.analysisOnly}`,
    `- Expected posture: ${report.realityCheck.expectedProductionPosture ? "yes" : "no"}`,
    "",
    "## System health",
    `- Last analyzed: ${report.panels.systemHealth.lastAnalyzedAt ?? "n/a"}`,
    `- Source errors: ${report.panels.systemHealth.sourceErrorCount}`,
    `- Pause analysis: ${report.panels.systemHealth.pauseAnalysis}`,
    `- Safe mode: ${report.panels.systemHealth.safeMode}`,
    "",
    "## Exchange",
    `- Configured: ${report.panels.exchangeConnectivity.configured}`,
    `- Connected: ${report.panels.exchangeConnectivity.connected}`,
    `- Network: ${report.panels.exchangeConnectivity.network ?? "n/a"}`,
    "",
    "## Live readiness",
    `- Overall: ${report.panels.liveReadiness.overallStatus} (${report.panels.liveReadiness.overallScore})`,
    `- Pilot ready: ${report.panels.liveReadiness.readyForSmallLivePerpPilot}`,
    "",
    "## Positions",
    `- Paper open: ${report.panels.openPaperPositions.totalOpen}`,
    `- Live pilot open: ${report.panels.openLivePositions.pilotOpen}`,
    `- Exchange linear: ${report.panels.openLivePositions.exchangeLinearOpen}`,
    "",
    "## Kill switch",
    `- Trading paused: ${report.panels.killSwitch.tradingPaused}`,
    `- Reasons: ${report.panels.killSwitch.activeReasons.join(", ") || "none"}`,
    "",
    "## Daily limits",
    `- Paper daily PnL %: ${report.panels.dailyTradingLimits.killSwitch.dailyPnlPct}`,
    `- Pilot trades today: ${report.panels.dailyTradingLimits.pilotTradesToday}/${report.panels.dailyTradingLimits.pilotDailyTradeLimit}`,
    `- Frequency allowed: ${report.panels.dailyTradingLimits.frequency.frequencyAllowed}`,
    "",
    "## Incidents",
    `- Open: ${report.panels.incidentStatus.openCount} (critical: ${report.panels.incidentStatus.criticalOpen})`,
    "",
    "## Pending approvals",
    `- Adaptation: ${report.panels.pendingApprovals.adaptationPending}`,
    `- Desk manager actions: ${report.panels.activeAiActions.pendingDeskManager}`,
    "",
    report.safetyNotice,
  ];
  return lines.join("\n");
}
