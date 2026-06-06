import type { AnalyzeApiResponse } from "@/lib/types/market";
import {
  resolveDecisionOutcome,
  updateDecisionLogEntry,
} from "@/lib/journal/decision-log";
import {
  computeOrderPnlPct,
  tradeWouldWinFromPnl,
} from "./paper-pnl-engine";
import {
  findOrderByLogId,
  getOpenPaperOrders,
  hasOpenPaperOrder,
  loadPaperOrders,
  loadPaperSettings,
  savePaperOrder,
  updatePaperOrder,
} from "./paper-orders";
import type { AgentRecommendation } from "@/lib/agents/types";
import type { PaperOrder, PaperTradingSettings } from "./paper-order-types";
import { PAPER_ACCOUNT_NOTIONAL_USD } from "./paper-order-types";
import {
  evaluatePaperOpenEligibility,
  relaxedPaperBlocksLiveExecution,
} from "./paper-relaxed-gate";
import type { PaperOpenEligibility } from "./paper-relaxed-types";
import type { GovernanceDeskState } from "@/lib/governance/governance-types";
import { resolveRiskBudgetSizePct } from "@/lib/risk-budget-optimizer/apply-risk-budget";

function mapInstrument(
  action: AnalyzeApiResponse["step6_actionPlan"]["action"],
): PaperOrder["instrument"] {
  return action;
}

function mapSide(
  instrument: PaperOrder["instrument"],
): PaperOrder["side"] {
  if (instrument === "sell_call" || instrument === "sell_put") return "short";
  if (instrument === "no_trade") return "none";
  return "none";
}

export function evaluatePaperOpenFromAnalysis(
  data: AnalyzeApiResponse,
  settings: Partial<PaperTradingSettings> = loadPaperSettings(),
  governance?: Pick<GovernanceDeskState, "operatorPaused" | "safeMode"> | null,
): PaperOpenEligibility {
  return evaluatePaperOpenEligibility(data, settings, governance);
}

