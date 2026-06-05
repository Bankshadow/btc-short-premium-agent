import { buildLiveReadinessReport } from "@/lib/live-readiness/build-readiness-report";
import { LIVE_READINESS_THRESHOLDS } from "@/lib/live-readiness/thresholds";
import { buildPilotStatusSnapshot } from "@/lib/live-pilot/build-pilot-status";
import { checkTradeFrequency } from "@/lib/frequency/trade-frequency-governor";
import { buildDeskHealth } from "@/lib/operator/desk-health";
import { evaluateKillSwitch } from "@/lib/validation/kill-switch";
import { VALIDATION_THRESHOLDS } from "@/lib/validation/validation-config";
import type {
  CommandCenterBlocker,
  CommandCenterBlockerId,
  CommandCenterInput,
  CommandCenterReport,
  CommandCenterStatus,
} from "./types";
import { COMMAND_CENTER_SAFETY_NOTICE } from "./types";

function blocker(
  id: CommandCenterBlockerId,
  label: string,
  detail: string,
): CommandCenterBlocker {
  return { id, label, detail, hard: true };
}

function resolveOverallStatus(input: {
  blockers: CommandCenterBlocker[];
  cautions: string[];
  emergencyStopActive: boolean;
  criticalIncidents: number;
}): CommandCenterStatus {
  if (
    input.emergencyStopActive ||
    input.criticalIncidents > 0 ||
    input.blockers.some((b) => b.id === "pilot_emergency_stop")
  ) {
    return "EMERGENCY";
  }
  if (input.blockers.length > 0) {
    return "BLOCKED";
  }
  if (input.cautions.length > 0) {
    return "CAUTION";
  }
  return "SAFE";
}

function statusLabel(status: CommandCenterStatus): string {
  switch (status) {
    case "SAFE":
      return "Desk operational — no hard blockers";
    case "CAUTION":
      return "Elevated risk — review cautions before scaling live";
    case "BLOCKED":
      return "Hard blockers active — resolve before production scaling";
    case "EMERGENCY":
      return "Emergency state — halt live activity and review incidents";
  }
}

