import type { DeskIncident, GovernanceDeskState } from "@/lib/governance/governance-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { DeskCloudSettings } from "@/lib/desk/desk-settings";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { OperatorOverrideLogEntry } from "@/lib/governance/governance-types";
import { evaluateHardRuleLocks } from "@/lib/governance/hard-rule-lock";
import { buildOperatorBehaviorAnalytics } from "@/lib/operator/operator-behavior-analytics";
import { buildOperatorDisciplineReport } from "@/lib/operator/operator-discipline-score";
import { evaluateKillSwitch } from "@/lib/validation/kill-switch";
import { VALIDATION_THRESHOLDS } from "@/lib/validation/validation-config";
import { computeStrictPaperMetrics } from "./strict-paper-metrics";
import { LIVE_READINESS_THRESHOLDS } from "./thresholds";
import type {
  LiveReadinessInput,
  ReadinessCategoryResult,
  ReadinessStatus,
  ServerReadinessContext,
  StrictPaperMetrics,
} from "./types";

function category(
  partial: Omit<ReadinessCategoryResult, "status" | "score"> & {
    status?: ReadinessStatus;
    score?: number;
  },
): ReadinessCategoryResult {
  const blocking = partial.blockingIssues.length;
  const status: ReadinessStatus =
    partial.status ??
    (blocking > 0 ? "FAIL" : (partial.score ?? 100) < 60 ? "WARNING" : "PASS");
  const score =
    partial.score ??
    (status === "FAIL" ? Math.min(40, 100 - blocking * 25) : status === "WARNING" ? 65 : 90);

  return {
    ...partial,
    status,
    score: Math.max(0, Math.min(100, score)),
  };
}

function evaluateDataReadiness(
  latestAnalysis: AnalyzeApiResponse | null | undefined,
): ReadinessCategoryResult {
  const reasons: string[] = [];
  const blocking: string[] = [];
  const actions: string[] = [];

  const dt = latestAnalysis?.dataTrust;
  const dq =
    latestAnalysis?.tradingDesk?.research.dataQualityScore ??
    dt?.score ??
    null;

  if (!latestAnalysis) {
    reasons.push("No recent analyze snapshot — run desk analyze first.");
    actions.push("Run Refresh now on the trading desk before live pilot.");
    return category({
      id: "data_readiness",
      label: "Data readiness",
      reasons,
      blockingIssues: [],
      recommendedActions: actions,
      status: "WARNING",
      score: 50,
    });
  }

  if (dt?.grade === "CRITICAL" || (dq != null && dq < LIVE_READINESS_THRESHOLDS.dataTrustFailScore)) {
    blocking.push(
      `Data trust below threshold (${dt?.grade ?? "score"} ${dq ?? "?"}/100).`,
    );
    actions.push("Resolve missing/stale market data before any live pilot.");
  } else if (dt?.grade === "LOW" || (dq != null && dq < LIVE_READINESS_THRESHOLDS.minDataTrustScore)) {
    reasons.push(`Data quality ${dq}/100 — below live comfort zone.`);
    actions.push("Wait for MEDIUM+ data trust or fix source errors.");
  } else {
    reasons.push(`Data trust ${dt?.grade ?? "OK"} (${dq ?? "n/a"}/100).`);
  }

  const sourceErrors = latestAnalysis.sourceErrors?.length ?? 0;
  if (sourceErrors > 0) {
    reasons.push(`${sourceErrors} source error(s) on last analyze.`);
    actions.push("Clear source errors on / desk analyze panel.");
  }

  return category({
    id: "data_readiness",
    label: "Data readiness",
    reasons,
    blockingIssues: blocking,
    recommendedActions: actions,
  });
}

