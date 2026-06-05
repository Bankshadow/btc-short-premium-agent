import type { LiveScaleStage, ScaleStageDefinition } from "./types";

export const SCALE_STAGE_ORDER: LiveScaleStage[] = [
  "LIVE_STAGE_0_DISABLED",
  "LIVE_STAGE_1_SMOKE_TEST",
  "LIVE_STAGE_2_MICRO_SIZE",
  "LIVE_STAGE_3_SMALL_SIZE",
  "LIVE_STAGE_4_CONTROLLED_PRODUCTION",
];

export const SCALE_STAGE_DEFINITIONS: Record<LiveScaleStage, ScaleStageDefinition> = {
  LIVE_STAGE_0_DISABLED: {
    stage: "LIVE_STAGE_0_DISABLED",
    label: "Disabled",
    description: "Live perp trading disabled — default safe state.",
    maxNotionalPerTrade: 0,
    maxDailyTrades: 0,
    maxDailyLoss: 0,
    maxWeeklyLoss: 0,
    allowedSymbols: [],
    allowedStrategies: [],
    requiredClosedTrades: 0,
    requiredWinRate: 0,
    requiredMaxDrawdown: 100,
    requiredIncidentFreeDays: 0,
    requiresManualApproval: true,
    tradingEnabled: false,
  },
  LIVE_STAGE_1_SMOKE_TEST: {
    stage: "LIVE_STAGE_1_SMOKE_TEST",
    label: "Smoke test",
    description: "Single small perp trade to verify connectivity and controls.",
    maxNotionalPerTrade: 25,
    maxDailyTrades: 1,
    maxDailyLoss: 15,
    maxWeeklyLoss: 40,
    allowedSymbols: ["BTCUSDT"],
    allowedStrategies: ["futures_long", "futures_short"],
    requiredClosedTrades: 0,
    requiredWinRate: 0,
    requiredMaxDrawdown: 15,
    requiredIncidentFreeDays: 0,
    requiresManualApproval: true,
    tradingEnabled: true,
  },
  LIVE_STAGE_2_MICRO_SIZE: {
    stage: "LIVE_STAGE_2_MICRO_SIZE",
    label: "Micro size",
    description: "Micro notional with tight daily caps after smoke test success.",
    maxNotionalPerTrade: 50,
    maxDailyTrades: 2,
    maxDailyLoss: 25,
    maxWeeklyLoss: 75,
    allowedSymbols: ["BTCUSDT"],
    allowedStrategies: ["futures_long", "futures_short"],
    requiredClosedTrades: 3,
    requiredWinRate: 40,
    requiredMaxDrawdown: 12,
    requiredIncidentFreeDays: 3,
    requiresManualApproval: true,
    tradingEnabled: true,
  },
  LIVE_STAGE_3_SMALL_SIZE: {
    stage: "LIVE_STAGE_3_SMALL_SIZE",
    label: "Small size",
    description: "Small controlled production with proven pilot metrics.",
    maxNotionalPerTrade: 150,
    maxDailyTrades: 4,
    maxDailyLoss: 50,
    maxWeeklyLoss: 150,
    allowedSymbols: ["BTCUSDT", "ETHUSDT"],
    allowedStrategies: ["futures_long", "futures_short"],
    requiredClosedTrades: 8,
    requiredWinRate: 45,
    requiredMaxDrawdown: 10,
    requiredIncidentFreeDays: 7,
    requiresManualApproval: true,
    tradingEnabled: true,
  },
  LIVE_STAGE_4_CONTROLLED_PRODUCTION: {
    stage: "LIVE_STAGE_4_CONTROLLED_PRODUCTION",
    label: "Controlled production",
    description: "Highest approved perp stage — still bounded by real-time risk.",
    maxNotionalPerTrade: 500,
    maxDailyTrades: 6,
    maxDailyLoss: 100,
    maxWeeklyLoss: 300,
    allowedSymbols: ["BTCUSDT", "ETHUSDT"],
    allowedStrategies: ["futures_long", "futures_short"],
    requiredClosedTrades: 15,
    requiredWinRate: 48,
    requiredMaxDrawdown: 8,
    requiredIncidentFreeDays: 14,
    requiresManualApproval: true,
    tradingEnabled: true,
  },
};

export function getStageDefinition(stage: LiveScaleStage): ScaleStageDefinition {
  return SCALE_STAGE_DEFINITIONS[stage];
}

export function nextStage(stage: LiveScaleStage): LiveScaleStage | null {
  const idx = SCALE_STAGE_ORDER.indexOf(stage);
  if (idx < 0 || idx >= SCALE_STAGE_ORDER.length - 1) return null;
  return SCALE_STAGE_ORDER[idx + 1];
}

export function previousStage(stage: LiveScaleStage): LiveScaleStage | null {
  const idx = SCALE_STAGE_ORDER.indexOf(stage);
  if (idx <= 0) return null;
  return SCALE_STAGE_ORDER[idx - 1];
}

export function defaultScaleStage(): LiveScaleStage {
  return "LIVE_STAGE_0_DISABLED";
}
