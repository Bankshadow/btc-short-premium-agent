import { evaluateKillSwitch } from "@/lib/validation/kill-switch";
import { REALTIME_RISK_THRESHOLDS } from "./config";
import type {
  RealTimeRiskCheck,
  RealTimeRiskEvent,
  RealTimeRiskInput,
  RealTimeRiskReport,
  RealTimeRiskStatus,
  RiskCheckId,
} from "./types";
import { REALTIME_RISK_SAFETY_NOTICE } from "./types";

function check(
  id: RiskCheckId,
  label: string,
  status: RealTimeRiskCheck["status"],
  message: string,
  blocking: boolean,
  limitId?: string,
): RealTimeRiskCheck {
  return { id, label, status, message, blocking, limitId };
}

function resolveStatus(
  checks: RealTimeRiskCheck[],
  emergency: boolean,
): RealTimeRiskStatus {
  if (emergency) return "EMERGENCY";
  if (checks.some((c) => c.blocking && c.status === "CRITICAL")) return "EMERGENCY";
  if (checks.some((c) => c.blocking)) return "BLOCKED";
  if (checks.some((c) => c.status === "WARNING")) return "CAUTION";
  return "SAFE";
}

function pnlFromEntries(entries: RealTimeRiskInput["entries"], days: number): number {
  const since = Date.now() - days * 24 * 60 * 60 * 1000;
  return entries
    .filter((e) => new Date(e.timestamp).getTime() >= since && e.paperPnl != null)
    .reduce((s, e) => s + (e.paperPnl ?? 0), 0);
}

