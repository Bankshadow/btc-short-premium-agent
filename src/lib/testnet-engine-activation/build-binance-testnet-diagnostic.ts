import { loadBinanceConfig, resolveBinanceCredentials } from "@/lib/exchange/binance/binance-config";
import type { BinanceStatusResult } from "@/lib/exchange/binance/binance-types";
import {
  TESTNET_ENGINE_ACTIVATION_MVP,
  type BinanceTestnetDiagnosticSnapshot,
  type BinanceTestnetDiagnosticStatus,
} from "./types";

const CLOCK_SKEW_LIMIT_MS = 5_000;

function resolveProxyProviderLabel(status: BinanceStatusResult): string | null {
  if (!status.proxyEnabled) return null;
  const url = status.baseUrl?.toLowerCase() ?? "";
  if (url.includes("fly.dev")) return "Fly.io (Singapore)";
  if (url.includes("workers.dev")) return "Cloudflare Worker";
  if (url.includes("railway")) return "Railway";
  if (url.includes("trycloudflare")) return "Cloudflare Quick Tunnel";
  return "Custom proxy";
}

function recommendationFor(status: BinanceTestnetDiagnosticStatus): string {
  switch (status) {
    case "CONNECTED":
      return "Testnet connected — review pending preview before any execute (double confirm required).";
    case "MISSING_ENV":
      return "Set BINANCE_API_KEY, BINANCE_API_SECRET, and BINANCE_TESTNET_ENABLED=true in server env.";
    case "PROXY_UNHEALTHY":
      return "Check BINANCE_PROXY_URL / proxy provider — testnet API must be reachable from server.";
    case "BLOCKED_BY_REGION":
      return "Use an allowed proxy region or run server from a non-blocked location (HTTP 451).";
    case "AUTH_ERROR":
      return "Verify testnet API key permissions (Futures) and that keys match testnet.binancefuture.com.";
    case "CLOCK_SKEW":
      return "Sync server system clock (NTP) — Binance rejects requests when skew exceeds 5s.";
    case "API_ERROR":
      return "Review server logs and Binance testnet status — fix API error then refresh.";
    case "DISCONNECTED":
      return "Configure credentials and confirm testnet base URL — then open Binance Testnet settings.";
    default:
      return "Review Binance testnet settings and server env checklist.";
  }
}

export function resolveBinanceTestnetDiagnosticFromStatus(
  binanceStatus: BinanceStatusResult | null,
): BinanceTestnetDiagnosticSnapshot {
  const generatedAt = new Date().toISOString();
  const config = loadBinanceConfig();
  const creds = resolveBinanceCredentials();
  const apiKeyPresent = Boolean(process.env.BINANCE_API_KEY?.trim());
  const apiSecretPresent = Boolean(process.env.BINANCE_API_SECRET?.trim());
  const proxyUrlConfigured = Boolean(
    process.env.BINANCE_PROXY_URL?.trim() ||
      process.env.HTTPS_PROXY?.trim() ||
      process.env.HTTP_PROXY?.trim(),
  );

  if (!binanceStatus) {
    return {
      mvp: TESTNET_ENGINE_ACTIVATION_MVP,
      status: "DISCONNECTED",
      connected: false,
      testnetEnabled: config.testnetEnabled,
      liveEnabled: config.liveEnabled,
      proxyEnabled: config.proxyEnabled,
      proxyProvider: null,
      proxyUrlConfigured,
      apiKeyPresent,
      apiSecretPresent,
      baseUrl: config.baseUrl,
      lastCheckedAt: generatedAt,
      reason: apiKeyPresent && apiSecretPresent
        ? "Not connected yet."
        : "Binance status probe failed — check env and network.",
      recommendation: apiKeyPresent && apiSecretPresent
        ? recommendationFor("DISCONNECTED")
        : recommendationFor("MISSING_ENV"),
    };
  }

  if (binanceStatus.connected) {
    return {
      mvp: TESTNET_ENGINE_ACTIVATION_MVP,
      status: "CONNECTED",
      connected: true,
      testnetEnabled: binanceStatus.testnetEnabled,
      liveEnabled: binanceStatus.liveEnabled,
      proxyEnabled: binanceStatus.proxyEnabled,
      proxyProvider: resolveProxyProviderLabel(binanceStatus),
      proxyUrlConfigured,
      apiKeyPresent,
      apiSecretPresent,
      baseUrl: binanceStatus.baseUrl,
      lastCheckedAt: generatedAt,
      reason: "Connected to Binance USD-M Futures testnet.",
      recommendation: recommendationFor("CONNECTED"),
    };
  }

  const err = (binanceStatus.error ?? "").toLowerCase();
  const skew = binanceStatus.clockSkewMs;

  let status: BinanceTestnetDiagnosticStatus = "DISCONNECTED";
  let reason =
    binanceStatus.blockers[0]?.detail ??
    binanceStatus.error ??
    "Not connected yet.";

  if (!apiKeyPresent || !apiSecretPresent || !binanceStatus.testnetEnabled || !creds) {
    status = "MISSING_ENV";
    if (!apiKeyPresent) reason = "BINANCE_API_KEY is not set on the server.";
    else if (!apiSecretPresent) reason = "BINANCE_API_SECRET is not set on the server.";
    else if (!binanceStatus.testnetEnabled) reason = "BINANCE_TESTNET_ENABLED must be true.";
    else reason = "Binance credentials not configured.";
  } else if (skew != null && skew > CLOCK_SKEW_LIMIT_MS) {
    status = "CLOCK_SKEW";
    reason = `Clock skew ${skew}ms exceeds ${CLOCK_SKEW_LIMIT_MS}ms limit.`;
  } else if (
    err.includes("451") ||
    err.includes("restricted location") ||
    err.includes("geo") ||
    err.includes("blocked region")
  ) {
    status = "BLOCKED_BY_REGION";
    reason = binanceStatus.error ?? "Region blocked by Binance (HTTP 451).";
  } else if (
    binanceStatus.proxyEnabled &&
    (err.includes("proxy") ||
      err.includes("econnrefused") ||
      err.includes("etimedout") ||
      err.includes("fetch failed"))
  ) {
    status = "PROXY_UNHEALTHY";
    reason = binanceStatus.error ?? "Proxy unreachable or misconfigured.";
  } else if (
    err.includes("-2015") ||
    err.includes("-2014") ||
    err.includes("invalid api-key") ||
    err.includes("permission") ||
    err.includes("unauthorized") ||
    err.includes("auth")
  ) {
    status = "AUTH_ERROR";
    reason = binanceStatus.error ?? "Binance rejected API credentials.";
  } else if (binanceStatus.error) {
    status = "API_ERROR";
    reason = binanceStatus.error;
  } else if (reason === "Not connected yet.") {
    status = "DISCONNECTED";
    reason = "API keys configured but account probe did not connect.";
  }

  return {
    mvp: TESTNET_ENGINE_ACTIVATION_MVP,
    status,
    connected: false,
    testnetEnabled: binanceStatus.testnetEnabled,
    liveEnabled: binanceStatus.liveEnabled,
    proxyEnabled: binanceStatus.proxyEnabled,
    proxyProvider: resolveProxyProviderLabel(binanceStatus),
    proxyUrlConfigured,
    apiKeyPresent,
    apiSecretPresent,
    baseUrl: binanceStatus.baseUrl,
    lastCheckedAt: generatedAt,
    reason,
    recommendation: recommendationFor(status),
  };
}
