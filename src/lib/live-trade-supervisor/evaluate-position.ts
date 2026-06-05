import { VALIDATION_THRESHOLDS } from "@/lib/validation/validation-config";
import type {
  LiveSupervisorInput,
  PositionHealth,
  SupervisorAction,
  SupervisorAlert,
  SupervisorPositionReport,
  ThesisValidity,
} from "./types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { LiveTradeJournalEntry } from "@/lib/live-pilot/types";
import type { ExchangePositionSnapshot } from "@/lib/exchange/types";

function newAlert(
  category: string,
  message: string,
  severity: SupervisorAlert["severity"],
): SupervisorAlert {
  return {
    id: `${category}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
    category,
    message,
    severity,
  };
}

function resolveStopTakeProfit(
  entry: DecisionLogEntry | null,
  trade: LiveTradeJournalEntry,
): { stopLoss: number | null; takeProfit: number | null } {
  const ticket = entry?.orderTicket;
  if (ticket) {
    return { stopLoss: ticket.stopLoss, takeProfit: ticket.takeProfit };
  }
  const entryPrice = trade.entry?.price ?? 0;
  if (entryPrice <= 0) return { stopLoss: null, takeProfit: null };
  const isLong = trade.side.toLowerCase() === "buy" || trade.side === "LONG";
  const sl = isLong ? entryPrice * 0.97 : entryPrice * 1.03;
  const tp = isLong ? entryPrice * 1.02 : entryPrice * 0.98;
  return { stopLoss: sl, takeProfit: tp };
}

function buildHealth(
  trade: LiveTradeJournalEntry,
  exchangePos: ExchangePositionSnapshot | null,
  entry: DecisionLogEntry | null,
  marketPrice: number,
): PositionHealth {
  const entryPrice = trade.entry?.price ?? exchangePos?.avgPrice ?? 0;
  const mark = exchangePos?.markPrice ?? marketPrice ?? entryPrice;
  const notional = trade.entry?.notionalUsd ?? exchangePos?.positionValueUsd ?? 0;
  const qty = trade.entry?.qty ?? exchangePos?.size ?? 0;
  const { stopLoss, takeProfit } = resolveStopTakeProfit(entry, trade);

  let unrealizedUsd = exchangePos?.unrealisedPnl ?? 0;
  if (!exchangePos && entryPrice > 0 && mark > 0) {
    const dir = trade.side.toLowerCase() === "buy" || trade.side === "LONG" ? 1 : -1;
    unrealizedUsd = dir * (mark - entryPrice) * qty;
  }
  const unrealizedPct =
    notional > 0 ? Number(((unrealizedUsd / notional) * 100).toFixed(2)) : 0;

  let stopLossProximityPct: number | null = null;
  if (stopLoss && mark > 0) {
    stopLossProximityPct = Number(
      (Math.abs(mark - stopLoss) / mark * 100).toFixed(2),
    );
  }

  const isLong = trade.side.toLowerCase() === "buy" || trade.side === "LONG";
  const takeProfitReached =
    takeProfit != null &&
    (isLong ? mark >= takeProfit : mark <= takeProfit);

  let healthScore = 70;
  if (unrealizedPct < -3) healthScore -= 25;
  else if (unrealizedPct > 2) healthScore += 10;
  if (stopLossProximityPct != null && stopLossProximityPct < 1.5) healthScore -= 30;
  if (takeProfitReached) healthScore += 15;
  healthScore = Math.max(0, Math.min(100, healthScore));

  return {
    liveTradeId: trade.liveTradeId,
    symbol: trade.symbol,
    side: trade.side,
    entryPrice,
    markPrice: mark,
    unrealizedPnlUsd: Number(unrealizedUsd.toFixed(2)),
    unrealizedPnlPct: unrealizedPct,
    notionalUsd: notional,
    stopLoss,
    takeProfit,
    stopLossProximityPct,
    takeProfitReached,
    healthScore,
  };
}

function evaluateThesis(
  entry: DecisionLogEntry | null,
  input: LiveSupervisorInput,
): ThesisValidity {
  const originalRegime = entry?.marketRegime ?? "Unknown";
  const currentRegime =
    input.regimeBrain?.deskLabel ?? input.market?.symbol ?? "Unknown";
  const reasons: string[] = [];
  let score = 75;

  if (!entry) {
    return {
      score: 50,
      valid: true,
      originalRegime,
      currentRegime,
      reasons: ["No linked decision log — thesis check limited."],
    };
  }

  if (input.regimeBrain?.blockedStrategies.length) {
    score -= 20;
    reasons.push("Regime brain now blocks prior strategy routing.");
  }
  if (
    input.regimeBrain &&
    /bear|risk-off|liquidation/i.test(input.regimeBrain.primaryRegime) &&
    /bull|risk-on/i.test(originalRegime)
  ) {
    score -= 35;
    reasons.push("Regime flipped adverse to entry thesis.");
  }

  const bearAgents = entry.agentOutputs.filter(
    (a) => a.recommendation === "SKIP" && a.strategyType === "THESIS",
  );
  if (bearAgents.length >= 2) {
    score -= 15;
    reasons.push("Original session had strong bear thesis signals.");
  }

  if (entry.riskVeto) {
    score -= 10;
    reasons.push("Entry occurred despite risk veto flag on log.");
  }

  return {
    score: Math.max(0, Math.min(100, score)),
    valid: score >= 55,
    originalRegime,
    currentRegime,
    reasons,
  };
}

function committeeWouldFlip(
  entry: DecisionLogEntry | null,
  input: LiveSupervisorInput,
): boolean {
  if (!entry) return false;
  if (entry.finalVerdict !== "TRADE") return false;
  if (input.dataTrust?.grade === "CRITICAL") return true;
  if (input.regimeBrain?.tradeFrequencyRecommendation === "PAUSE") return true;
  if (input.riskBudget && !input.riskBudget.liveTradingAllowed) return true;
  if (input.governance?.safeMode || input.governance?.operatorPaused) return true;
  return false;
}

export function evaluateLivePosition(input: {
  trade: LiveTradeJournalEntry;
  context: LiveSupervisorInput;
  exchangePos?: ExchangePositionSnapshot | null;
}): SupervisorPositionReport {
  const { trade, context } = input;
  const entry =
    context.entries?.find((e) => e.id === trade.decisionLogId) ?? null;
  const marketPrice = context.market?.spotPrice ?? 0;
  const health = buildHealth(trade, input.exchangePos ?? null, entry, marketPrice);
  const thesis = evaluateThesis(entry, context);
  const alerts: SupervisorAlert[] = [];
  const rationale: string[] = [];

  if (health.stopLossProximityPct != null && health.stopLossProximityPct < 2) {
    alerts.push(
      newAlert(
        "stop_loss",
        `Price within ${health.stopLossProximityPct}% of stop loss.`,
        "critical",
      ),
    );
    rationale.push("Stop loss proximity critical.");
  }

  if (health.takeProfitReached) {
    alerts.push(
      newAlert("take_profit", "Take profit zone reached.", "info"),
    );
    rationale.push("Take profit target reached — consider reduce or close.");
  }

  if (health.unrealizedPnlPct <= -5) {
    alerts.push(
      newAlert(
        "drawdown",
        `Position drawdown ${health.unrealizedPnlPct}%.`,
        "warning",
      ),
    );
    rationale.push("Position drawdown elevated.");
  }

  const hv = context.market?.hv30 ?? 0;
  if (hv >= 40) {
    alerts.push(
      newAlert("volatility", `HV30 ${hv} — volatility shock.`, "warning"),
    );
    rationale.push("Volatility shock detected.");
  }

  if (context.market?.fundingRate != null && context.entryFundingRate != null) {
    const delta = Math.abs(
      context.market.fundingRate - context.entryFundingRate,
    );
    if (delta > 0.0005) {
      alerts.push(
        newAlert(
          "funding",
          `Funding moved materially (Δ ${(delta * 100).toFixed(3)}%).`,
          "warning",
        ),
      );
      rationale.push("Funding rate changed materially.");
    }
  }

  if (
    context.market &&
    context.entryLiquidation24h != null &&
    (context.market as { liquidation24h?: number }).liquidation24h
  ) {
    const currentLiq =
      (context.market as { liquidation24h?: number }).liquidation24h ?? 0;
    if (currentLiq > context.entryLiquidation24h * 1.5) {
      alerts.push(
        newAlert(
          "liquidation",
          "Liquidation cluster risk increased vs entry.",
          "critical",
        ),
      );
      rationale.push("Liquidation risk elevated.");
    }
  }

  if (
    entry?.topReasons.some((r) => /macro|fomc|cpi/i.test(r)) ||
    context.governance?.pauseAnalysis
  ) {
    alerts.push(
      newAlert("macro", "Macro or governance event window active.", "warning"),
    );
  }

  if (context.dataTrust?.grade === "CRITICAL") {
    alerts.push(
      newAlert("data_trust", "Data trust degraded to CRITICAL.", "critical"),
    );
    rationale.push("Data trust degraded.");
  } else if (context.dataTrust?.grade === "LOW") {
    alerts.push(
      newAlert("data_trust", "Data trust LOW — review position.", "warning"),
    );
  }

  if (committeeWouldFlip(entry, context)) {
    alerts.push(
      newAlert(
        "committee",
        "Desk would likely flip verdict if re-run now.",
        "warning",
      ),
    );
    rationale.push("Committee would flip verdict.");
  }

  if (!thesis.valid) {
    alerts.push(
      newAlert("thesis", "Entry thesis no longer valid.", "critical"),
    );
    rationale.push("Thesis invalid.");
  }

  if (context.riskBudget && !context.riskBudget.liveTradingAllowed) {
    alerts.push(
      newAlert("risk_budget", "Risk budget blocks new/live risk.", "warning"),
    );
  }

  if (context.emergencyStopActive || context.governance?.operatorPaused) {
    alerts.push(
      newAlert("governance", "Emergency or governance pause active.", "critical"),
    );
  }

  let recommendation: SupervisorAction = "HOLD";
  const criticalCount = alerts.filter((a) => a.severity === "critical").length;

  if (
    context.emergencyStopActive &&
    health.unrealizedPnlPct <= VALIDATION_THRESHOLDS.aggressiveMaxLossPct
  ) {
    recommendation = "EMERGENCY_BLOCK";
  } else if (
    criticalCount >= 2 ||
    (health.stopLossProximityPct != null && health.stopLossProximityPct < 1) ||
    !thesis.valid
  ) {
    recommendation = "CLOSE";
  } else if (
    health.takeProfitReached ||
    health.unrealizedPnlPct <= -3 ||
    criticalCount >= 1
  ) {
    recommendation = "REDUCE";
  } else if (
    committeeWouldFlip(entry, context) ||
    alerts.some((a) => a.category === "volatility")
  ) {
    recommendation = "REVIEW_REQUIRED";
  } else if (
    alerts.some((a) => a.category === "funding" || a.category === "liquidation")
  ) {
    recommendation = "HEDGE";
  }

  const confidence = Math.min(
    95,
    Math.round(
      40 +
        health.healthScore * 0.3 +
        thesis.score * 0.3 -
        criticalCount * 8,
    ),
  );

  return {
    liveTradeId: trade.liveTradeId,
    journalEntry: trade,
    decisionLogEntry: entry,
    health,
    thesis,
    recommendation,
    confidence,
    alerts,
    rationale,
    requiresHumanApproval: true,
    canIncreaseExposure: false,
    canOpenNewPosition: false,
  };
}

export function aggregateRecommendation(
  positions: SupervisorPositionReport[],
): SupervisorAction {
  const priority: SupervisorAction[] = [
    "EMERGENCY_BLOCK",
    "CLOSE",
    "REDUCE",
    "REVIEW_REQUIRED",
    "HEDGE",
    "HOLD",
  ];
  for (const action of priority) {
    if (positions.some((p) => p.recommendation === action)) return action;
  }
  return "HOLD";
}
