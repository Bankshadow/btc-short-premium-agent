import { buildCapitalReport } from "@/lib/capital/build-capital-report";
import { DEFAULT_GOVERNANCE_STATE } from "@/lib/governance/governance-state";
import { computeStrictPaperMetrics } from "@/lib/live-readiness/strict-paper-metrics";
import { buildStrategyPerformanceMatrix } from "@/lib/validation/strategy-performance";
import { VALIDATION_THRESHOLDS } from "@/lib/validation/validation-config";
import type { LiveReadinessReport } from "@/lib/live-readiness/types";
import {
  REALITY_CHECK_SAFETY_NOTICE,
  REALITY_CHECK_THRESHOLDS,
} from "./reality-check-config";
import type {
  CommandCenterBlocker,
  CommandCenterBlockerId,
  CommandCenterInput,
  CommandCenterStatus,
  RealityCheckDomainStatus,
  RealityCheckItem,
  RealityCheckReport,
} from "./types";

function checkStatus(fail: boolean, warn = false): RealityCheckItem["status"] {
  if (fail) return "FAIL";
  if (warn) return "WARNING";
  return "PASS";
}

function realityBlocker(
  id: CommandCenterBlockerId,
  label: string,
  detail: string,
): CommandCenterBlocker {
  return { id, label, detail, hard: true };
}

function resolveDomainStatus(input: {
  emergency: boolean;
  hardOperationalBlock: boolean;
  liveBlocked: boolean;
  paperCaution: boolean;
  analysisCaution: boolean;
}): CommandCenterStatus {
  if (input.emergency) return "EMERGENCY";
  if (input.hardOperationalBlock) return "BLOCKED";
  if (input.liveBlocked) return "BLOCKED";
  if (input.paperCaution || input.analysisCaution) return "CAUTION";
  return "SAFE";
}

