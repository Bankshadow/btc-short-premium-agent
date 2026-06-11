import { isLiveEnabled, isTestnetConfigured } from "@/lib/risk/risk-gate";
import {
  createBinanceTestnetClient,
  hasBinanceApiCredentials,
  resolveBinanceClientConfig,
  resolveTestnetBaseUrl,
} from "./binance-testnet-client";
import { fetchWithTimeout, OperationTimeoutError, withTimeout } from "@/lib/core/with-timeout";
import {
  DEFAULT_BINANCE_FUTURES_TESTNET_BASE_URL,
  MISSING_BINANCE_CREDENTIALS_REASON,
  MISSING_BINANCE_CREDENTIALS_RECOMMENDATION,
} from "./binance-testnet-config";
import type { BinanceTestnetStatus, BinanceTestnetStatusCode } from "./binance-testnet-types";

function statusResult(
  status: BinanceTestnetStatusCode,
  partial: Partial<BinanceTestnetStatus> & { reason: string; recommendation: string },
): BinanceTestnetStatus {
  const config = resolveBinanceClientConfig();
  const baseUrl = resolveTestnetBaseUrl();
  return {
    status,
    testnetEnabled: isTestnetConfigured(),
    liveEnabled: isLiveEnabled(),
    apiKeyPresent: Boolean(config.apiKey),
    apiSecretPresent: Boolean(config.apiSecret),
    proxyEnabled: config.proxyEnabled,
    proxyUrlConfigured: Boolean(config.proxyUrl),
    serverTimeOk: partial.serverTimeOk ?? false,
    lastCheckedAt: new Date().toISOString(),
    ...partial,
    baseUrl: partial.baseUrl || baseUrl,
  };
}

async function checkProxyHealth(config: ReturnType<typeof resolveBinanceClientConfig>): Promise<boolean> {
  if (!config.proxyEnabled || !config.proxyUrl) return true;
  try {
    const base = config.proxyUrl.replace(/\/$/, "");
    const headers: Record<string, string> = {};
    if (config.proxySecret) {
      headers["X-Binance-Proxy-Secret"] = config.proxySecret;
    }
    const res = await fetchWithTimeout(`${base}/health`, { headers, cache: "no-store" }, 2500);
    if (!res.ok) return false;
    const data = (await res.json()) as { ok?: boolean };
    return data.ok === true;
  } catch {
    return false;
  }
}

export async function getBinanceTestnetStatus(): Promise<BinanceTestnetStatus> {
  const config = resolveBinanceClientConfig();

  if (isLiveEnabled()) {
    return statusResult("DISCONNECTED", {
      reason: "Live trading flag is enabled — execution blocked.",
      recommendation: "Set BINANCE_LIVE_ENABLED=false.",
    });
  }

  if (!isTestnetConfigured()) {
    return statusResult("MISSING_ENV", {
      reason: "BINANCE_TESTNET_ENABLED is not true.",
      recommendation: "Set BINANCE_TESTNET_ENABLED=true in server env.",
    });
  }

  if (!hasBinanceApiCredentials(config)) {
    return statusResult("MISSING_ENV", {
      reason: MISSING_BINANCE_CREDENTIALS_REASON,
      recommendation: MISSING_BINANCE_CREDENTIALS_RECOMMENDATION,
    });
  }

  if (config.proxyEnabled && !config.proxyUrl) {
    return statusResult("PROXY_UNHEALTHY", {
      reason: "Proxy enabled but BINANCE_PROXY_URL is not configured.",
      recommendation: "Set BINANCE_PROXY_URL to your testnet proxy endpoint.",
    });
  }

  if (!(await checkProxyHealth(config))) {
    return statusResult("PROXY_UNHEALTHY", {
      reason: "Proxy health check failed.",
      recommendation: "Verify proxy deployment and BINANCE_PROXY_SECRET.",
    });
  }

  const client = createBinanceTestnetClient(config);

  try {
    const ping = await client.ping();
    if (ping.status === 451) {
      return statusResult("BLOCKED_BY_REGION", {
        reason: "Binance returned HTTP 451 — region or IP blocked.",
        recommendation: "Enable BINANCE_PROXY_ENABLED and configure BINANCE_PROXY_URL.",
      });
    }
    if (!ping.ok) {
      return statusResult("API_ERROR", {
        reason: `Binance ping failed HTTP ${ping.status}.`,
        recommendation: "Check base URL, proxy, and testnet availability.",
      });
    }

    const clock = await client.checkClockSkew();
    if (!clock.ok) {
      return statusResult("CLOCK_SKEW", {
        serverTimeOk: false,
        reason: `Clock skew ${clock.skewMs}ms exceeds limit.`,
        recommendation: "Sync server clock or retry from a stable host.",
      });
    }

    await client.getAccount();

    return statusResult("CONNECTED", {
      serverTimeOk: true,
      reason: "Binance USD-M Futures Testnet reachable.",
      recommendation: "Run execution safety review, then execute from Dashboard.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown Binance error";
    const lower = message.toLowerCase();
    if (lower.includes("451") || lower.includes("restricted")) {
      return statusResult("BLOCKED_BY_REGION", {
        reason: "Binance access blocked by region or IP.",
        recommendation: "Route through BINANCE_PROXY_URL in a permitted region.",
      });
    }
    if (lower.includes("invalid api-key") || lower.includes("signature")) {
      return statusResult("AUTH_ERROR", {
        reason: message,
        recommendation: "Verify testnet API key/secret and Futures Testnet permissions.",
      });
    }
    return statusResult("DISCONNECTED", {
      reason: message,
      recommendation: "Check network, proxy, and testnet credentials.",
    });
  }
}

export function isBinanceConnected(status: BinanceTestnetStatus): boolean {
  return status.status === "CONNECTED";
}

export const DEFAULT_BINANCE_STATUS_BOUND_MS = 5000;

export async function getBinanceTestnetStatusBounded(
  boundMs = DEFAULT_BINANCE_STATUS_BOUND_MS,
): Promise<BinanceTestnetStatus> {
  try {
    return await withTimeout("getBinanceTestnetStatus", getBinanceTestnetStatus(), boundMs);
  } catch (err) {
    const config = resolveBinanceClientConfig();
    const baseUrl = resolveTestnetBaseUrl() || DEFAULT_BINANCE_FUTURES_TESTNET_BASE_URL;
    const timedOut = err instanceof OperationTimeoutError;
    if (!hasBinanceApiCredentials(config)) {
      return statusResult("MISSING_ENV", {
        baseUrl,
        reason: MISSING_BINANCE_CREDENTIALS_REASON,
        recommendation: MISSING_BINANCE_CREDENTIALS_RECOMMENDATION,
      });
    }
    return statusResult(timedOut ? "DISCONNECTED" : "API_ERROR", {
      baseUrl,
      reason: timedOut
        ? "Binance Testnet status check did not complete."
        : err instanceof Error
          ? err.message
          : "Binance status check failed.",
      recommendation: timedOut
        ? "Retry shortly or verify BINANCE_PROXY_URL and testnet credentials."
        : "Check server logs and Binance testnet configuration.",
    });
  }
}
