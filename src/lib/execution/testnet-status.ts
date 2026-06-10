import { isTestnetConfigured } from "@/lib/risk/risk-gate";
import { getBinanceTestnetStatus, isBinanceConnected } from "./binance-testnet-status";

export interface TestnetConnectionStatus {
  connected: boolean;
  configured: boolean;
  reason: string | null;
}

function mockStatus(): TestnetConnectionStatus | null {
  const mock = process.env.BINANCE_TESTNET_MOCK_CONNECTED?.trim().toLowerCase();
  const configured = isTestnetConfigured();
  if (mock === "true" || mock === "1" || mock === "yes") {
    return { connected: true, configured, reason: null };
  }
  if (mock === "false" || mock === "0") {
    return {
      connected: false,
      configured,
      reason: "Testnet mock status: disconnected.",
    };
  }
  return null;
}

/** Fail closed — uses mock env when set, otherwise live Binance status probe. */
export async function resolveTestnetConnectionStatus(): Promise<TestnetConnectionStatus> {
  const configured = isTestnetConfigured();
  if (!configured) {
    return {
      connected: false,
      configured: false,
      reason: "Testnet not configured — set BINANCE_TESTNET_ENABLED=true.",
    };
  }

  const mock = mockStatus();
  if (mock) return mock;

  const status = await getBinanceTestnetStatus();
  return {
    connected: isBinanceConnected(status),
    configured: true,
    reason: isBinanceConnected(status) ? null : status.reason,
  };
}
