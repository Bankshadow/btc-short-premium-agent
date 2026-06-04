import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { StrategyConflictAnalysis } from "@/lib/data-trust/types";

export interface TradeFrequencyGovernorInput {
  entries: DecisionLogEntry[];
  conflict?: StrategyConflictAnalysis | null;
  maxTradeCandidatesPerDay?: number;
  maxFuturesSignalsPerDay?: number;
  maxAggressiveSignalsPerWeek?: number;
  cooldownAfterLossHours?: number;
  now?: Date;
}

export interface TradeFrequencyGovernorOutput {
  frequencyAllowed: boolean;
  reason?: string;
  cooldownUntil?: string;
  remainingSignalsToday: number;
  remainingFuturesToday: number;
  remainingAggressiveWeek: number;
}

function startOfDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function startOfWeek(d: Date): number {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export function checkTradeFrequency(
  input: TradeFrequencyGovernorInput,
): TradeFrequencyGovernorOutput {
  const now = input.now ?? new Date();
  const maxTrade = input.maxTradeCandidatesPerDay ?? 3;
  const maxFutures = input.maxFuturesSignalsPerDay ?? 2;
  const maxAggressive = input.maxAggressiveSignalsPerWeek ?? 5;
  const lossCooldownH = input.cooldownAfterLossHours ?? 4;

  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);

  const todayEntries = input.entries.filter(
    (e) => Date.parse(e.timestamp) >= todayStart,
  );
  const weekEntries = input.entries.filter(
    (e) => Date.parse(e.timestamp) >= weekStart,
  );

  const tradeCandidatesToday = todayEntries.filter(
    (e) => e.finalVerdict === "TRADE",
  ).length;
  const futuresToday = todayEntries.filter((e) =>
    e.agentOutputs.some(
      (a) => a.strategyType === "FUTURES" && a.recommendation === "TRADE",
    ),
  ).length;
  const aggressiveWeek = weekEntries.filter(
    (e) => e.deskRiskProfile === "aggressive" && e.finalVerdict === "TRADE",
  ).length;

  const remainingTrade = Math.max(0, maxTrade - tradeCandidatesToday);
  const remainingFutures = Math.max(0, maxFutures - futuresToday);
  const remainingAggressive = Math.max(0, maxAggressive - aggressiveWeek);

  const recentLoss = input.entries.find(
    (e) =>
      e.outcomeStatus === "RESOLVED" &&
      e.paperPnl != null &&
      e.paperPnl < 0 &&
      now.getTime() - Date.parse(e.timestamp) < lossCooldownH * 3600 * 1000,
  );

  if (input.conflict?.conflictLevel === "HIGH" || input.conflict?.conflictLevel === "CRITICAL") {
    return {
      frequencyAllowed: false,
      reason: `Active conflict ${input.conflict.conflictLevel} — no new trade candidates.`,
      remainingSignalsToday: 0,
      remainingFuturesToday: remainingFutures,
      remainingAggressiveWeek: remainingAggressive,
    };
  }

  if (recentLoss) {
    const until = new Date(
      Date.parse(recentLoss.timestamp) + lossCooldownH * 3600 * 1000,
    ).toISOString();
    return {
      frequencyAllowed: false,
      reason: "Cooldown after recent loss on decision log.",
      cooldownUntil: until,
      remainingSignalsToday: remainingTrade,
      remainingFuturesToday: remainingFutures,
      remainingAggressiveWeek: remainingAggressive,
    };
  }

  const lastOverride = input.entries.find((e) => e.operatorOverride);
  if (
    lastOverride &&
    now.getTime() - Date.parse(lastOverride.timestamp) < 2 * 3600 * 1000
  ) {
    return {
      frequencyAllowed: false,
      reason: "Cooldown after operator override (2h).",
      cooldownUntil: new Date(
        Date.parse(lastOverride.timestamp) + 2 * 3600 * 1000,
      ).toISOString(),
      remainingSignalsToday: remainingTrade,
      remainingFuturesToday: remainingFutures,
      remainingAggressiveWeek: remainingAggressive,
    };
  }

  if (tradeCandidatesToday >= maxTrade) {
    return {
      frequencyAllowed: false,
      reason: `Max ${maxTrade} TRADE candidates per day reached.`,
      remainingSignalsToday: 0,
      remainingFuturesToday: remainingFutures,
      remainingAggressiveWeek: remainingAggressive,
    };
  }

  return {
    frequencyAllowed: true,
    remainingSignalsToday: remainingTrade,
    remainingFuturesToday: remainingFutures,
    remainingAggressiveWeek: remainingAggressive,
  };
}
