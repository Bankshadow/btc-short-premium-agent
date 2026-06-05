import type { ExchangePositionSnapshot } from "@/lib/exchange/types";
import type { LiveTradeJournalEntry } from "@/lib/live-pilot/types";
import { evaluateLivePosition, aggregateRecommendation } from "./evaluate-position";
import type { LiveSupervisorInput, LiveSupervisorReport, SupervisorAlert } from "./types";
import { LIVE_SUPERVISOR_SAFETY_NOTICE } from "./types";

function findExchangePosition(
  trade: LiveTradeJournalEntry,
  positions: ExchangePositionSnapshot[],
): ExchangePositionSnapshot | null {
  const sym = trade.symbol.toUpperCase();
  return (
    positions.find(
      (p) =>
        p.symbol.toUpperCase() === sym &&
        p.size > 0 &&
        ((trade.side.toLowerCase() === "buy" && p.side === "Buy") ||
          (trade.side.toLowerCase() === "sell" && p.side === "Sell") ||
          trade.side === "LONG" ||
          trade.side === "SHORT"),
    ) ?? positions.find((p) => p.symbol.toUpperCase() === sym && p.size > 0) ?? null
  );
}

export function runLiveTradeSupervisor(
  input: LiveSupervisorInput,
): LiveSupervisorReport {
  const openTrades = input.openTrades.filter(
    (t) => t.status === "OPEN" || t.status === "EXECUTED",
  );
  const exchangePositions = input.exchangeStatus?.linearPositions ?? [];

  const positions = openTrades.map((trade) =>
    evaluateLivePosition({
      trade,
      context: input,
      exchangePos: findExchangePosition(trade, exchangePositions),
    }),
  );

  const riskAlerts: SupervisorAlert[] = [];
  for (const p of positions) {
    riskAlerts.push(...p.alerts);
  }
  if (!input.exchangeStatus?.connected) {
    riskAlerts.push({
      id: "exchange-offline",
      severity: "warning",
      category: "exchange",
      message: "Exchange not connected — position marks may be stale.",
    });
  }

  const dedupedAlerts = riskAlerts.slice(0, 24);

  return {
    generatedAt: new Date().toISOString(),
    openPositionCount: openTrades.length,
    positions,
    aggregateRecommendation: aggregateRecommendation(positions),
    riskAlerts: dedupedAlerts,
    exchangeConnected: input.exchangeStatus?.connected ?? false,
    governancePaused:
      input.governance?.operatorPaused ||
      input.governance?.safeMode ||
      input.governance?.pauseAnalysis ||
      false,
    emergencyStopActive: input.emergencyStopActive ?? false,
    autoCloseEnabled: false,
    safetyNotice: LIVE_SUPERVISOR_SAFETY_NOTICE,
  };
}