export function evaluateRealTimeRisk(input: RealTimeRiskInput): RealTimeRiskReport {
  const t = REALTIME_RISK_THRESHOLDS;
  const checks: RealTimeRiskCheck[] = [];
  const riskEvents: RealTimeRiskEvent[] = [];
  const triggeredLimits: string[] = [];
  const now = new Date().toISOString();

  const dailyPnlPct = input.dailyPnlPct ?? pnlFromEntries(input.entries, 1);
  const weeklyPnlPct = input.weeklyPnlPct ?? pnlFromEntries(input.entries, 7);

  const kill = evaluateKillSwitch({
    entries: input.entries,
    orders: input.orders,
    riskProfile: input.entries[0]?.deskRiskProfile ?? "balanced",
    latestAnalysis: input.market ?? null,
  });

  if (kill.tradingPaused) {
    checks.push(
      check(
        "kill_switch",
        "Kill switch",
        "CRITICAL",
        kill.messages.join("; ") || "Trading paused.",
        true,
        "kill_switch",
      ),
    );
    triggeredLimits.push("kill_switch");
  }

  const gov = input.governance;
  if (
    gov?.operatorPaused ||
    gov?.safeMode ||
    gov?.pauseAnalysis
  ) {
    checks.push(
      check(
        "governance_pause",
        "Governance pause",
        "FAIL",
        gov.operatorPauseReason || "Governance pause active.",
        true,
        "governance_pause",
      ),
    );
    triggeredLimits.push("governance_pause");
  }

  if (input.emergencyStopActive) {
    checks.push(
      check(
        "governance_pause",
        "Emergency stop",
        "CRITICAL",
        "Live pilot emergency stop active.",
        true,
        "emergency_stop",
      ),
    );
    triggeredLimits.push("emergency_stop");
  }

  const criticalIncidents = (input.incidents ?? []).filter(
    (i) =>
      i.severity === "critical" &&
      (i.status === "open" || i.status === "investigating"),
  );
  if (criticalIncidents.length > 0) {
    checks.push(
      check(
        "unresolved_incident",
        "Unresolved incident",
        "CRITICAL",
        `${criticalIncidents.length} critical incident(s) open.`,
        true,
        "unresolved_incident",
      ),
    );
    triggeredLimits.push("unresolved_incident");
  }

  if (dailyPnlPct <= t.dailyLossLimitPct) {
    checks.push(
      check(
        "daily_loss_limit",
        "Daily loss limit",
        "FAIL",
        `Daily PnL ${dailyPnlPct}% ≤ ${t.dailyLossLimitPct}%.`,
        true,
        "daily_loss_limit",
      ),
    );
    triggeredLimits.push("daily_loss_limit");
  } else if (dailyPnlPct <= t.dailyLossLimitPct * 0.7) {
    checks.push(
      check(
        "daily_loss_limit",
        "Daily loss limit",
        "WARNING",
        `Daily PnL ${dailyPnlPct}% approaching limit.`,
        false,
      ),
    );
  } else {
    checks.push(
      check("daily_loss_limit", "Daily loss limit", "PASS", `Daily PnL ${dailyPnlPct}%.`, false),
    );
  }

  const weekPnl = input.weeklyPnlPct ?? weeklyPnlPct;
  if (weekPnl <= t.weeklyLossLimitPct) {
    checks.push(
      check(
        "weekly_loss_limit",
        "Weekly loss limit",
        "FAIL",
        `Weekly PnL ${weekPnl}% ≤ ${t.weeklyLossLimitPct}%.`,
        true,
        "weekly_loss_limit",
      ),
    );
    triggeredLimits.push("weekly_loss_limit");
  } else {
    checks.push(
      check("weekly_loss_limit", "Weekly loss limit", "PASS", `Weekly PnL ${weekPnl}%.`, false),
    );
  }

  const pilotLoss = input.pilotDailyLossUsd ?? 0;
  if (pilotLoss <= -t.pilotDailyLossUsd) {
    checks.push(
      check(
        "daily_loss_limit",
        "Pilot daily USD loss",
        "FAIL",
        `Pilot daily loss $${Math.abs(pilotLoss)} exceeds $${t.pilotDailyLossUsd}.`,
        true,
        "pilot_daily_loss",
      ),
    );
    triggeredLimits.push("pilot_daily_loss");
  }

  const linearPos = input.exchangePositions ?? [];
  const paperOpen = input.orders.filter((o) => o.status === "OPEN");
  const perpOpen = input.perpPositions ?? [];
  const liveOpen = (input.liveTrades ?? []).filter(
    (t) => t.status === "OPEN" || t.status === "EXECUTED",
  );

  let totalNotional =
    linearPos.reduce((s, p) => s + p.positionValueUsd, 0) +
    paperOpen.reduce((s, o) => s + (o.notionalUsd ?? 0), 0) +
    perpOpen.reduce((s, p) => s + (p.notionalUsd ?? 0), 0) +
    liveOpen.reduce((s, t) => s + (t.entry?.notionalUsd ?? 0), 0);

  if (input.portfolio?.metrics.openExposureUsd) {
    totalNotional = Math.max(
      totalNotional,
      input.portfolio.metrics.openExposureUsd,
    );
  }

  if (totalNotional > t.maxNotionalExposureUsd) {
    checks.push(
      check(
        "max_notional_exposure",
        "Max notional exposure",
        "FAIL",
        `Exposure $${totalNotional.toFixed(0)} > cap $${t.maxNotionalExposureUsd}.`,
        true,
        "max_notional",
      ),
    );
    triggeredLimits.push("max_notional");
  } else if (totalNotional > t.maxNotionalExposureUsd * 0.85) {
    checks.push(
      check(
        "max_notional_exposure",
        "Max notional exposure",
        "WARNING",
        `Exposure $${totalNotional.toFixed(0)} near cap.`,
        false,
      ),
    );
  } else {
    checks.push(
      check(
        "max_notional_exposure",
        "Max notional exposure",
        "PASS",
        `Exposure $${totalNotional.toFixed(0)}.`,
        false,
      ),
    );
  }

  const equity =
    input.wallet?.totalEquityUsd ??
    input.portfolio?.metrics.totalEquity ??
    10_000;
  const btcExposure =
    linearPos
      .filter((p) => p.symbol.includes("BTC"))
      .reduce((s, p) => s + p.positionValueUsd, 0) +
    paperOpen
      .filter((o) => o.symbol?.includes("BTC"))
      .reduce((s, o) => s + (o.notionalUsd ?? 0), 0);
  const btcPct = equity > 0 ? (btcExposure / equity) * 100 : 0;

  if (btcPct > t.maxAssetExposurePct) {
    checks.push(
      check(
        "max_asset_exposure",
        "Max asset exposure (BTC)",
        "FAIL",
        `BTC exposure ${btcPct.toFixed(1)}% > ${t.maxAssetExposurePct}%.`,
        true,
        "max_asset_btc",
      ),
    );
    triggeredLimits.push("max_asset_btc");
  } else {
    checks.push(
      check(
        "max_asset_exposure",
        "Max asset exposure",
        "PASS",
        `BTC ${btcPct.toFixed(1)}%.`,
        false,
      ),
    );
  }

  const optionsExposure = paperOpen
    .filter((o) => o.instrument === "sell_call" || o.instrument === "sell_put")
    .reduce((s, o) => s + (o.notionalUsd ?? 0), 0);
  const optionsPct = equity > 0 ? (optionsExposure / equity) * 100 : 0;
  if (optionsPct > t.maxStrategyExposurePct) {
    checks.push(
      check(
        "max_strategy_exposure",
        "Options strategy exposure",
        "WARNING",
        `Options short premium ${optionsPct.toFixed(1)}% of equity.`,
        false,
      ),
    );
  } else {
    checks.push(
      check(
        "max_strategy_exposure",
        "Strategy exposure",
        "PASS",
        `Options ${optionsPct.toFixed(1)}%.`,
        false,
      ),
    );
  }

  const correlatedPct =
    equity > 0 ? ((btcExposure + optionsExposure) / equity) * 100 : 0;
  if (correlatedPct > t.maxCorrelatedExposurePct) {
    checks.push(
      check(
        "max_correlated_exposure",
        "Correlated BTC exposure",
        "FAIL",
        `BTC perp + options ${correlatedPct.toFixed(1)}% > ${t.maxCorrelatedExposurePct}%.`,
        true,
        "correlated_exposure",
      ),
    );
    triggeredLimits.push("correlated_exposure");
  } else {
    checks.push(
      check(
        "max_correlated_exposure",
        "Correlated exposure",
        "PASS",
        `${correlatedPct.toFixed(1)}%.`,
        false,
      ),
    );
  }

  const usdt = input.wallet?.coins.find((c) => c.coin === "USDT");
  const marginUsagePct =
    usdt && input.wallet && input.wallet.totalEquityUsd > 0
      ? ((input.wallet.totalEquityUsd - usdt.availableBalance) /
          input.wallet.totalEquityUsd) *
        100
      : null;

  if (marginUsagePct != null && marginUsagePct > t.maxMarginUsagePct) {
    checks.push(
      check(
        "margin_usage",
        "Margin usage",
        "FAIL",
        `Margin ${marginUsagePct.toFixed(1)}% > ${t.maxMarginUsagePct}%.`,
        true,
        "margin_usage",
      ),
    );
    triggeredLimits.push("margin_usage");
  } else if (marginUsagePct != null && marginUsagePct > t.maxMarginUsagePct * 0.8) {
    checks.push(
      check(
        "margin_usage",
        "Margin usage",
        "WARNING",
        `Margin ${marginUsagePct.toFixed(1)}% elevated.`,
        false,
      ),
    );
  } else {
    const hasExposure = linearPos.length > 0 || liveOpen.length > 0;
    checks.push(
      check(
        "margin_usage",
        "Margin usage",
        marginUsagePct == null && hasExposure ? "WARNING" : "PASS",
        marginUsagePct == null
          ? hasExposure
            ? "Wallet margin unknown."
            : "No margin exposure."
          : `Margin ${marginUsagePct.toFixed(1)}%.`,
        false,
      ),
    );
  }

  let minLiqDistancePct: number | null = null;
  for (const p of linearPos) {
    if (!p.liqPrice || p.markPrice <= 0) continue;
    const dist = (Math.abs(p.markPrice - p.liqPrice) / p.markPrice) * 100;
    if (minLiqDistancePct == null || dist < minLiqDistancePct) {
      minLiqDistancePct = dist;
    }
  }
  if (minLiqDistancePct != null && minLiqDistancePct < t.minLiqDistancePct) {
    checks.push(
      check(
        "liquidation_distance",
        "Liquidation distance",
        "CRITICAL",
        `Nearest liq ${minLiqDistancePct.toFixed(1)}% < ${t.minLiqDistancePct}%.`,
        true,
        "liquidation_distance",
      ),
    );
    triggeredLimits.push("liquidation_distance");
  } else {
    const hasLinear = linearPos.some((p) => p.size > 0);
    checks.push(
      check(
        "liquidation_distance",
        "Liquidation distance",
        minLiqDistancePct == null && hasLinear ? "WARNING" : "PASS",
        minLiqDistancePct == null
          ? hasLinear
            ? "No liq price on positions."
            : "No linear exposure."
          : `Min distance ${minLiqDistancePct.toFixed(1)}%.`,
        false,
      ),
    );
  }

  const regime = input.regimeBrain;
  const volShock =
    regime?.primaryRegime === "HIGH_VOLATILITY" ||
    regime?.primaryRegime === "VOL_EXPANSION" ||
    regime?.primaryRegime === "LIQUIDATION_RISK";
  if (volShock) {
    checks.push(
      check(
        "volatility_shock",
        "Volatility shock",
        "WARNING",
        `Regime ${regime?.primaryRegime} — reduce sizing.`,
        false,
      ),
    );
    riskEvents.push({
      eventId: `rte-${Date.now()}`,
      eventType: "volatility_shock",
      severity: "warning",
      message: `Regime ${regime?.primaryRegime}`,
      recordedAt: now,
      checkId: "volatility_shock",
    });
  } else {
    checks.push(
      check("volatility_shock", "Volatility shock", "PASS", "No vol shock regime.", false),
    );
  }

  const analyzedAt = input.market?.step5_verdict?.analyzedAt;
  const dataTrust = input.market?.dataTrust;
  let stale = false;
  if (analyzedAt) {
    const ageMin = (Date.now() - new Date(analyzedAt).getTime()) / 60_000;
    stale = ageMin > t.staleMarketDataMinutes;
  }
  const trustFail =
    dataTrust?.grade === "CRITICAL" ||
    (dataTrust?.score != null && dataTrust.score < t.dataTrustFailScore);
  if (trustFail || stale) {
    checks.push(
      check(
        "stale_market_data",
        "Stale / low trust data",
        trustFail ? "FAIL" : "WARNING",
        stale
          ? `Market data older than ${t.staleMarketDataMinutes}m.`
          : `Data trust score ${dataTrust?.score ?? "n/a"}.`,
        trustFail,
        "stale_market_data",
      ),
    );
    if (trustFail) triggeredLimits.push("stale_market_data");
  } else {
    checks.push(
      check("stale_market_data", "Market data freshness", "PASS", "Data current.", false),
    );
  }

  const journalSymbols = new Set(
    liveOpen.map((t) => t.symbol.toUpperCase()),
  );
  const exchangeSymbols = new Set(
    linearPos.filter((p) => p.size > 0).map((p) => p.symbol.toUpperCase()),
  );
  let mismatch = false;
  for (const sym of journalSymbols) {
    if (!exchangeSymbols.has(sym)) mismatch = true;
  }
  if (mismatch && liveOpen.length > 0) {
    checks.push(
      check(
        "live_position_mismatch",
        "Live position mismatch",
        "WARNING",
        "Journal open trades not fully matched on exchange.",
        false,
      ),
    );
  } else {
    checks.push(
      check(
        "live_position_mismatch",
        "Position reconciliation",
        "PASS",
        "Journal vs exchange aligned.",
        false,
      ),
    );
  }

  const openOrders = input.openOrders ?? [];
  const pendingLive = liveOpen.filter((t) => t.status === "EXECUTED" && !t.exchangeOrderId);
  if (pendingLive.length > 0 && openOrders.length === 0) {
    checks.push(
      check(
        "open_order_mismatch",
        "Open order mismatch",
        "WARNING",
        `${pendingLive.length} journal trade(s) without exchange order id.`,
        false,
      ),
    );
  } else {
    checks.push(
      check("open_order_mismatch", "Open orders", "PASS", "No order mismatch.", false),
    );
  }

  const budget = input.riskBudget;
  if (budget && !budget.liveTradingAllowed) {
    checks.push(
      check(
        "max_notional_exposure",
        "Risk budget",
        "FAIL",
        budget.blockReasons[0] ?? "Risk budget blocks live trading.",
        true,
        "risk_budget",
      ),
    );
    triggeredLimits.push("risk_budget");
  }

  const cc = input.commandCenter;
  if (cc?.status === "EMERGENCY" || cc?.status === "BLOCKED") {
    checks.push(
      check(
        "governance_pause",
        "Command center status",
        cc.status === "EMERGENCY" ? "CRITICAL" : "FAIL",
        cc.statusLabel,
        true,
        "command_center",
      ),
    );
    triggeredLimits.push("command_center");
  }

  const emergency =
    input.emergencyStopActive ||
    criticalIncidents.length > 0 ||
    checks.some((c) => c.status === "CRITICAL" && c.blocking);

  const riskStatus = resolveStatus(checks, emergency);
  const blockNewTrades =
    riskStatus === "BLOCKED" ||
    riskStatus === "EMERGENCY" ||
    checks.some((c) => c.blocking);
  const blockIncreaseExposure =
    blockNewTrades || riskStatus === "CAUTION" || checks.some((c) => c.id === "volatility_shock");
  const reduceOnlyMode =
    blockNewTrades ||
    gov?.safeMode === true ||
    checks.some((c) => c.id === "margin_usage" && c.blocking) ||
    checks.some((c) => c.id === "liquidation_distance" && c.blocking);

  const recommendedActions: string[] = [];
  if (reduceOnlyMode) recommendedActions.push("Enable reduce-only mode — no new exposure.");
  if (blockNewTrades) recommendedActions.push("Block new live trades until limits clear.");
  if (checks.some((c) => c.id === "margin_usage" && c.status === "WARNING")) {
    recommendedActions.push("Review margin usage on /real-time-risk.");
  }
  if (volShock) recommendedActions.push("Reduce position sizes — volatility shock regime.");

  for (const limit of triggeredLimits) {
    riskEvents.push({
      eventId: `lim-${limit}-${Date.now()}`,
      eventType: "limit_triggered",
      severity: "critical",
      message: `Limit triggered: ${limit}`,
      recordedAt: now,
    });
  }

  return {
    generatedAt: now,
    riskStatus,
    blockNewTrades,
    blockIncreaseExposure,
    reduceOnlyMode,
    recommendedActions,
    riskEvents,
    triggeredLimits,
    checks,
    metrics: {
      dailyPnlPct,
      weeklyPnlPct: weekPnl,
      totalNotionalUsd: totalNotional,
      marginUsagePct,
      minLiqDistancePct,
    },
    safetyNotice: REALTIME_RISK_SAFETY_NOTICE,
    cannotIncreaseRisk: true,
    cannotBypassGovernance: true,
  };
}