function evaluatePaperPerformance(
  entries: DecisionLogEntry[],
  orders: PaperOrder[],
  backtestBridge?: import("@/lib/historical-backtest/types").BacktestReadinessBridge | null,
): { category: ReadinessCategoryResult; metrics: StrictPaperMetrics } {
  const metrics = computeStrictPaperMetrics(entries, orders);
  const reasons: string[] = [];
  const blocking: string[] = [];
  const actions: string[] = [];
  const t = LIVE_READINESS_THRESHOLDS;

  reasons.push(
    `Strict paper only: ${metrics.closedTrades} closed trades (${metrics.relaxedExcludedCount} relaxed excluded).`,
  );

  if (metrics.closedTrades === 0) {
    blocking.push("No strict paper trade history — cannot assess live readiness.");
    actions.push("Close at least 5 strict paper trades before live perp pilot.");
  } else if (metrics.closedTrades < t.minStrictClosedTrades) {
    reasons.push(
      `Only ${metrics.closedTrades} strict closes — need ${t.minStrictClosedTrades}+.`,
    );
    actions.push("Continue strict paper trading until minimum sample met.");
  }

  if (metrics.expectancy < t.minExpectancyPct) {
    blocking.push(
      `Negative strict paper expectancy (${metrics.avgPnlPct}% avg PnL).`,
    );
    actions.push("Improve strategy edge on strict paper before live capital.");
  } else {
    reasons.push(`Strict expectancy +${metrics.avgPnlPct}% avg PnL.`);
  }

  if (metrics.maxDrawdownPct > t.maxStrictDrawdownPct) {
    blocking.push(
      `Strict max drawdown ${metrics.maxDrawdownPct}% exceeds ${t.maxStrictDrawdownPct}% limit.`,
    );
    actions.push("Reduce risk or pause until drawdown recovers.");
  }

  if (backtestBridge?.hasRecentBacktest) {
    reasons.push(backtestBridge.note);
    if (backtestBridge.falseTradeCount > 3) {
      actions.push("Run /backtest rule comparison and tighten false-TRADE triggers.");
    }
    if (backtestBridge.alignmentRate < 50 && backtestBridge.sessionsReplayed >= 10) {
      reasons.push(
        `Historical backtest alignment ${backtestBridge.alignmentRate}% — rules may have drifted.`,
      );
      actions.push("Compare current vs proposed rules on /backtest before live pilot.");
    }
  } else {
    actions.push("Run historical backtest on /backtest before increasing live confidence.");
  }

  if (metrics.recentLossStreak > t.maxRecentLossStreak) {
    blocking.push(
      `Recent uncontrolled loss streak: ${metrics.recentLossStreak} strict losses.`,
    );
    actions.push("Wait for cooldown; review war room / mortem.");
  }

  if (
    metrics.closedTrades >= t.minStrictClosedTrades &&
    metrics.winRate < t.minStrictWinRatePct
  ) {
    reasons.push(`Strict win rate ${metrics.winRate}% below ${t.minStrictWinRatePct}% target.`);
    actions.push("Tune entry filters before scaling to live.");
  }

  let score = 85;
  if (blocking.length) score = 25;
  else if (metrics.closedTrades < t.minStrictClosedTrades) score = 55;
  else if (metrics.winRate < t.minStrictWinRatePct) score = 62;

  return {
    metrics,
    category: category({
      id: "paper_performance_readiness",
      label: "Paper performance readiness",
      reasons,
      blockingIssues: blocking,
      recommendedActions: actions,
      score,
    }),
  };
}

function evaluateRiskControl(
  entries: DecisionLogEntry[],
  orders: PaperOrder[],
  riskProfile: DeskRiskProfile,
  latestAnalysis: AnalyzeApiResponse | null | undefined,
  server: ServerReadinessContext,
  riskBudget?: import("@/lib/risk-budget-optimizer/types").RiskBudgetResult | null,
): ReadinessCategoryResult {
  const reasons: string[] = [];
  const blocking: string[] = [];
  const actions: string[] = [];

  const kill = evaluateKillSwitch({ entries, orders, riskProfile, latestAnalysis });
  const hard = evaluateHardRuleLocks({ entries, orders, riskProfile, data: latestAnalysis ?? undefined });

  if (kill.tradingPaused) {
    blocking.push("Kill switch / risk pause active.");
    actions.push("Clear kill switch reasons on /validation before live.");
  } else {
    reasons.push("Kill switch clear — no automatic trading pause.");
  }

  if (hard.locked) {
    blocking.push(`Hard rules locked: ${hard.activeRules.join(", ")}.`);
    actions.push("Resolve hard rule violations on /governance.");
  }

  if (server.maxLiveNotionalUsd <= 0) {
    blocking.push("Max live notional not configured.");
    actions.push("Set LIVE_MAX_NOTIONAL_USD in server environment.");
  } else if (server.maxLiveNotionalUsd > LIVE_READINESS_THRESHOLDS.maxLiveNotionalCapUsd) {
    reasons.push(
      `Max notional $${server.maxLiveNotionalUsd} — consider pilot cap ≤ $${LIVE_READINESS_THRESHOLDS.maxLiveNotionalCapUsd}.`,
    );
    actions.push("Lower LIVE_MAX_NOTIONAL_USD for initial pilot.");
  } else {
    reasons.push(`Max live notional capped at $${server.maxLiveNotionalUsd}.`);
  }

  const budget = riskBudget ?? latestAnalysis?.riskBudget ?? null;
  if (budget) {
    reasons.push(
      `Risk budget: ${budget.recommendedRiskPct}% recommended · ${budget.riskBudgetRemainingPct}% headroom.`,
    );
    if (!budget.liveTradingAllowed) {
      blocking.push(
        budget.blockReasons[0] ?? "Risk budget optimizer blocks live trading.",
      );
      actions.push("Review /risk-budget block reasons before live pilot.");
    }
    if (budget.dailyLossUsedPct >= 80) {
      reasons.push(`Daily loss budget ${budget.dailyLossUsedPct}% utilized.`);
    }
  } else {
    actions.push("Run /risk-budget optimizer for portfolio-aware sizing.");
  }

  if (!server.cronSecretConfigured && server.liveExecution.enabled) {
    blocking.push("CRON_SECRET missing — execute confirm tokens cannot be signed.");
    actions.push("Configure CRON_SECRET before enabling live execution.");
  }

  return category({
    id: "risk_control_readiness",
    label: "Risk control readiness",
    reasons,
    blockingIssues: blocking,
    recommendedActions: actions,
  });
}

