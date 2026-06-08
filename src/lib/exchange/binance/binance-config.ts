import type { BinanceConfig, BinanceCredentials } from "./binance-types";
import { BINANCE_PRODUCTION_HARD_BLOCK } from "./binance-types";

const TESTNET_BASE_DEFAULT = "https://demo-fapi.binance.com";

const PRODUCTION_HOSTS = [
  "fapi.binance.com",
  "api.binance.com",
  "www.binance.com",
];

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

function parseSymbolList(raw: string | undefined, fallback: string[]): string[] {
  if (!raw?.trim()) return fallback;
  return raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);
}

export function resolveBinanceUpstreamBaseUrl(): string {
  return (
    process.env.BINANCE_FUTURES_TESTNET_BASE_URL?.trim() || TESTNET_BASE_DEFAULT
  );
}

export function resolveBinanceProxyUrl(): string | null {
  const raw = process.env.BINANCE_TESTNET_PROXY_URL?.trim();
  return raw || null;
}

/** Autonomous testnet execution — testnet-only, never affects live. */
export function isBinanceTestnetAutoExecuteEnabled(): boolean {
  return envBool("BINANCE_TESTNET_AUTOEXECUTE_ENABLED", false);
}

/** Multi-timeframe chart agents + higher position caps when signals align. */
export function isMultiTimeframeAutopilotEnabled(): boolean {
  if (envBool("BINANCE_MULT_TF_AUTOPILOT", false)) return true;
  return isBinanceTestnetAutoExecuteEnabled();
}

/** API base used for HTTP calls — proxy when configured, else direct testnet. */
export function resolveBinanceEffectiveBaseUrl(): string {
  return resolveBinanceProxyUrl() ?? resolveBinanceUpstreamBaseUrl();
}

export function loadBinanceConfig(): BinanceConfig {
  const upstreamBaseUrl = resolveBinanceUpstreamBaseUrl();
  const proxyUrl = resolveBinanceProxyUrl();
  const multiTf = isMultiTimeframeAutopilotEnabled();
  return {
    testnetEnabled: envBool("BINANCE_TESTNET_ENABLED", false),
    liveEnabled: envBool("BINANCE_LIVE_ENABLED", false),
    baseUrl: proxyUrl ?? upstreamBaseUrl,
    upstreamBaseUrl,
    proxyEnabled: Boolean(proxyUrl),
    allowedSymbols: parseSymbolList(
      process.env.BINANCE_ALLOWED_SYMBOLS,
      ["BTCUSDT", "SOLUSDT", "ETHUSDT", "LINKUSDT", "DOGEUSDT"],
    ),
    maxNotionalUsd: envNumber("BINANCE_TESTNET_MAX_NOTIONAL_USD", 55),
    maxTradesPerDay: envNumber(
      "BINANCE_TESTNET_MAX_TRADES_PER_DAY",
      multiTf ? 30 : 15,
    ),
    maxOpenPositions: envNumber(
      "BINANCE_TESTNET_MAX_OPEN_POSITIONS",
      multiTf ? 30 : 3,
    ),
    requireDoubleConfirm: envBool("BINANCE_REQUIRE_DOUBLE_CONFIRM", true),
    leverage: 1,
  };
}

export function resolveBinanceCredentials(): BinanceCredentials | null {
  const apiKey = process.env.BINANCE_API_KEY?.trim();
  const apiSecret = process.env.BINANCE_API_SECRET?.trim();
  if (!apiKey || !apiSecret) return null;

  const config = loadBinanceConfig();
  return {
    apiKey,
    apiSecret,
    baseUrl: config.baseUrl,
  };
}

export function isBinanceTestnetBaseUrl(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname.toLowerCase();
    if (PRODUCTION_HOSTS.some((p) => host === p || host.endsWith(`.${p}`))) {
      return false;
    }
    return (
      host.includes("testnet") ||
      host.includes("demo-fapi") ||
      host.includes("demo.binance")
    );
  } catch {
    return false;
  }
}

/** Hard block — no production Binance order path may exist. */
export function blockBinanceProductionOrder(): string | null {
  const config = loadBinanceConfig();
  if (config.liveEnabled) {
    return `${BINANCE_PRODUCTION_HARD_BLOCK} BINANCE_LIVE_ENABLED must remain false.`;
  }
  if (!isBinanceTestnetBaseUrl(config.upstreamBaseUrl)) {
    return `${BINANCE_PRODUCTION_HARD_BLOCK} Base URL must be a testnet host.`;
  }
  return null;
}

export function assertBinanceTestnetOnly(): { allowed: boolean; blockers: string[] } {
  const blockers: string[] = [];
  const productionBlock = blockBinanceProductionOrder();
  if (productionBlock) blockers.push(productionBlock);

  const config = loadBinanceConfig();
  if (!config.testnetEnabled) {
    blockers.push(
      "BINANCE_TESTNET_ENABLED is not true — Binance testnet execution blocked.",
    );
  }

  const creds = resolveBinanceCredentials();
  if (!creds) {
    blockers.push("Binance credentials not configured (BINANCE_API_KEY/SECRET).");
  } else if (!isBinanceTestnetBaseUrl(config.upstreamBaseUrl)) {
    blockers.push(BINANCE_PRODUCTION_HARD_BLOCK);
  }

  return { allowed: blockers.length === 0, blockers };
}