export function buildCommandCenterReport(
  input: CommandCenterInput,
): CommandCenterReport {
  const governance = input.governance;
  const ex = input.serverContext.exchangeStatus;
  const readiness = buildLiveReadinessReport({
    entries: input.entries,
    orders: input.orders,
    perpPositions: input.perpPositions,
    riskProfile: input.riskProfile,
    governance,
    incidents: input.incidents,
    latestAnalysis: input.latestAnalysis,
    riskBudget: input.riskBudget,
    serverContext: input.serverContext,
  });

  const killSwitch = evaluateKillSwitch({
    entries: input.entries,
    orders: input.orders,
    riskProfile: input.riskProfile,
    latestAnalysis: input.latestAnalysis,
    persisted: governance
      ? {
          operatorPaused: governance.operatorPaused,
          operatorPauseReason: governance.operatorPauseReason,
          operatorPausedAt: governance.operatorPausedAt,
          cooldownUntil: governance.cooldownUntil,
          lastTriggeredReason: null,
        }
      : undefined,
  });

  const pilotStatus = buildPilotStatusSnapshot(
    input.livePilotJournal ?? [],
    input.emergencyStopActive ?? false,
  );

  const frequency = checkTradeFrequency({
    entries: input.entries,
    conflict: input.latestAnalysis?.conflictAnalysis ?? null,
  });

  const openPaperOptions = input.orders.filter((o) => o.status === "OPEN");
  const openPerp = (input.perpPositions ?? []).filter((p) => p.status === "OPEN");
  const unified = input.paperPositions ?? [];

  const incidents = input.incidents ?? [];
  const openIncidents = incidents.filter(
    (i) => i.status === "open" || i.status === "investigating",
  );
  const criticalOpen = openIncidents.filter((i) => i.severity === "critical");

  const deskHealth = buildDeskHealth(input.latestAnalysis ?? null, {
    openPaperCount: openPaperOptions.length + openPerp.length,
  });

  const alertsDisabled = governance?.disableAlerts ?? false;
  const telegram = input.serverContext.telegramConfigured;
  const discord = input.serverContext.discordEnvConfigured;
  const deskWebhook = input.serverContext.deskWebhookConfigured;
  const anyChannel = telegram || discord || deskWebhook;

  const dataTrust = input.latestAnalysis?.dataTrust;
  const dataTrustCritical =
    dataTrust?.grade === "CRITICAL" ||
    (dataTrust?.score != null &&
      dataTrust.score < LIVE_READINESS_THRESHOLDS.dataTrustFailScore);

  const dailyLossBreached =
    killSwitch.dailyPnlPct <= VALIDATION_THRESHOLDS.dailyLossLimitPct ||
    pilotStatus.metrics.realizedPnlTodayUsd <=
      -pilotStatus.config.dailyLossLimitUsd;

  const blockers: CommandCenterBlocker[] = [];
  const cautions: string[] = [];

  if (ex.configured && !ex.connected) {
    blockers.push(
      blocker(
        "exchange_disconnected",
        "Exchange disconnected",
        ex.error ?? "Bybit auth ping failed — check keys and network.",
      ),
    );
  } else if (!ex.configured && input.serverContext.liveExecution.enabled) {
    blockers.push(
      blocker(
        "exchange_disconnected",
        "Exchange not configured",
        "LIVE_EXECUTION_ENABLED but BYBIT credentials missing.",
      ),
    );
  }

  if (killSwitch.tradingPaused) {
    blockers.push(
      blocker(
        "kill_switch_active",
        "Kill switch active",
        killSwitch.messages.join("; ") || "Trading paused by kill switch.",
      ),
    );
  }

  if (dailyLossBreached) {
    blockers.push(
      blocker(
        "daily_loss_limit_breached",
        "Daily loss limit breached",
        `Paper daily ${killSwitch.dailyPnlPct}% · pilot PnL $${pilotStatus.metrics.realizedPnlTodayUsd}`,
      ),
    );
  }

  if (criticalOpen.length > 0) {
    blockers.push(
      blocker(
        "unresolved_critical_incident",
        "Unresolved critical incident",
        `${criticalOpen.length} critical incident(s) open.`,
      ),
    );
  }

  if (readiness.overallStatus === "FAIL" || readiness.hardBlockers.length > 0) {
    blockers.push(
      blocker(
        "live_readiness_fail",
        "Live readiness fail",
        readiness.hardBlockers.slice(0, 3).join("; ") || "Readiness overall FAIL.",
      ),
    );
  }

  if (!alertsDisabled && !anyChannel) {
    blockers.push(
      blocker(
        "missing_alert_channel",
        "Missing alert channel",
        "No Telegram, Discord, or desk webhook configured.",
      ),
    );
  }

  if (governance?.operatorPaused || governance?.pauseAnalysis) {
    blockers.push(
      blocker(
        "governance_pause_active",
        "Governance pause active",
        governance.operatorPaused
          ? governance.operatorPauseReason || "Operator paused desk."
          : "Analysis pause enabled.",
      ),
    );
  }

  if (dataTrustCritical) {
    blockers.push(
      blocker(
        "data_trust_critical",
        "Data trust critical",
        dataTrust?.criticalIssues?.join("; ") ??
          `Data trust score ${dataTrust?.score ?? "n/a"} below threshold.`,
      ),
    );
  }

  if (pilotStatus.emergencyStopActive) {
    blockers.push(
      blocker(
        "pilot_emergency_stop",
        "Live pilot emergency stop",
        "Pilot emergency stop is active — live perp execution blocked.",
      ),
    );
  }

  if (readiness.overallStatus === "WARNING") {
    cautions.push("Live readiness has WARNING categories.");
  }
  if (input.riskBudget && !input.riskBudget.liveTradingAllowed) {
    cautions.push(
      input.riskBudget.blockReasons.join("; ") || "Risk budget blocks live trading.",
    );
  }
  if (!frequency.frequencyAllowed) {
    cautions.push(frequency.reason ?? "Trade frequency governor caution.");
  }
  if (governance?.safeMode) {
    cautions.push("Safe mode enabled.");
  }
  if (openIncidents.length > 0 && criticalOpen.length === 0) {
    cautions.push(`${openIncidents.length} non-critical incident(s) open.`);
  }

  const adaptation = (input.adaptationProposals ?? []).filter(
    (p) => p.status === "PENDING" || p.status === "APPROVED",
  );
  const experiments = (input.experiments ?? []).filter(
    (e) => e.status === "running" || e.status === "active" || e.status === "promotion_pending",
  );
  const pendingActions = (input.deskManagerActions ?? []).filter(
    (a) => a.status === "PENDING",
  );

  const registry = input.registry;
  const recentChanges: CommandCenterReport["panels"]["strategyRegistry"]["recentChanges"] =
    [];
  if (registry?.versionHistory) {
    for (const [strategyId, entries] of Object.entries(registry.versionHistory)) {
      const latest = entries?.[entries.length - 1];
      if (latest) {
        recentChanges.push({
          strategyId,
          status: latest.status,
          note: latest.note ?? "",
          at: latest.changedAt,
        });
      }
    }
  }
  recentChanges.sort((a, b) => b.at.localeCompare(a.at));

  const status = resolveOverallStatus({
    blockers,
    cautions,
    emergencyStopActive: pilotStatus.emergencyStopActive,
    criticalIncidents: criticalOpen.length,
  });

  return {
    generatedAt: new Date().toISOString(),
    status,
    statusLabel: statusLabel(status),
    blockers,
    cautions,
    panels: {
      systemHealth: {
        deskHealth,
        lastAnalyzedAt: deskHealth.lastAnalyzedAt,
        sourceErrorCount: deskHealth.sourceErrorCount,
        automationEnabled: input.automationEnabled ?? false,
        pauseAnalysis: governance?.pauseAnalysis ?? false,
        safeMode: governance?.safeMode ?? false,
      },
      exchangeConnectivity: {
        configured: ex.configured,
        connected: ex.connected,
        network: ex.network,
        clockSkewMs: ex.clockSkewMs,
        error: ex.error ?? null,
        linearPositionCount: ex.linearPositions?.length ?? 0,
        optionPositionCount: ex.optionPositions?.length ?? 0,
      },
      liveReadiness: {
        overallStatus: readiness.overallStatus,
        overallScore: readiness.overallScore,
        hardBlockers: readiness.hardBlockers,
        readyForSmallLivePerpPilot: readiness.readyForSmallLivePerpPilot,
      },
      riskBudget: input.riskBudget ?? null,
      openPaperPositions: {
        optionsOpen: openPaperOptions.length,
        perpOpen: openPerp.length,
        totalOpen: unified.length || openPaperOptions.length + openPerp.length,
        positions: unified,
      },
      openLivePositions: {
        pilotOpen: pilotStatus.openTrades.length,
        exchangeLinearOpen: ex.linearPositions?.length ?? 0,
        openTrades: pilotStatus.openTrades,
      },
      activeAiActions: {
        pendingDeskManager: pendingActions.length,
        pendingActions: pendingActions.slice(0, 8),
      },
      pendingApprovals: {
        adaptationPending: adaptation.length,
        adaptationProposals: adaptation.slice(0, 6),
      },
      activeExperiments: {
        running: experiments.length,
        experiments: experiments.slice(0, 6),
      },
      strategyRegistry: {
        overrideCount: Object.keys(registry?.overrides ?? {}).length,
        recentChanges: recentChanges.slice(0, 6),
      },
      alertsStatus: {
        alertsDisabled,
        telegramConfigured: telegram,
        discordConfigured: discord,
        deskWebhookConfigured: deskWebhook,
        anyChannelReady: anyChannel,
      },
      incidentStatus: {
        openCount: openIncidents.length,
        criticalOpen: criticalOpen.length,
        incidents: openIncidents.slice(0, 8),
      },
      killSwitch: {
        tradingPaused: killSwitch.tradingPaused,
        activeReasons: killSwitch.activeReasons,
        messages: killSwitch.messages,
        operatorPaused: governance?.operatorPaused ?? false,
        cooldownUntil: killSwitch.cooldownUntil,
      },
      dailyTradingLimits: {
        killSwitch: {
          dailyPnlPct: killSwitch.dailyPnlPct,
          weeklyPnlPct: killSwitch.weeklyPnlPct,
          consecutiveLosses: killSwitch.consecutiveLosses,
        },
        frequency,
        pilotTradesToday: pilotStatus.metrics.tradesToday,
        pilotDailyLossUsd: pilotStatus.metrics.realizedPnlTodayUsd,
        pilotDailyTradeLimit: pilotStatus.config.dailyTradeLimit,
        pilotDailyLossLimitUsd: pilotStatus.config.dailyLossLimitUsd,
      },
    },
    safetyNotice: COMMAND_CENTER_SAFETY_NOTICE,
    cannotIncreaseRisk: true,
    cannotAutoApproveProposals: true,
    cannotBypassGovernance: true,
  };
}