function evaluateGovernance(
  governance: GovernanceDeskState | undefined,
  incidents: DeskIncident[] | undefined,
): ReadinessCategoryResult {
  const reasons: string[] = [];
  const blocking: string[] = [];
  const actions: string[] = [];
  const g = governance;

  const pauseActive =
    g?.pauseAnalysis ||
    g?.safeMode ||
    g?.operatorPaused ||
    g?.pausePaperAutoOpen;

  if (pauseActive) {
    blocking.push("Governance pause active on desk.");
    actions.push("Clear governance pause flags on /governance.");
  } else {
    reasons.push("No governance pause flags active.");
  }

  const criticalOpen = (incidents ?? []).filter(
    (i) =>
      i.severity === "critical" &&
      (i.status === "open" || i.status === "investigating"),
  );

  if (criticalOpen.length > 0) {
    blocking.push(
      `${criticalOpen.length} unresolved critical incident(s).`,
    );
    actions.push("Resolve critical incidents on /governance before live.");
  } else {
    reasons.push("No open critical incidents.");
  }

  if (g?.disableAggressiveMode) {
    reasons.push("Aggressive mode disabled by governance (expected for pilot).");
  }

  return category({
    id: "governance_readiness",
    label: "Governance readiness",
    reasons,
    blockingIssues: blocking,
    recommendedActions: actions,
  });
}

function evaluateExchange(server: ServerReadinessContext): ReadinessCategoryResult {
  const reasons: string[] = [];
  const blocking: string[] = [];
  const actions: string[] = [];
  const ex = server.exchangeStatus;
  const live = server.liveExecution;

  if (!ex.configured) {
    blocking.push("Exchange API keys not configured.");
    actions.push("Set BYBIT_API_KEY and BYBIT_API_SECRET (testnet first).");
  } else {
    reasons.push(`Exchange credentials configured (${ex.network ?? "unknown"}).`);
  }

  if (ex.configured && !ex.connected) {
    blocking.push(
      ex.error ?? "Exchange configured but not connected.",
    );
    actions.push("Verify API permissions, IP whitelist, and testnet flag.");
  } else if (ex.connected) {
    reasons.push("Exchange auth ping successful.");
  }

  if (live.enabled && ex.network === "mainnet") {
    reasons.push("Live execution enabled on MAINNET — extra caution required.");
    actions.push("Confirm intentional mainnet pilot with small notional.");
  } else if (ex.network === "testnet") {
    reasons.push("Testnet network — recommended for first live pilot.");
  }

  if (live.enabled && !ex.connected) {
    blocking.push("LIVE_EXECUTION_ENABLED but exchange not connected.");
  }

  return category({
    id: "exchange_connectivity_readiness",
    label: "Exchange connectivity readiness",
    reasons,
    blockingIssues: blocking,
    recommendedActions: actions,
  });
}

