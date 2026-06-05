import type { OrderPreviewResult } from "@/lib/exchange/types";
import type { LiveTradeJournalEntry } from "@/lib/live-pilot/types";
import { resolveEffectiveScaleLimits } from "./resolve-effective-limits";
import type { EffectiveScaleLimits, LiveScaleStage } from "./types";

export function checkScaleUpGuards(input: {
  stage: LiveScaleStage;
  preview: OrderPreviewResult;
  journal: LiveTradeJournalEntry[];
  isCloseOrder?: boolean;
  strategyId?: string | null;
}): { allowed: boolean; blockers: string[]; warnings: string[]; limits: EffectiveScaleLimits } {
  const limits = resolveEffectiveScaleLimits(input.stage);
  const blockers: string[] = [];
  const warnings: string[] = [];

  if (input.preview.category === "option") {
    blockers.push("BTC options live excluded from scale-up framework.");
    return { allowed: false, blockers, warnings, limits };
  }

  if (!input.isCloseOrder && !limits.tradingEnabled) {
    blockers.push(`Live scale stage ${input.stage} — trading disabled.`);
  }

  if (!input.isCloseOrder && limits.maxNotionalPerTrade <= 0) {
    blockers.push("Stage max notional is zero — promote stage to enable trading.");
  }

  if (
    !input.isCloseOrder &&
    input.preview.estNotionalUsd > limits.maxNotionalPerTrade
  ) {
    blockers.push(
      `Notional $${input.preview.estNotionalUsd.toFixed(2)} exceeds stage cap $${limits.maxNotionalPerTrade}.`,
    );
  }

  const symbol = input.preview.symbol.toUpperCase();
  if (
    !input.isCloseOrder &&
    limits.allowedSymbols.length > 0 &&
    !limits.allowedSymbols.includes(symbol)
  ) {
    blockers.push(`Symbol ${symbol} not allowed at stage ${input.stage}.`);
  }

  const strategy = input.strategyId ?? inferStrategyFromPreview(input.preview);
  if (
    !input.isCloseOrder &&
    strategy &&
    limits.allowedStrategies.length > 0 &&
    !limits.allowedStrategies.includes(strategy)
  ) {
    blockers.push(`Strategy ${strategy} not allowed at current live stage.`);
  }

  const dayStart = startOfDayMs();
  const todayTrades = input.journal.filter((j) => {
    const ts = Date.parse(j.executedAt ?? j.createdAt);
    return (
      ts >= dayStart &&
      (j.status === "EXECUTED" || j.status === "OPEN" || j.status === "CLOSED")
    );
  });
  if (!input.isCloseOrder && todayTrades.length >= limits.maxDailyTrades) {
    blockers.push(
      `Daily trade limit reached (${todayTrades.length}/${limits.maxDailyTrades}).`,
    );
  }

  const closedToday = input.journal.filter(
    (j) =>
      j.status === "CLOSED" &&
      j.closedAt &&
      Date.parse(j.closedAt) >= dayStart,
  );
  const dailyLoss = closedToday.reduce((s, j) => s + (j.realizedPnl ?? 0), 0);
  if (!input.isCloseOrder && dailyLoss <= -limits.maxDailyLoss) {
    blockers.push(
      `Daily loss $${Math.abs(dailyLoss).toFixed(2)} breached stage cap $${limits.maxDailyLoss}.`,
    );
  }

  if (input.stage === "LIVE_STAGE_1_SMOKE_TEST" && !input.isCloseOrder) {
    warnings.push("Smoke test stage — single trade per day only.");
  }

  return {
    allowed: blockers.length === 0,
    blockers,
    warnings,
    limits,
  };
}

function inferStrategyFromPreview(preview: OrderPreviewResult): string | null {
  if (preview.category !== "linear") return null;
  const side = preview.side?.toLowerCase();
  if (side === "buy") return "futures_long";
  if (side === "sell") return "futures_short";
  return null;
}

function startOfDayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
