import type { BinanceTestnetStatus } from "./binance-testnet-types";

export interface BinanceStatusDiagnostics extends BinanceTestnetStatus {
  connected: boolean;
  liveLocked: true;
  manualExecuteOnly: true;
  autoExecuteEnabled: false;
  sprint: string;
}

export function normalizeBinanceStatusDiagnostics(
  status: BinanceTestnetStatus,
  sprint = "mvp-4.6",
): BinanceStatusDiagnostics {
  return {
    ...status,
    baseUrl: status.baseUrl?.trim() || "https://demo-fapi.binance.com",
    connected: status.status === "CONNECTED",
    liveLocked: true,
    manualExecuteOnly: true,
    autoExecuteEnabled: false,
    sprint,
  };
}
