import type { BinanceTestnetStatus } from "./binance-testnet-types";

export interface BinanceStatusDiagnostics extends BinanceTestnetStatus {
  connected: boolean;
  liveLocked: true;
  manualExecuteOnly: true;
  autoExecuteEnabled: false;
  sprint: string;
}

/** Never show MISSING_ENV when API keys are present — use DISCONNECTED or probe result instead. */
export function resolveBinanceStatusConsistency(
  status: BinanceTestnetStatus,
): BinanceTestnetStatus {
  if (
    status.status === "MISSING_ENV" &&
    status.apiKeyPresent &&
    status.apiSecretPresent
  ) {
    return {
      ...status,
      status: "DISCONNECTED",
      reason: "Binance Testnet status check did not complete.",
      recommendation: "Refresh settings or retry the status probe.",
    };
  }
  return status;
}

export function normalizeBinanceStatusDiagnostics(
  status: BinanceTestnetStatus,
  sprint = "mvp-4.6",
): BinanceStatusDiagnostics {
  const resolved = resolveBinanceStatusConsistency(status);
  return {
    ...resolved,
    baseUrl: resolved.baseUrl?.trim() || "https://demo-fapi.binance.com",
    connected: resolved.status === "CONNECTED",
    liveLocked: true,
    manualExecuteOnly: true,
    autoExecuteEnabled: false,
    sprint,
  };
}