function evaluateAutomation(
  server: ServerReadinessContext,
  deskSettings: DeskCloudSettings | undefined,
): ReadinessCategoryResult {
  const reasons: string[] = [];
  const blocking: string[] = [];
  const actions: string[] = [];

  if (!server.cronSecretConfigured) {
    reasons.push("CRON_SECRET not set — scheduled automation unavailable.");
    actions.push("Set CRON_SECRET for cron analyze / desk automation.");
  } else {
    reasons.push("CRON_SECRET configured.");
  }

  const wantsSupabase = deskSettings?.syncJournalSupabase ?? true;
  if (wantsSupabase && !server.supabaseConfigured) {
    blocking.push(
      "Supabase sync expected but SUPABASE_URL / SERVICE_ROLE_KEY missing.",
    );
    actions.push("Configure Supabase or disable syncJournalSupabase in desk settings.");
  } else if (server.supabaseConfigured) {
    reasons.push("Supabase configured for server-side journal sync.");
  }

  if (!server.serverAutomationAllowed) {
    reasons.push("Test automation gated (dev or ALLOW_TEST_AUTOMATION).");
  }

  return category({
    id: "automation_readiness",
    label: "Automation readiness",
    reasons,
    blockingIssues: blocking,
    recommendedActions: actions,
  });
}

function evaluateAlerts(
  server: ServerReadinessContext,
  governance: GovernanceDeskState | undefined,
  deskSettings: DeskCloudSettings | undefined,
): ReadinessCategoryResult {
  const reasons: string[] = [];
  const blocking: string[] = [];
  const actions: string[] = [];

  const hasChannel =
    server.telegramConfigured ||
    server.discordEnvConfigured ||
    server.deskWebhookConfigured ||
    Boolean(deskSettings?.discordWebhookUrl?.trim());

  if (!hasChannel) {
    blocking.push("No alert channel configured (Telegram, Discord, or desk webhook).");
    actions.push("Configure TELEGRAM_BOT_TOKEN + CHAT_ID or DISCORD_WEBHOOK_URL.");
  } else {
    const channels: string[] = [];
    if (server.telegramConfigured) channels.push("Telegram");
    if (server.discordEnvConfigured || deskSettings?.discordWebhookUrl) {
      channels.push("Discord");
    }
    if (server.deskWebhookConfigured) channels.push("Desk webhook");
    reasons.push(`Alert channels: ${channels.join(", ")}.`);
  }

  if (governance?.disableAlerts) {
    blocking.push("Alerts disabled by governance flag.");
    actions.push("Re-enable alerts on /governance before live trading.");
  }

  return category({
    id: "alert_readiness",
    label: "Alert readiness",
    reasons,
    blockingIssues: blocking,
    recommendedActions: actions,
  });
}

function evaluateOperatorDiscipline(
  entries: DecisionLogEntry[],
  overrideLog: OperatorOverrideLogEntry[] | undefined,
): ReadinessCategoryResult {
  const reasons: string[] = [];
  const blocking: string[] = [];
  const actions: string[] = [];

  const analytics = buildOperatorBehaviorAnalytics({
    entries,
    overrideLog: overrideLog ?? [],
  });
  const report = buildOperatorDisciplineReport(analytics);
  const t = LIVE_READINESS_THRESHOLDS;

  reasons.push(
    `Operator discipline score ${report.operatorDisciplineScore}/100 (grade ${report.grade}).`,
  );

  if (report.operatorDisciplineScore < t.minOperatorDisciplineScore) {
    blocking.push(
      `Operator discipline ${report.operatorDisciplineScore} below ${t.minOperatorDisciplineScore} minimum.`,
    );
    actions.push("Reduce overrides; complete war room discipline review.");
  } else if (report.operatorDisciplineScore < t.operatorDisciplineWarningScore) {
    reasons.push("Discipline acceptable but below ideal pilot threshold.");
    actions.push("Monitor override log during live pilot.");
  }

  if (report.incidentCandidate) {
    blocking.push("Operator behavior flagged as incident candidate.");
    actions.push("Pause live plans; review override patterns on /war-room.");
  }

  if (report.suggestCooldown) {
    reasons.push("Analytics suggest operator cooldown.");
    actions.push("Take 24h paper-only cooldown before live.");
  }

  let score = report.operatorDisciplineScore;
  if (blocking.length) score = Math.min(score, 35);

  return category({
    id: "operator_discipline_readiness",
    label: "Operator discipline readiness",
    reasons,
    blockingIssues: blocking,
    recommendedActions: actions,
    score,
  });
}

