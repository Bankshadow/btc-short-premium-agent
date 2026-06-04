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
import type { PaperOrder } from "./paper-order-types";
import { PAPER_ACCOUNT_NOTIONAL_USD } from "./paper-order-types";

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

export function buildPaperOrderFromAnalysis(
  data: AnalyzeApiResponse,
  decisionLogId: string,
): PaperOrder | null {
  const desk = data.tradingDesk;
  const verdict = desk?.committee.finalVerdict ?? "WAIT";
  if (verdict !== "TRADE") return null;
  if (desk?.committee.riskVeto) return null;
  if (desk?.riskManager.veto) return null;

  const plan = data.step6_actionPlan;
  const instrument = mapInstrument(plan.action);
  if (instrument === "no_trade") return null;

  const candidate = data.step5_verdict.candidate;
  const market = data.step1_marketSnapshot;
  const sizePct = plan.suggestedSizePct > 0 ? plan.suggestedSizePct : 1;

  return {
    id: `po-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    decisionLogId,
    committeeVerdict: verdict,
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
    openedBy: "committee_auto",
    notes: plan.entryNotes || desk?.committee.finalActionPlan || "",
  };
}

/** Auto-close open paper when committee flips to SKIP/WAIT. */
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
    const result = closePaperOrderAndSyncLog(order.id, {
      exitBtcPrice: btc,
      notes: `Auto-close: committee ${finalVerdict}.`,
    });
    if (result) closed += 1;
  }
  return closed;
}

/** Open paper position when committee approves TRADE (one open position at a time). */
export function tryAutoOpenPaperOrder(
  data: AnalyzeApiResponse,
  decisionLogId: string,
): PaperOrder | null {
  const settings = loadPaperSettings();
  if (!settings.autoOpenOnTrade) return null;
  if (hasOpenPaperOrder()) return null;
  if (findOrderByLogId(decisionLogId)) return null;

  const order = buildPaperOrderFromAnalysis(data, decisionLogId);
  if (!order) return null;

  savePaperOrder(order);
  return order;
}

export interface ClosePaperOrderInput {
  exitBtcPrice: number;
  notes?: string;
  /** Override win/loss; otherwise derived from PnL */
  tradeWouldWin?: boolean | null;
}

export interface ClosePaperOrderResult {
  order: PaperOrder;
  logSynced: boolean;
}

/** Close paper order and sync PnL into linked decision log + reflection. */
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
    (order.committeeVerdict === "TRADE"
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
  ]
    .filter(Boolean)
    .join(" · ");

  const resolved = resolveDecisionOutcome(order.decisionLogId, {
    btcPriceAfter: input.exitBtcPrice,
    tradeWouldWin,
    notes: syncNotes || "Closed via paper trading desk.",
  });

  if (resolved) {
    updateDecisionLogEntry(order.decisionLogId, (e) => ({
      ...e,
      paperPnl: realized,
    }));
  }

  return { order: closed, logSynced: Boolean(resolved) };
}
