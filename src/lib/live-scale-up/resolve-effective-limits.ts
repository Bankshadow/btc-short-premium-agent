import { loadLivePilotRiskConfig, effectivePilotMaxNotional } from "@/lib/live-pilot/pilot-config";
import { getStageDefinition } from "./stage-definitions";
import type { EffectiveScaleLimits, LiveScaleStage } from "./types";

export function resolveEffectiveScaleLimits(
  stage: LiveScaleStage,
): EffectiveScaleLimits {
  const def = getStageDefinition(stage);
  const pilot = loadLivePilotRiskConfig();
  const envMaxNotional = effectivePilotMaxNotional(pilot);

  return {
    stage,
    tradingEnabled: def.tradingEnabled,
    maxNotionalPerTrade:
      def.tradingEnabled
        ? Math.min(def.maxNotionalPerTrade, envMaxNotional)
        : 0,
    maxDailyTrades: def.tradingEnabled
      ? Math.min(def.maxDailyTrades, pilot.dailyTradeLimit)
      : 0,
    maxDailyLoss: def.tradingEnabled
      ? Math.min(def.maxDailyLoss, pilot.dailyLossLimitUsd)
      : 0,
    maxWeeklyLoss: def.tradingEnabled
      ? Math.min(def.maxWeeklyLoss, pilot.weeklyLossLimitUsd)
      : 0,
    allowedSymbols:
      def.allowedSymbols.length > 0
        ? def.allowedSymbols
        : pilot.allowedSymbols ?? ["BTCUSDT"],
    allowedStrategies: def.allowedStrategies,
  };
}
