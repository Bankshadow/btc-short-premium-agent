import { liveExecutionStatus } from "@/lib/exchange/live-execution-gate";
import type { LivePilotRiskConfig } from "./types";

function envBool(key: string, defaultValue = false): boolean {
  const raw = process.env[key]?.trim().toLowerCase();
  if (!raw) return defaultValue;
  return raw === "true" || raw === "1" || raw === "yes";
}

function envNumber(key: string, defaultValue: number): number {
  const raw = process.env[key]?.trim();
  if (!raw) return defaultValue;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : defaultValue;
}

function parseAllowedSymbols(): string[] | null {
  const raw = process.env.LIVE_ALLOWED_SYMBOLS?.trim();
  if (!raw) return null;
  return raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

export const PILOT_DEFAULTS = {
  pilotMaxNotionalUsd: 50,
  dailyTradeLimit: 2,
  dailyLossLimitUsd: 25,
  weeklyLossLimitUsd: 75,
  cooldownMinutesAfterLoss: 60,
  liveMaxNotionalUsd: 500,
} as const;

export function loadLivePilotRiskConfig(): LivePilotRiskConfig {
  const live = liveExecutionStatus();
  const liveMax = envNumber(
    "LIVE_MAX_NOTIONAL_USD",
    PILOT_DEFAULTS.liveMaxNotionalUsd,
  );

  return {
    pilotEnabled: envBool("PILOT_ENABLED", false),
    pilotMaxNotionalUsd: envNumber(
      "PILOT_MAX_NOTIONAL_USD",
      PILOT_DEFAULTS.pilotMaxNotionalUsd,
    ),
    liveMaxNotionalUsd: liveMax,
    dailyTradeLimit: envNumber(
      "PILOT_DAILY_TRADE_LIMIT",
      PILOT_DEFAULTS.dailyTradeLimit,
    ),
    dailyLossLimitUsd: envNumber(
      "PILOT_DAILY_LOSS_LIMIT_USD",
      PILOT_DEFAULTS.dailyLossLimitUsd,
    ),
    weeklyLossLimitUsd: envNumber(
      "PILOT_WEEKLY_LOSS_LIMIT_USD",
      PILOT_DEFAULTS.weeklyLossLimitUsd,
    ),
    cooldownMinutesAfterLoss: envNumber(
      "PILOT_COOLDOWN_MINUTES_AFTER_LOSS",
      PILOT_DEFAULTS.cooldownMinutesAfterLoss,
    ),
    allowedSymbols: parseAllowedSymbols(),
    emergencyStopEnv: envBool("PILOT_EMERGENCY_STOP", false),
    requireDoubleConfirm: live.requireDoubleConfirm,
    liveExecutionEnabled: live.enabled,
    network:
      live.network === "testnet" || live.network === "mainnet"
        ? live.network
        : null,
  };
}

export function effectivePilotMaxNotional(config: LivePilotRiskConfig): number {
  return Math.min(config.pilotMaxNotionalUsd, config.liveMaxNotionalUsd);
}
