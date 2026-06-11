import type { BinanceStatusDiagnostics } from "@/lib/execution/binance-status-diagnostics";
import {
  MISSING_BINANCE_CREDENTIALS_REASON,
  MISSING_BINANCE_CREDENTIALS_RECOMMENDATION,
} from "@/lib/execution/binance-testnet-config";
import type { BinanceTestnetStatus } from "@/lib/execution/binance-testnet-types";

const DISCONNECTED_REASON = "Binance Testnet status check did not complete.";
const DISCONNECTED_RECOMMENDATION = "Refresh settings or retry the status probe.";

/** Normalize Binance status for UI display — never MISSING_ENV when keys are present. */
export function normalizeBinanceStatusForDisplay(
  status: BinanceTestnetStatus | BinanceStatusDiagnostics,
): BinanceTestnetStatus {
  const keysPresent = Boolean(status.apiKeyPresent && status.apiSecretPresent);

  if (!keysPresent) {
    return {
      ...status,
      status: "MISSING_ENV",
      reason: MISSING_BINANCE_CREDENTIALS_REASON,
      recommendation: MISSING_BINANCE_CREDENTIALS_RECOMMENDATION,
    };
  }

  if (status.status === "MISSING_ENV") {
    return {
      ...status,
      status: "DISCONNECTED",
      reason: DISCONNECTED_REASON,
      recommendation: DISCONNECTED_RECOMMENDATION,
    };
  }

  if (status.status === "PROXY_UNHEALTHY") {
    return status;
  }

  if (status.status === "AUTH_ERROR") {
    return status;
  }

  if (status.status === "API_ERROR") {
    return status;
  }

  return status;
}

export function binanceStatusForUiPanel(
  status: BinanceTestnetStatus | BinanceStatusDiagnostics | null | undefined,
): BinanceStatusDiagnostics {
  const base = status ?? {
    status: "MISSING_ENV" as const,
    testnetEnabled: false,
    liveEnabled: false,
    apiKeyPresent: false,
    apiSecretPresent: false,
    proxyEnabled: false,
    proxyUrlConfigured: false,
    serverTimeOk: false,
    lastCheckedAt: new Date().toISOString(),
    baseUrl: "https://demo-fapi.binance.com",
    reason: MISSING_BINANCE_CREDENTIALS_REASON,
    recommendation: MISSING_BINANCE_CREDENTIALS_RECOMMENDATION,
  };

  const normalized = normalizeBinanceStatusForDisplay(base);

  return {
    ...normalized,
    connected: normalized.status === "CONNECTED",
    liveLocked: true,
    manualExecuteOnly: true,
    autoExecuteEnabled: false,
    sprint: "status" in base && "sprint" in base ? (base as BinanceStatusDiagnostics).sprint : "mvp-4.6",
  };
}
