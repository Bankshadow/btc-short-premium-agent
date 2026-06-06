import type {
  LiveEvidenceBuildInput,
  LiveEvidenceCategoryResult,
  LiveEvidenceReport,
  LiveEvidenceReportExport,
  LiveEvidenceStatus,
} from "./types";

function scoreForStatus(status: LiveEvidenceStatus): number {
  if (status === "PASS") return 10;
  if (status === "WARNING") return 6;
  return 0;
}

function dedupe(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

export function buildLiveEvidenceReport(input: LiveEvidenceBuildInput): LiveEvidenceReport {
  const thresholds = {
    minStrategyHealthScore: input.thresholds?.minStrategyHealthScore ?? 60,
    minPaperSamples: input.thresholds?.minPaperSamples ?? 5,
    minTestnetTrades: input.thresholds?.minTestnetTrades ?? 3,
  };

  const hardBlockers: LiveEvidenceReport["hardBlockersTriggered"] = [];

  const noTestnetClosedTrades = input.testnet.closedTrades <= 0;
  if (noTestnetClosedTrades) {
    hardBlockers.push({
      key: "no_testnet_closed_trades",
      message: "No testnet closed trades found.",
    });
  }

  const noLearningRecords = input.testnet.learningRecords <= 0 || input.testnet.learnedRecords <= 0;
  if (noLearningRecords) {
    hardBlockers.push({
      key: "no_learning_records",
      message: "No learning records or learned records available.",
    });
  }

  const unresolvedCriticalIncidents = input.incidents.criticalOpenCount > 0;
  if (unresolvedCriticalIncidents) {
    hardBlockers.push({
      key: "unresolved_critical_incidents",
      message: `${input.incidents.criticalOpenCount} unresolved CRITICAL incident(s).`,
    });
  }

  const alertOff = !input.alerts.anyChannelConfigured;
  if (alertOff) {
    hardBlockers.push({
      key: "alert_off",
      message: "Alert channels are not configured.",
    });
  }

  const ledgerUnhealthy = !input.ledger.healthy;
  if (ledgerUnhealthy) {
    hardBlockers.push({
      key: "ledger_unhealthy",
      message: "Ledger health is unhealthy.",
    });
  }

  const strategyHealthBelowThreshold =
    input.strategyHealth.healthScorePct < thresholds.minStrategyHealthScore;
  if (strategyHealthBelowThreshold) {
    hardBlockers.push({
      key: "strategy_health_below_threshold",
      message: `Strategy health score ${input.strategyHealth.healthScorePct} below threshold ${thresholds.minStrategyHealthScore}.`,
    });
  }

  const riskReplayNotReviewed = !input.riskControl.riskReplayReviewedAt;
  if (riskReplayNotReviewed) {
    hardBlockers.push({
      key: "risk_replay_not_reviewed",
      message: "Risk replay has not been reviewed yet.",
    });
  }

  const noDoubleConfirm = !input.operatorApproval.doubleConfirmRequired;
  if (noDoubleConfirm) {
    hardBlockers.push({
      key: "no_double_confirm",
      message: "Double confirm is not required by current live gate.",
    });
  }

  const liveEndpointNotLocked = !input.endpointLock.lockedCorrectly;
  if (liveEndpointNotLocked) {
    hardBlockers.push({
      key: "live_endpoint_not_locked_correctly",
      message: input.endpointLock.detail,
    });
  }

  const executionQualityDegraded = input.execution.gateStatus === "FAIL";
  if (executionQualityDegraded) {
    hardBlockers.push({
      key: "execution_quality_degraded",
      message: `Execution quality degraded: ${input.execution.gateReasons[0] ?? "quality gate FAIL"}`,
    });
  }

  const categories: LiveEvidenceCategoryResult[] = [
    {
      id: "paper_results",
      label: "Paper results",
      status:
        input.paper.sampleSize >= thresholds.minPaperSamples && input.paper.averageR >= 0
          ? "PASS"
          : input.paper.sampleSize > 0
            ? "WARNING"
            : "FAIL",
      evidence: [
        `Sample size: ${input.paper.sampleSize}`,
        `Win rate: ${input.paper.winRate}%`,
        `Average R: ${input.paper.averageR}`,
        `Total PnL: ${input.paper.totalPnl}`,
      ],
      missingItems:
        input.paper.sampleSize >= thresholds.minPaperSamples
          ? []
          : [`Need at least ${thresholds.minPaperSamples} paper samples.`],
      recommendation:
        input.paper.sampleSize >= thresholds.minPaperSamples
          ? "Continue paper validation while preserving risk discipline."
          : "Gather more paper outcomes before live consideration.",
    },
    {
      id: "testnet_results",
      label: "Testnet results",
      status:
        noTestnetClosedTrades || noLearningRecords
          ? "FAIL"
          : input.testnet.closedTrades < thresholds.minTestnetTrades
            ? "WARNING"
            : "PASS",
      evidence: [
        `Closed trades: ${input.testnet.closedTrades}`,
        `Learning records: ${input.testnet.learningRecords}`,
        `Learned records: ${input.testnet.learnedRecords}`,
        `Win rate: ${input.testnet.winRate}%`,
      ],
      missingItems: [
        ...(noTestnetClosedTrades ? ["No testnet closed trades."] : []),
        ...(noLearningRecords ? ["No usable learned records."] : []),
        ...(input.testnet.closedTrades > 0 && input.testnet.closedTrades < thresholds.minTestnetTrades
          ? [`Need at least ${thresholds.minTestnetTrades} testnet closes for stronger evidence.`]
          : []),
      ],
      recommendation:
        noTestnetClosedTrades || noLearningRecords
          ? "Close testnet trades and complete learning loop first."
          : "Expand testnet sample and keep learning records updated.",
    },
    {
      id: "execution_quality",
      label: "Execution quality",
      status:
        input.execution.gateStatus === "FAIL" || input.execution.criticalExecutionIncidents > 0
          ? "FAIL"
          : input.execution.gateStatus === "WARNING" ||
              input.execution.failedLiveTrades > 0 ||
              input.execution.warningExecutionIncidents > 0
            ? "WARNING"
            : "PASS",
      evidence: [
        `Failed live trades: ${input.execution.failedLiveTrades}`,
        `Critical execution incidents: ${input.execution.criticalExecutionIncidents}`,
        `Warning execution incidents: ${input.execution.warningExecutionIncidents}`,
        `Average slippage: ${input.execution.averageSlippageBps} bps`,
        `Rejection rate: ${input.execution.rejectionRatePct}%`,
        `Failed close rate: ${input.execution.failedCloseRatePct}%`,
        `Average latency: ${Math.round(input.execution.averageLatencyMs)} ms`,
        `Duplicate submissions: ${input.execution.duplicateSubmissionCount}`,
        `Retry count total: ${input.execution.retryCountTotal}`,
        `Execution gate: ${input.execution.gateStatus}`,
      ],
      missingItems:
        [
          ...(input.execution.criticalExecutionIncidents > 0
            ? ["Resolve critical execution incidents."]
            : []),
          ...(input.execution.gateStatus === "FAIL"
            ? input.execution.gateReasons
            : []),
        ],
      recommendation:
        input.execution.criticalExecutionIncidents > 0 || input.execution.gateStatus === "FAIL"
          ? "Stabilize execution paths before any live pilot."
          : "Continue monitoring execution slippage/failure trends.",
    },
    {
      id: "risk_control",
      label: "Risk control",
      status:
        input.riskControl.blockNewTrades || input.riskControl.riskStatus === "EMERGENCY"
          ? "FAIL"
          : input.riskControl.riskStatus === "CAUTION"
            ? "WARNING"
            : "PASS",
      evidence: [
        `Risk status: ${input.riskControl.riskStatus}`,
        `Block new trades: ${input.riskControl.blockNewTrades}`,
        `Triggered limits: ${input.riskControl.triggeredLimits.join(", ") || "none"}`,
        `Risk replay reviewed at: ${input.riskControl.riskReplayReviewedAt ?? "not reviewed"}`,
      ],
      missingItems: [
        ...(riskReplayNotReviewed ? ["Risk replay review missing."] : []),
        ...(input.riskControl.blockNewTrades ? ["Risk engine currently blocks new trades."] : []),
      ],
      recommendation:
        input.riskControl.blockNewTrades
          ? "Clear risk blockers first; do not proceed to live."
          : "Keep risk replay and limit reviews current.",
    },
    {
      id: "incident_history",
      label: "Incident history",
      status:
        unresolvedCriticalIncidents
          ? "FAIL"
          : input.incidents.warningOpenCount > 0
            ? "WARNING"
            : "PASS",
      evidence: [
        `Open incidents: ${input.incidents.openCount}`,
        `Open warnings: ${input.incidents.warningOpenCount}`,
        `Open critical: ${input.incidents.criticalOpenCount}`,
      ],
      missingItems:
        unresolvedCriticalIncidents
          ? ["Critical incidents must be resolved before live."]
          : [],
      recommendation:
        unresolvedCriticalIncidents
          ? "Resolve critical incidents and document fixes."
          : "Keep incident backlog small and triaged.",
    },
    {
      id: "alert_status",
      label: "Alert status",
      status:
        alertOff
          ? "FAIL"
          : input.alerts.recentDeliveryFailures > 0
            ? "WARNING"
            : "PASS",
      evidence: [
        `Any channel configured: ${input.alerts.anyChannelConfigured}`,
        `Recent delivery failures: ${input.alerts.recentDeliveryFailures}`,
        `Last delivery at: ${input.alerts.lastDeliveryAt ?? "n/a"}`,
      ],
      missingItems: [
        ...(alertOff ? ["No active alert channel configured."] : []),
        ...(input.alerts.recentDeliveryFailures > 0
          ? ["Recent alert delivery failures must be addressed."]
          : []),
      ],
      recommendation:
        alertOff
          ? "Configure at least one alert channel."
          : "Run delivery smoke test and monitor failures.",
    },
    {
      id: "ledger_health",
      label: "Ledger health",
      status:
        ledgerUnhealthy
          ? "FAIL"
          : input.ledger.orphanTrades > 0 || input.ledger.brokenLinks > 0
            ? "WARNING"
            : "PASS",
      evidence: [
        `Ledger healthy: ${input.ledger.healthy}`,
        `Entry count: ${input.ledger.entryCount}`,
        `Broken links: ${input.ledger.brokenLinks}`,
        `Missing hashes: ${input.ledger.missingHashes}`,
        `Orphan trades: ${input.ledger.orphanTrades}`,
        `Last synced at: ${input.ledger.lastSyncedAt ?? "n/a"}`,
      ],
      missingItems: [
        ...(ledgerUnhealthy ? ["Ledger is unhealthy."] : []),
        ...input.ledger.issues.slice(0, 3),
      ],
      recommendation:
        ledgerUnhealthy
          ? "Repair ledger integrity issues before live decisions."
          : "Maintain append-only discipline and reconcile orphan records.",
    },
    {
      id: "operator_approval_readiness",
      label: "Operator approval readiness",
      status:
        noDoubleConfirm || input.operatorApproval.pendingApprovalActions > 12
          ? "FAIL"
          : input.operatorApproval.pendingApprovalActions > 6
            ? "WARNING"
            : "PASS",
      evidence: [
        `Double confirm required: ${input.operatorApproval.doubleConfirmRequired}`,
        `Pending approval actions: ${input.operatorApproval.pendingApprovalActions}`,
      ],
      missingItems: [
        ...(noDoubleConfirm ? ["Double confirm not enforced."] : []),
        ...(input.operatorApproval.pendingApprovalActions > 6
          ? ["High pending approval queue."]
          : []),
      ],
      recommendation:
        noDoubleConfirm
          ? "Enable double confirm and keep human approval gate mandatory."
          : "Keep operator queue lean and actionable.",
    },
    {
      id: "strategy_health",
      label: "Strategy health",
      status:
        strategyHealthBelowThreshold || input.strategyHealth.pausedCount > 0
          ? "FAIL"
          : input.strategyHealth.reviewRequiredCount > 0
            ? "WARNING"
            : "PASS",
      evidence: [
        `Health score: ${input.strategyHealth.healthScorePct}`,
        `Total strategies: ${input.strategyHealth.totalStrategies}`,
        `Healthy strategies: ${input.strategyHealth.healthyStrategies}`,
        `Review required: ${input.strategyHealth.reviewRequiredCount}`,
        `Paused: ${input.strategyHealth.pausedCount}`,
        `Candidate for live: ${input.strategyHealth.candidateForLiveCount}`,
      ],
      missingItems: [
        ...(strategyHealthBelowThreshold
          ? [
              `Health score below threshold ${thresholds.minStrategyHealthScore}.`,
            ]
          : []),
        ...(input.strategyHealth.pausedCount > 0
          ? ["Paused strategies detected."]
          : []),
      ],
      recommendation:
        strategyHealthBelowThreshold || input.strategyHealth.pausedCount > 0
          ? "Review/repair weak strategies before live pilot."
          : "Use candidate strategies only for staged promotion.",
    },
    {
      id: "exchange_connectivity",
      label: "Exchange connectivity",
      status:
        !input.exchange.configured || !input.exchange.connected
          ? "FAIL"
          : input.exchange.clockSkewMs != null && Math.abs(input.exchange.clockSkewMs) > 2_000
            ? "WARNING"
            : "PASS",
      evidence: [
        `Configured: ${input.exchange.configured}`,
        `Connected: ${input.exchange.connected}`,
        `Network: ${input.exchange.network ?? "n/a"}`,
        `Clock skew: ${input.exchange.clockSkewMs ?? "n/a"}ms`,
        `Error: ${input.exchange.error ?? "none"}`,
      ],
      missingItems: [
        ...(!input.exchange.configured ? ["Exchange credentials not configured."] : []),
        ...(input.exchange.configured && !input.exchange.connected
          ? ["Exchange configured but disconnected."]
          : []),
      ],
      recommendation:
        input.exchange.connected
          ? "Maintain stable connectivity checks and monitor auth drift."
          : "Fix exchange connectivity before any live readiness claim.",
    },
  ];

  const readinessScore = Math.round(
    (categories.reduce((sum, c) => sum + scoreForStatus(c.status), 0) / (categories.length * 10)) *
      100,
  );

  const blockers = dedupe([
    ...hardBlockers.map((b) => b.message),
    ...categories
      .filter((c) => c.status === "FAIL")
      .flatMap((c) => c.missingItems),
  ]);

  const nextRequiredActions = dedupe(
    categories
      .filter((c) => c.status !== "PASS")
      .map((c) => c.recommendation)
      .concat(hardBlockers.map((b) => b.message)),
  ).slice(0, 20);

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    categories,
    readinessScore,
    blockers,
    nextRequiredActions,
    hardBlockersTriggered: hardBlockers,
    readyForMicroLivePilot: hardBlockers.length === 0,
    safety: {
      cannotEnableLive: true,
      recommendationOnly: true,
      separateApprovalRequired: true,
    },
  };
}