function evaluateEnvironment(server: ServerReadinessContext): ReadinessCategoryResult {
  const reasons: string[] = [];
  const blocking: string[] = [];
  const actions: string[] = [];
  const live = server.liveExecution;

  if (!server.exchangeStatus.configured) {
    blocking.push("Missing exchange API keys in environment.");
    actions.push("Add BYBIT_API_KEY / BYBIT_API_SECRET to .env.local.");
  }

  if (server.maxLiveNotionalUsd <= 0) {
    blocking.push("LIVE_MAX_NOTIONAL_USD not set or invalid.");
    actions.push("Set LIVE_MAX_NOTIONAL_USD (e.g. 100–500 for pilot).");
  } else {
    reasons.push(`LIVE_MAX_NOTIONAL_USD = $${server.maxLiveNotionalUsd}.`);
  }

  if (live.enabled && !live.requireDoubleConfirm) {
    blocking.push(
      "LIVE_EXECUTION_ENABLED is true but LIVE_REQUIRE_DOUBLE_CONFIRM is disabled.",
    );
    actions.push("Set LIVE_REQUIRE_DOUBLE_CONFIRM=true (or unset) before live.");
  } else if (live.enabled) {
    reasons.push("Live execution enabled with double-confirm required.");
    actions.push("This dashboard cannot enable live — change env manually.");
  } else {
    reasons.push("LIVE_EXECUTION_ENABLED is off (safe default).");
  }

  if (live.enabled && !server.cronSecretConfigured) {
    blocking.push("Live enabled without CRON_SECRET for confirm token signing.");
  }

  return category({
    id: "environment_variable_readiness",
    label: "Environment variable readiness",
    reasons,
    blockingIssues: blocking,
    recommendedActions: actions,
  });
}

function evaluateKillSwitchCategory(
  entries: DecisionLogEntry[],
  orders: PaperOrder[],
  riskProfile: DeskRiskProfile,
  latestAnalysis: AnalyzeApiResponse | null | undefined,
): ReadinessCategoryResult {
  const reasons: string[] = [];
  const blocking: string[] = [];
  const actions: string[] = [];
  const t = VALIDATION_THRESHOLDS;

  const kill = evaluateKillSwitch({ entries, orders, riskProfile, latestAnalysis });

  reasons.push(
    `Thresholds: daily ${t.dailyLossLimitPct}%, weekly ${t.weeklyLossLimitPct}%, max DD ${t.portfolioMaxDrawdownPct}%.`,
  );

  if (kill.tradingPaused) {
    blocking.push("Kill switch active — trading paused.");
    kill.messages.forEach((m) => reasons.push(m));
    actions.push("Wait for cooldown or clear operator pause on /governance.");
  } else {
    reasons.push("Kill switch not triggered.");
    reasons.push(
      `Daily ${kill.dailyPnlPct}%, weekly ${kill.weeklyPnlPct}%, DD ${kill.peakToTroughDrawdownPct}%, streak ${kill.consecutiveLosses}.`,
    );
  }

  if (kill.cooldownUntil) {
    reasons.push(`Cooldown until ${new Date(kill.cooldownUntil).toLocaleString()}.`);
  }

  return category({
    id: "kill_switch_readiness",
    label: "Kill switch readiness",
    reasons,
    blockingIssues: blocking,
    recommendedActions: actions,
    score: kill.tradingPaused ? 20 : 92,
  });
}

export function evaluateAllCategories(
  input: LiveReadinessInput,
): { categories: ReadinessCategoryResult[]; strictPaperMetrics: StrictPaperMetrics } {
  const paper = evaluatePaperPerformance(
    input.entries,
    input.orders,
    input.backtestBridge,
  );

  const categories: ReadinessCategoryResult[] = [
    evaluateDataReadiness(input.latestAnalysis),
    paper.category,
    evaluateRiskControl(
      input.entries,
      input.orders,
      input.riskProfile,
      input.latestAnalysis,
      input.serverContext,
      input.riskBudget,
    ),
    evaluateGovernance(input.governance, input.incidents),
    evaluateExchange(input.serverContext),
    evaluateAutomation(input.serverContext, input.deskSettings),
    evaluateAlerts(input.serverContext, input.governance, input.deskSettings),
    evaluateOperatorDiscipline(input.entries, input.overrideLog),
    evaluateEnvironment(input.serverContext),
    evaluateKillSwitchCategory(
      input.entries,
      input.orders,
      input.riskProfile,
      input.latestAnalysis,
    ),
  ];

  return { categories, strictPaperMetrics: paper.metrics };
}