export function buildPaperOrderFromEligibility(
  data: AnalyzeApiResponse,
  decisionLogId: string,
  eligibility: PaperOpenEligibility,
): PaperOrder | null {
  if (!eligibility.eligible) return null;
  if (relaxedPaperBlocksLiveExecution(eligibility.paperMode)) {
    /* paper-only path — live execution must never consume this builder */
  }

  const plan = data.step6_actionPlan;
  const instrument = mapInstrument(plan.action);
  if (instrument === "no_trade") return null;

  const candidate = data.step5_verdict.candidate;
  const market = data.step1_marketSnapshot;
  const baseSize =
    plan.suggestedSizePct > 0 ? plan.suggestedSizePct : 1;
  const budgetCapped = resolveRiskBudgetSizePct(data, baseSize);
  const sizePct = Math.min(budgetCapped, eligibility.sizePctCap);

  const committeeVerdict =
    data.tradingDesk?.committee.finalVerdict ?? eligibility.strictVerdict;

  return {
    id: `po-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    decisionLogId,
    committeeVerdict,
    instrument,
    symbol: candidate?.symbol ?? "BTCUSDT",
    side: mapSide(instrument),
    entryBtcPrice: market.spotPrice,
    entryOptionMark: candidate?.markPrice ?? null,
    strike: candidate?.strike ?? null,
    sizePct,
    notionalUsd: PAPER_ACCOUNT_NOTIONAL_USD * (sizePct / 100),
    status: "OPEN",
    openedAt: data.step5_verdict.analyzedAt,
    closedAt: null,
    exitBtcPrice: null,
    realizedPnlPct: null,
    unrealizedPnlPct: 0,
    lastMarkAt: data.step5_verdict.analyzedAt,
    lastMarkBtcPrice: market.spotPrice,
    openedBy:
      eligibility.paperMode === "RELAXED_PAPER" &&
      eligibility.strictVerdict !== "TRADE"
        ? "relaxed_auto"
        : "committee_auto",
    notes: plan.entryNotes || data.tradingDesk?.committee.finalActionPlan || "",
    paperMode: eligibility.paperMode,
    relaxedReason: eligibility.relaxedReason,
    strictVerdict: eligibility.strictVerdict,
    relaxedVerdict: eligibility.relaxedVerdict,
  };
}

/** @deprecated Use buildPaperOrderFromEligibility — kept for strict callers */
export function buildPaperOrderFromAnalysis(
  data: AnalyzeApiResponse,
  decisionLogId: string,
): PaperOrder | null {
  const eligibility = evaluatePaperOpenEligibility(data, {
    ...loadPaperSettings(),
    paperMode: "STRICT_PAPER",
  });
  if (!eligibility.eligible || eligibility.paperMode !== "STRICT_PAPER") {
    return null;
  }
  return buildPaperOrderFromEligibility(data, decisionLogId, eligibility);
}

/** Auto-close open paper when committee flips to SKIP/WAIT (strict path only for relaxed entries). */
export function tryAutoClosePaperOnSkip(
  data: AnalyzeApiResponse,
  verdict?: AgentRecommendation,
): number {
  const finalVerdict =
    verdict ?? data.tradingDesk?.committee.finalVerdict ?? "WAIT";
  if (finalVerdict !== "SKIP" && finalVerdict !== "WAIT") return 0;

  const btc = data.step1_marketSnapshot.spotPrice;
  if (btc <= 0) return 0;

  let closed = 0;
  for (const order of getOpenPaperOrders()) {
    if (
      order.paperMode === "RELAXED_PAPER" &&
      order.strictVerdict !== "TRADE" &&
      finalVerdict === "WAIT"
    ) {
      continue;
    }
    const result = closePaperOrderAndSyncLog(order.id, {
      exitBtcPrice: btc,
      notes: `Auto-close: committee ${finalVerdict}.`,
    });
    if (result) closed += 1;
  }
  return closed;
}

function paperAutoOpenEnabled(settings: PaperTradingSettings): boolean {
  return settings.autoCreatePaperOnTrade ?? settings.autoOpenOnTrade;
}

export function tryAutoOpenPaperOrder(
  data: AnalyzeApiResponse,
  decisionLogId: string,
  governance?: Pick<GovernanceDeskState, "operatorPaused" | "safeMode"> | null,
): PaperOrder | null {
  const settings = loadPaperSettings();
  if (!paperAutoOpenEnabled(settings)) return null;
  if (hasOpenPaperOrder()) return null;
  if (findOrderByLogId(decisionLogId)) return null;

  const strictSettings = { ...settings, paperMode: "STRICT_PAPER" as const };
  const eligibility = evaluatePaperOpenEligibility(
    data,
    strictSettings,
    governance,
  );
  if (!eligibility.eligible || eligibility.strictVerdict !== "TRADE") {
    return null;
  }

  const order = buildPaperOrderFromEligibility(
    data,
    decisionLogId,
    eligibility,
  );
  if (!order) return null;

  savePaperOrder(order);
  return order;
}

/** Auto-create relaxed shadow trade on WAIT/SKIP when enabled. */
export function tryAutoOpenShadowOrder(
  data: AnalyzeApiResponse,
  decisionLogId: string,
  governance?: Pick<GovernanceDeskState, "operatorPaused" | "safeMode"> | null,
): PaperOrder | null {
  const settings = loadPaperSettings();
  if (!settings.autoCreateShadowOnWaitSkip) return null;
  if (findOrderByLogId(decisionLogId)) return null;

  const raw =
    data.tradingDesk?.committee.finalVerdict ??
    data.step5_verdict.recommendation;
  const verdict = String(raw).toUpperCase() as AgentRecommendation;
  if (verdict !== "WAIT" && verdict !== "SKIP") return null;

  const shadowSettings = {
    ...settings,
    paperMode: "RELAXED_PAPER" as const,
    autoOpenOnTrade: true,
    relaxedAllowWaitToPaperTrade: true,
  };
  const eligibility = evaluatePaperOpenEligibility(
    data,
    shadowSettings,
    governance,
  );
  if (!eligibility.eligible) return null;

  const order = buildPaperOrderFromEligibility(
    data,
    decisionLogId,
    eligibility,
  );
  if (!order) return null;

  savePaperOrder({ ...order, notes: `${order.notes} · Shadow trace`.trim() });
  return order;
}

export interface ClosePaperOrderInput {
  exitBtcPrice: number;
  notes?: string;
  tradeWouldWin?: boolean | null;
  /** When true, close only — resolution deferred to paper autopilot queue. */
  skipResolve?: boolean;
}

export interface ClosePaperOrderResult {
  order: PaperOrder;
  logSynced: boolean;
}

export function closePaperOrderAndSyncLog(
  orderId: string,
  input: ClosePaperOrderInput,
): ClosePaperOrderResult | null {
  const orders = getOpenPaperOrders();
  const existing = orders.find((o) => o.id === orderId);
  const order =
    existing ?? loadPaperOrders().find((o) => o.id === orderId && o.status === "OPEN");
  if (!order || order.status !== "OPEN") return null;

  const realized = computeOrderPnlPct(order, input.exitBtcPrice, {
    premiumCapturedPct: 0.5,
  });
  const tradeWouldWin =
    input.tradeWouldWin ??
    (order.committeeVerdict === "TRADE" || order.paperMode === "RELAXED_PAPER"
      ? tradeWouldWinFromPnl(realized)
      : null);

  const closedAt = new Date().toISOString();
  const closed: PaperOrder = {
    ...order,
    status: "CLOSED",
    closedAt,
    exitBtcPrice: input.exitBtcPrice,
    realizedPnlPct: realized,
    unrealizedPnlPct: null,
    lastMarkBtcPrice: input.exitBtcPrice,
    lastMarkAt: closedAt,
    notes: input.notes?.trim() || order.notes,
  };

  updatePaperOrder(orderId, () => closed);

  const syncNotes = [
    input.notes?.trim(),
    `Paper close @ BTC ${input.exitBtcPrice.toLocaleString()} · PnL ${realized >= 0 ? "+" : ""}${realized}%`,
    order.paperMode === "RELAXED_PAPER" ? "Relaxed paper outcome." : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (input.skipResolve) {
    return { order: closed, logSynced: false };
  }

  const outcomeLabel =
    tradeWouldWin === true ? "WIN" : tradeWouldWin === false ? "LOSS" : "BREAKEVEN";

  const resolved = resolveDecisionOutcome(
    order.decisionLogId,
    {
      btcPriceAfter: input.exitBtcPrice,
      tradeWouldWin,
      outcomeLabel,
      manualPnlPct: realized,
      notes: syncNotes || "Closed via paper trading desk.",
    },
    { evaluationSource: "paper_close" },
  );

  if (resolved) {
    updateDecisionLogEntry(order.decisionLogId, (e) => ({
      ...e,
      paperPnl: realized,
    }));
  }

  return { order: closed, logSynced: Boolean(resolved) };
}