export function formatLiveEvidenceReport(report: LiveEvidenceReport): LiveEvidenceReportExport {
  const lines: string[] = [
    "# Live Readiness Evidence Pack",
    `Generated: ${report.generatedAt}`,
    `Readiness score: ${report.readinessScore}/100`,
    `Ready for micro live pilot: ${report.readyForMicroLivePilot ? "YES" : "NO"}`,
    "",
    "## Blockers",
    ...(report.blockers.length ? report.blockers.map((b) => `- ${b}`) : ["- None"]),
    "",
    "## Hard blockers triggered",
    ...(report.hardBlockersTriggered.length
      ? report.hardBlockersTriggered.map((b) => `- ${b.key}: ${b.message}`)
      : ["- None"]),
    "",
    "## Next required actions",
    ...(report.nextRequiredActions.length
      ? report.nextRequiredActions.map((a) => `- ${a}`)
      : ["- None"]),
    "",
    "## Categories",
  ];

  for (const cat of report.categories) {
    lines.push(
      "",
      `### ${cat.label} — ${cat.status}`,
      ...cat.evidence.map((e) => `- Evidence: ${e}`),
      ...(cat.missingItems.length
        ? cat.missingItems.map((m) => `- Missing: ${m}`)
        : ["- Missing: none"]),
      `- Recommendation: ${cat.recommendation}`,
    );
  }

  lines.push(
    "",
    "## Safety",
    "- Evidence pack cannot enable live.",
    "- Evidence pack only recommends readiness.",
    "- Live enable requires separate approval.",
  );

  const markdown = lines.join("\n");
  const text = markdown.replace(/^#+ /gm, "");
  return { markdown, text, json: report };
}
