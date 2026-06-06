import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { TestnetMonitorSnapshot } from "@/lib/testnet-monitor/types";
import type { LiveTradeJournalEntry } from "@/lib/live-pilot/types";
import type { UnifiedPortfolioSnapshot } from "@/lib/portfolio/unified-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { GoalEnvironment } from "./types";

export interface GoalTradeRow {
  id: string;
  date: string;
  environment: GoalEnvironment;
  symbol: string;
  side: string;
  entry: number | null;
  exit: number | null;
  pnlUsd: number;
  result: "WIN" | "LOSS" | "BREAKEVEN" | "OPEN";
  source: string;
  reason: string;
  decisionLogId: string | null;
}

export interface GoalTradeListInput {
  entries?: DecisionLogEntry[];
  orders?: PaperOrder[];
  unifiedPortfolio?: UnifiedPortfolioSnapshot | null;
  testnetSnapshot?: TestnetMonitorSnapshot | null;
  liveTrades?: LiveTradeJournalEntry[];
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function result(pnl: number, isClosed: boolean): GoalTradeRow["result"] {
  if (!isClosed) return "OPEN";
  if (pnl > 0.0001) return "WIN";
  if (pnl < -0.0001) return "LOSS";
  return "BREAKEVEN";
}

export function buildGoalTradeList(input: GoalTradeListInput): GoalTradeRow[] {
  const reasonByDecision = new Map<string, string>();
  for (const entry of input.entries ?? []) {
    const reason =
      entry.topReasons?.[0] ??
      entry.actionPlan ??
      entry.finalVerdict ??
      "AI decision";
    reasonByDecision.set(entry.id, reason);
  }

  const rows: GoalTradeRow[] = [];

  for (const order of input.orders ?? []) {
    if (order.isDemoData) continue;
    const env: GoalEnvironment =
      order.paperMode === "RELAXED_PAPER" ? "SHADOW" : "PAPER";
    const isClosed = order.status === "CLOSED";
    const pnl = isClosed
      ? round(((order.realizedPnlPct ?? 0) / 100) * (order.notionalUsd || 0))
      : 0;
    rows.push({
      id: order.id,
      date: order.closedAt ?? order.openedAt,
      environment: env,
      symbol: order.symbol,
      side: order.side,
      entry: order.entryBtcPrice ?? null,
      exit: order.exitBtcPrice ?? null,
      pnlUsd: pnl,
      result: result(pnl, isClosed),
      source: order.openedBy,
      reason: reasonByDecision.get(order.decisionLogId) ?? "AI paper decision",
      decisionLogId: order.decisionLogId,
    });
  }

  if ((input.orders ?? []).length === 0 && input.unifiedPortfolio) {
    for (const trade of input.unifiedPortfolio.closedTrades) {
      const env: GoalEnvironment =
        trade.paperMode === "RELAXED_PAPER" ? "SHADOW" : "PAPER";
      rows.push({
        id: trade.id,
        date: trade.closedAt ?? trade.createdAt,
        environment: env,
        symbol: trade.symbol,
        side: trade.side,
        entry: trade.entryPrice ?? null,
        exit: trade.exitPrice ?? null,
        pnlUsd: round(trade.realizedPnlUsd ?? 0),
        result: result(trade.realizedPnlUsd ?? 0, true),
        source: trade.sourceAgent ?? "paper",
        reason: reasonByDecision.get(trade.decisionLogId) ?? "AI paper decision",
        decisionLogId: trade.decisionLogId ?? null,
      });
    }
  }

  for (const trade of input.testnetSnapshot?.closedTrades ?? []) {
    rows.push({
      id: trade.id,
      date: trade.closedAt,
      environment: "TESTNET",
      symbol: trade.symbol,
      side: trade.side,
      entry: trade.entryPrice || null,
      exit: trade.exitPrice || null,
      pnlUsd: round(trade.netPnl ?? 0),
      result: result(trade.netPnl ?? 0, true),
      source: trade.strategy ?? "testnet",
      reason: trade.decisionLogId
        ? reasonByDecision.get(trade.decisionLogId) ?? "Testnet execution"
        : "Testnet execution",
      decisionLogId: trade.decisionLogId,
    });
  }
  for (const pos of input.testnetSnapshot?.openPositions ?? []) {
    rows.push({
      id: pos.id,
      date: pos.openedAt,
      environment: "TESTNET",
      symbol: pos.symbol,
      side: pos.side,
      entry: pos.entryPrice || null,
      exit: null,
      pnlUsd: round(pos.unrealizedPnl ?? 0),
      result: "OPEN",
      source: pos.source,
      reason: pos.decisionLogId
        ? reasonByDecision.get(pos.decisionLogId) ?? "Open testnet position"
        : "Open testnet position",
      decisionLogId: pos.decisionLogId,
    });
  }

  for (const trade of input.liveTrades ?? []) {
    const isClosed = trade.status === "CLOSED";
    rows.push({
      id: trade.liveTradeId,
      date: trade.closedAt ?? trade.executedAt ?? trade.createdAt,
      environment: "LIVE",
      symbol: trade.symbol,
      side: trade.side,
      entry: trade.entry?.price ?? null,
      exit: trade.exit?.price ?? null,
      pnlUsd: round(trade.realizedPnl ?? 0),
      result: result(trade.realizedPnl ?? 0, isClosed),
      source: trade.pilotMode,
      reason: trade.decisionLogId
        ? reasonByDecision.get(trade.decisionLogId) ?? "Live pilot trade"
        : "Live pilot trade",
      decisionLogId: trade.decisionLogId,
    });
  }

  return rows.sort((a, b) => Date.parse(b.date || "") - Date.parse(a.date || ""));
}