export function evaluateCommandCenterRealityCheck(input: {
  commandInput: CommandCenterInput;
  readiness: LiveReadinessReport;
  dataTrustCritical: boolean;
  emergencyStopActive: boolean;
  criticalIncidents: number;
  killSwitchPaused?: boolean;
}): RealityCheckReport {
  const { commandInput, readiness } = input;
  const governance = commandInput.governance;
  const ex = commandInput.serverContext.exchangeStatus;
  const server = commandInput.serverContext;
  const t = REALITY_CHECK_THRESHOLDS;

  const resolvedLogs = commandInput.entries.filter(
    (e) => e.outcomeStatus === "RESOLVED",
  );
  const strictPaper = computeStrictPaperMetrics(
    commandInput.entries,
    commandInput.orders,
  );
  const strategyMatrix = buildStrategyPerformanceMatrix(
    commandInput.entries,
    commandInput.orders,
    commandInput.riskProfile,
  );
  const totalResolvedSignals = strategyMatrix.reduce(
    (sum, row) => sum + row.resolvedSignals,
    0,
  );
  const strategiesBelowSample = strategyMatrix.filter(
    (row) =>
      row.totalSignals > 0 &&
      row.resolvedSignals < t.minResolvedSamplesPerStrategy,
  );
  const capital = buildCapitalReport({
    entries: commandInput.entries,
    orders: commandInput.orders,
    riskProfile: commandInput.riskProfile,
    latestAnalysis: commandInput.latestAnalysis,
  });

  const alertsDisabled = governance?.disableAlerts ?? false;
  const telegram = server.telegramConfigured;
  const discord = server.discordEnvConfigured;
  const deskWebhook = server.deskWebhookConfigured;
  const anyAlertChannel = telegram || discord || deskWebhook;

  const exchangeUnknown =
    !ex.configured || (ex.configured && !ex.connected);
  const governancePlaceholder = !governance?.workspaceId;
  const auditLocalOnly = !server.supabaseConfigured;
  const liveReadinessFailed =
    readiness.overallStatus === "FAIL" || readiness.hardBlockers.length > 0;
  const liveReadinessUnavailable = commandInput.entries.length === 0 && !commandInput.latestAnalysis;

  const checks: RealityCheckItem[] = [];

  checks.push({
    id: "no_resolved_decision_logs",
    label: "Resolved decision logs",
    status: checkStatus(resolvedLogs.length === 0),
    message:
      resolvedLogs.length === 0
        ? "No resolved decision logs — paper learning cannot be validated."
        : `${resolvedLogs.length} resolved log(s).`,
    blocksLive: true,
    affectsPaperLearning: true,
    recommendedAction: "Resolve paper outcomes",
  });

  checks.push({
    id: "no_paper_trade_history",
    label: "Paper trade history",
    status: checkStatus(strictPaper.closedTrades < t.minPaperClosedTrades),
    message:
      strictPaper.closedTrades < t.minPaperClosedTrades
        ? "No strict paper trade history — close paper trades to build edge data."
        : `${strictPaper.closedTrades} strict closed trade(s).`,
    blocksLive: true,
    affectsPaperLearning: true,
    recommendedAction: "Resolve paper outcomes",
  });

  checks.push({
    id: "strategy_sample_below_threshold",
    label: "Strategy sample size",
    status: checkStatus(strategiesBelowSample.length > 0, strategiesBelowSample.length > 0),
    message:
      strategiesBelowSample.length > 0
        ? `${strategiesBelowSample.length} strategy(ies) below ${t.minResolvedSamplesPerStrategy} resolved samples.`
        : `All signaled strategies meet ${t.minResolvedSamplesPerStrategy}+ resolved samples.`,
    blocksLive: true,
    affectsPaperLearning: true,
    recommendedAction: `Gather minimum ${t.minResolvedSamplesPerStrategy} resolved samples per strategy`,
  });

  checks.push({
    id: "validation_sample_below_threshold",
    label: "Validation sample size",
    status: checkStatus(
      totalResolvedSignals < t.minValidationResolvedSamples,
    ),
    message:
      totalResolvedSignals < t.minValidationResolvedSamples
        ? `${totalResolvedSignals} total resolved signals — need ${t.minValidationResolvedSamples}+ for validation confidence.`
        : `${totalResolvedSignals} resolved signals across strategies.`,
    blocksLive: true,
    affectsPaperLearning: true,
    recommendedAction: `Gather minimum ${VALIDATION_THRESHOLDS.minSignalsForActive} resolved samples per strategy`,
  });

  checks.push({
    id: "capital_scaling_blocked",
    label: "Capital scaling",
    status: checkStatus(!capital.scalePermission.allowed),
    message: capital.scalePermission.allowed
      ? "Capital scale permission granted on paper metrics."
      : capital.scalePermission.blockedReason ??
        "Capital scaling blocked by validation or risk controls.",
    blocksLive: true,
    affectsPaperLearning: true,
    recommendedAction: "Resolve paper outcomes",
  });

  checks.push({
    id: "supabase_sync_off",
    label: "Supabase sync",
    status: checkStatus(!server.supabaseConfigured),
    message: server.supabaseConfigured
      ? "Supabase warehouse configured."
      : "Supabase sync off — data remains browser-local only.",
    blocksLive: true,
    affectsPaperLearning: true,
    recommendedAction: "Enable Supabase sync",
  });

  checks.push({
    id: "alert_channels_off",
    label: "Alert channels",
    status: checkStatus(!anyAlertChannel && !alertsDisabled, alertsDisabled),
    message: alertsDisabled
      ? "Alerts disabled in governance — channels not required but monitoring is off."
      : anyAlertChannel
        ? "At least one alert channel configured."
        : "No Telegram, Discord, or desk webhook configured.",
    blocksLive: true,
    affectsPaperLearning: true,
    recommendedAction: "Configure Telegram/Webhook",
  });

  checks.push({
    id: "exchange_status_unknown",
    label: "Exchange status",
    status: checkStatus(exchangeUnknown),
    message: !ex.configured
      ? "Exchange not configured — live connectivity unknown."
      : ex.connected
        ? `Exchange connected (${ex.network ?? "unknown"}).`
        : ex.error ?? "Exchange configured but not connected.",
    blocksLive: true,
    affectsPaperLearning: false,
    recommendedAction: "Configure Bybit credentials and verify /api/exchange/status",
  });

  checks.push({
    id: "governance_local_placeholder",
    label: "Governance role",
    status: checkStatus(governancePlaceholder),
    message: governancePlaceholder
      ? "Operator role/name still local placeholder — no auth backend."
      : `${governance?.operatorRole ?? "OPERATOR"} · ${governance?.operatorName ?? "unknown"}`,
    blocksLive: true,
    affectsPaperLearning: true,
    recommendedAction: "Add database-backed audit",
  });

  checks.push({
    id: "audit_not_database_backed",
    label: "Audit trail",
    status: checkStatus(auditLocalOnly),
    message: auditLocalOnly
      ? "Governance audit trail is localStorage only — not warehouse-backed."
      : "Audit trail can persist to warehouse.",
    blocksLive: true,
    affectsPaperLearning: true,
    recommendedAction: "Add database-backed audit",
  });

  checks.push({
    id: "live_readiness_unavailable",
    label: "Live readiness",
    status: checkStatus(liveReadinessFailed || liveReadinessUnavailable),
    message: liveReadinessUnavailable
      ? "Live readiness unavailable — no journal or analyze snapshot."
      : liveReadinessFailed
        ? readiness.hardBlockers.slice(0, 2).join("; ") ||
          `Overall ${readiness.overallStatus}.`
        : `Live readiness ${readiness.overallStatus} (score ${readiness.overallScore}).`,
    blocksLive: true,
    affectsPaperLearning: false,
    recommendedAction: "Keep live disabled",
  });

  const failedLiveChecks = checks.filter(
    (c) => c.blocksLive && c.status === "FAIL",
  );
  const paperLearningChecks = checks.filter(
    (c) => c.affectsPaperLearning && c.status !== "PASS",
  );

  const emergency =
    input.emergencyStopActive || input.criticalIncidents > 0;
  const governancePause =
    governance?.operatorPaused === true || governance?.pauseAnalysis === true;
  const killSwitchPause = input.killSwitchPaused === true;

  const recommendedActions: string[] = [];
  if (!commandInput.latestAnalysis) {
    recommendedActions.push("Run analysis");
  }
  for (const c of checks) {
    if (c.status !== "PASS" && c.recommendedAction) {
      recommendedActions.push(c.recommendedAction);
    }
  }
  if (!server.liveExecution.enabled) {
    recommendedActions.push("Keep live disabled");
  }
  const uniqueActions = [...new Set(recommendedActions)];

  const productionBlockers: CommandCenterBlocker[] = failedLiveChecks.map(
    (c) =>
      realityBlocker(
        c.id as CommandCenterBlockerId,
        c.label,
        c.message,
      ),
  );

  const domainStatuses: RealityCheckDomainStatus = {
    liveTrading: resolveDomainStatus({
      emergency,
      hardOperationalBlock: false,
      liveBlocked: failedLiveChecks.length > 0 || liveReadinessFailed,
      paperCaution: false,
      analysisCaution: false,
    }),
    paperLearning: resolveDomainStatus({
      emergency,
      hardOperationalBlock: governancePause || killSwitchPause,
      liveBlocked: false,
      paperCaution: paperLearningChecks.length > 0,
      analysisCaution: false,
    }),
    analysisOnly: resolveDomainStatus({
      emergency,
      hardOperationalBlock: governancePause || killSwitchPause,
      liveBlocked: false,
      paperCaution: false,
      analysisCaution: input.dataTrustCritical,
    }),
  };

  const expectedProductionPosture =
    domainStatuses.liveTrading === "BLOCKED" &&
    domainStatuses.paperLearning === "CAUTION" &&
    domainStatuses.analysisOnly === "SAFE";

  return {
    generatedAt: new Date().toISOString(),
    checks,
    domainStatuses,
    productionBlockers,
    recommendedActions: uniqueActions,
    expectedProductionPosture,
    totalResolvedLogs: resolvedLogs.length,
    totalResolvedSignals,
    strategiesBelowSample: strategiesBelowSample.map((s) => s.label),
    capitalScalingAllowed: capital.scalePermission.allowed,
    supabaseConfigured: server.supabaseConfigured,
    alertChannelsReady: anyAlertChannel,
    exchangeKnown: !exchangeUnknown,
    governancePlaceholder,
    auditDatabaseBacked: !auditLocalOnly,
    liveReadinessStatus: readiness.overallStatus,
    safetyNotice: REALITY_CHECK_SAFETY_NOTICE,
    cannotEnableLive: true,
    cannotIncreaseRisk: true,
  };
}
