import { resolveExchangeCredentials } from "@/lib/exchange/exchange-config";
import type { OptionsExecutionStatus } from "./types";

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

export const OPTIONS_EXECUTION_DEFAULTS = {
  maxNotionalUsd: 500,
  maxMarginPct: 25,
  maxOpenPositions: 2,
  minHoursToExpiry: 4,
  minBidAskSpreadPct: 15,
  minContracts: 1,
} as const;

export const OPTIONS_SAFETY_NOTICE =
  "Preview only — real BTC options live execution is not implemented. OPTIONS_LIVE_ENABLED attempts are blocked.";

export function loadOptionsExecutionConfig() {
  return {
    testnetEnabled: envBool("OPTIONS_TESTNET_ENABLED", false),
    liveEnabled: envBool("OPTIONS_LIVE_ENABLED", false),
    nakedAllowed: envBool("OPTIONS_NAKED_ALLOWED", false),
    maxNotionalUsd: envNumber(
      "OPTIONS_MAX_NOTIONAL_USD",
      OPTIONS_EXECUTION_DEFAULTS.maxNotionalUsd,
    ),
    maxMarginPct: envNumber(
      "OPTIONS_MAX_MARGIN_PCT",
      OPTIONS_EXECUTION_DEFAULTS.maxMarginPct,
    ),
    maxOpenPositions: envNumber(
      "OPTIONS_MAX_OPEN_POSITIONS",
      OPTIONS_EXECUTION_DEFAULTS.maxOpenPositions,
    ),
    minHoursToExpiry: envNumber(
      "OPTIONS_MIN_HOURS_TO_EXPIRY",
      OPTIONS_EXECUTION_DEFAULTS.minHoursToExpiry,
    ),
  };
}

export function getOptionsExecutionStatus(): OptionsExecutionStatus {
  const creds = resolveExchangeCredentials();
  const config = loadOptionsExecutionConfig();

  return {
    testnetEnabled: config.testnetEnabled,
    liveEnabled: config.liveEnabled,
    liveImplemented: false,
    previewOnly: true,
    network: creds?.network ?? null,
    configured: creds !== null,
    safetyNotice: OPTIONS_SAFETY_NOTICE,
  };
}

export function blockLiveOptionsAttempt(): string | null {
  if (process.env.OPTIONS_LIVE_ENABLED?.trim().toLowerCase() === "true") {
    return "OPTIONS_LIVE_ENABLED is true but BTC options live execution is not implemented (MVP 36). Order blocked.";
  }
  return null;
}
