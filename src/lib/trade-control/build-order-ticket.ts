import type { AnalyzeApiResponse } from "@/lib/types/market";
import { computeSlIndexPrice } from "@/lib/decision/rules";
import { resolveConfidenceLevel } from "@/lib/decision/verdict-display";
import { agentRecToTrade } from "@/lib/agents/types";
import { strategiesSignaledOnEntry } from "@/lib/validation/classify-strategy";
import { STRATEGY_LABELS } from "@/lib/validation/validation-config";
import type { StrategyId } from "@/lib/validation/validation-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { OrderTicket } from "./trade-control-types";
import { primaryStrategyBlockedForTicket } from "@/lib/strategy-registry/strategy-registry-gates";
import { buildRegistryPayloadFromDesk } from "@/lib/strategy-registry/build-strategy-registry";
import { allowOrderTicketsInCurrentMode } from "@/lib/trading-os/trading-os-runtime";
import type { StrategyRegistryAnalyzePayload } from "@/lib/strategy-registry/strategy-registry-types";

function primaryStrategyLabel(ids: StrategyId[]): string {
  if (ids.length === 0) return "Committee TRADE";
  return STRATEGY_LABELS[ids[0]];
}

function mapSide(
  action: AnalyzeApiResponse["step6_actionPlan"]["action"],
): OrderTicket["side"] {
  if (action === "sell_call" || action === "sell_put") return "short";
  return "none";
}

function estimateTakeProfit(
  entry: number,
  sl: number,
  action: AnalyzeApiResponse["step6_actionPlan"]["action"],
): number | null {
  if (entry <= 0 || sl <= 0) return null;
  const riskDist = Math.abs(entry - sl);
  if (riskDist <= 0) return null;
  if (action === "sell_call") return Math.max(0, entry - riskDist * 0.5);
  if (action === "sell_put") return entry + riskDist * 0.5;
  return null;
}

export function buildOrderTicket(
  data: AnalyzeApiResponse,
  decisionLogId: string,
  entryForStrategy?: DecisionLogEntry,
  strategyRegistry?: StrategyRegistryAnalyzePayload | null,
): OrderTicket | null {
  const desk = data.tradingDesk;
  if (!desk) return null;
  const verdict = desk.committee.finalVerdict;
  if (verdict !== "TRADE" || desk.committee.riskVeto) return null;
  if (!allowOrderTicketsInCurrentMode()) return null;

  const plan = data.step6_actionPlan;
  if (plan.action === "no_trade") return null;

  const candidate = data.step5_verdict.candidate;
  const market = data.step1_marketSnapshot;
  const sl = plan.slIndexPrice > 0 ? plan.slIndexPrice : computeSlIndexPrice(candidate);
  const sizePct = plan.suggestedSizePct > 0 ? plan.suggestedSizePct : 1.75;
  const tradeRec = agentRecToTrade(verdict);
  const confidence = data.step5_verdict.confidence;
  const confidenceLevel = resolveConfidenceLevel(confidence, tradeRec);

  const pseudoEntry: DecisionLogEntry = entryForStrategy ?? {
    id: decisionLogId,
    timestamp: data.step5_verdict.analyzedAt,
    btcPrice: market.spotPrice,
    marketRegime: desk.marketRegime,
    agentOutputs: desk.agents,
    finalVerdict: verdict,
    riskVeto: desk.committee.riskVeto,
    topReasons: desk.committee.topReasons,
    actionPlan: plan.entryNotes,
    outcomeStatus: "PENDING",
    paperPnl: null,
    reflection: null,
  };

  const strategyIds = strategiesSignaledOnEntry(pseudoEntry);
  const strategyId = strategyIds[0] ?? null;

  const registryPayload =
    strategyRegistry ??
    (typeof window !== "undefined" ? buildRegistryPayloadFromDesk() : null);
  const ticketGate = primaryStrategyBlockedForTicket(
    strategyIds.length ? strategyIds : strategyId ? [strategyId] : [],
    registryPayload,
  );
  if (ticketGate.blocked) return null;

  return {
    id: `ticket-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    decisionLogId,
    generatedAt: data.step5_verdict.analyzedAt,
    strategy: primaryStrategyLabel(strategyIds),
    strategyId,
    symbol: candidate?.symbol ?? "BTCUSDT",
    side: mapSide(plan.action),
    instrument: plan.action,
    entryPrice: market.spotPrice,
    entryOptionMark: candidate?.markPrice ?? null,
    strike: candidate?.strike ?? null,
    stopLoss: sl,
    takeProfit: estimateTakeProfit(market.spotPrice, sl, plan.action),
    positionSizePct: sizePct,
    maxRiskPct: sizePct,
    invalidation: `BTC index beyond SL ${sl.toLocaleString()} or macro/combination flip.`,
    forcedExit: `${plan.pinExitTimeTh} TH pin · ${plan.settlementTimeTh} TH settlement`,
    confidence,
    confidenceLevel,
    topReasons: desk.committee.topReasons.slice(0, 5),
  };
}

export function formatTicketForCopy(ticket: OrderTicket): string {
  return [
    "━━ ORDER TICKET (human approval required) ━━",
    `Strategy: ${ticket.strategy}`,
    `Symbol: ${ticket.symbol} · ${ticket.instrument.replace(/_/g, " ")} · ${ticket.side}`,
    `Entry: BTC ${ticket.entryPrice.toLocaleString()}`,
    ticket.strike != null ? `Strike: ${ticket.strike.toLocaleString()}` : null,
    `SL (index): ${ticket.stopLoss.toLocaleString()}`,
    ticket.takeProfit != null
      ? `TP (est.): ${ticket.takeProfit.toLocaleString()}`
      : null,
    `Size: ${ticket.positionSizePct}% · Max risk: ${ticket.maxRiskPct}%`,
    `Confidence: ${ticket.confidence}/100 (${ticket.confidenceLevel})`,
    `Invalidation: ${ticket.invalidation}`,
    `Forced exit: ${ticket.forcedExit}`,
    "Top reasons:",
    ...ticket.topReasons.map((r, i) => `  ${i + 1}. ${r}`),
    "— Analysis only. No live order placed by desk.",
  ]
    .filter(Boolean)
    .join("\n");
}
