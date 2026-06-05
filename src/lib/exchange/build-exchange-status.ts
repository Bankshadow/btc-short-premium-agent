import { SUPPORTED_PERP_ASSETS } from "@/lib/multi-asset/asset-config";
import {
  bybitPrivateGet,
  ExchangeApiError,
  fetchBybitServerTime,
} from "./bybit-auth-client";
import {
  EXCHANGE_ENV_HINT,
  resolveExchangeCredentials,
} from "./exchange-config";
import { fetchOpenLinearOrders, fetchOpenOptionOrders } from "./open-orders";
import {
  fetchLinearPositions,
  fetchOptionPositions,
} from "./positions";
import type { ExchangeStatusResult } from "./types";
import { fetchWalletSnapshot } from "./wallet";

const DISCLAIMER =
  "Read-only exchange connector (MVP 32). No orders placed. Credentials stay server-side.";

function notConfiguredResult(): ExchangeStatusResult {
  return {
    configured: false,
    connected: false,
    network: null,
    timestamp: new Date().toISOString(),
    serverTimeMs: null,
    clockSkewMs: null,
    wallet: null,
    linearPositions: [],
    optionPositions: [],
    openLinearOrders: [],
    openOptionOrders: [],
    trackedSymbols: SUPPORTED_PERP_ASSETS.map((a) => a.symbol),
    disclaimer: DISCLAIMER,
    envHint: EXCHANGE_ENV_HINT,
  };
}

export async function buildExchangeStatus(): Promise<ExchangeStatusResult> {
  const creds = resolveExchangeCredentials();
  if (!creds) return notConfiguredResult();

  const serverTimeMs = await fetchBybitServerTime(creds.baseUrl);
  const clockSkewMs =
    serverTimeMs === null ? null : Math.abs(Date.now() - serverTimeMs);

  try {
    // Lightweight auth ping via wallet balance.
    const walletPromise = fetchWalletSnapshot(creds);
    const linearPosPromise = fetchLinearPositions(creds);
    const optionPosPromise = fetchOptionPositions(creds);
    const linearOrdersPromise = fetchOpenLinearOrders(creds);
    const optionOrdersPromise = fetchOpenOptionOrders(creds);

    const [wallet, linearPositions, optionPositions, openLinearOrders, openOptionOrders] =
      await Promise.all([
        walletPromise,
        linearPosPromise,
        optionPosPromise,
        linearOrdersPromise,
        optionOrdersPromise,
      ]);

    return {
      configured: true,
      connected: true,
      network: creds.network,
      timestamp: new Date().toISOString(),
      serverTimeMs,
      clockSkewMs,
      wallet,
      linearPositions,
      optionPositions,
      openLinearOrders,
      openOptionOrders,
      trackedSymbols: SUPPORTED_PERP_ASSETS.map((a) => a.symbol),
      disclaimer: DISCLAIMER,
    };
  } catch (error) {
    if (error instanceof ExchangeApiError) {
      return {
        configured: true,
        connected: false,
        network: creds.network,
        timestamp: new Date().toISOString(),
        serverTimeMs,
        clockSkewMs,
        wallet: null,
        linearPositions: [],
        optionPositions: [],
        openLinearOrders: [],
        openOptionOrders: [],
        trackedSymbols: SUPPORTED_PERP_ASSETS.map((a) => a.symbol),
        error: error.message,
        errorCode: error.retCode,
        disclaimer: DISCLAIMER,
        envHint:
          error.retCode === 10010
            ? "IP not whitelisted on Bybit API key — add Vercel/server IP."
            : error.retCode === 10003 || error.retCode === 10004
              ? "Signature failed — sync system clock or check API secret."
              : error.retCode === 10005
                ? "Insufficient API permissions — enable Read on the key."
                : undefined,
      };
    }

    const message =
      error instanceof Error ? error.message : "Exchange status failed";
    return {
      configured: true,
      connected: false,
      network: creds.network,
      timestamp: new Date().toISOString(),
      serverTimeMs,
      clockSkewMs,
      wallet: null,
      linearPositions: [],
      optionPositions: [],
      openLinearOrders: [],
      openOptionOrders: [],
      trackedSymbols: SUPPORTED_PERP_ASSETS.map((a) => a.symbol),
      error: message,
      disclaimer: DISCLAIMER,
    };
  }
}

/** Positions-only snapshot for lightweight polling. */
export async function buildExchangePositions() {
  const creds = resolveExchangeCredentials();
  if (!creds) {
    return { configured: false, positions: [], error: EXCHANGE_ENV_HINT };
  }

  try {
    const [linear, option] = await Promise.all([
      fetchLinearPositions(creds),
      fetchOptionPositions(creds),
    ]);
    return {
      configured: true,
      network: creds.network,
      positions: [...linear, ...option],
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const message =
      error instanceof ExchangeApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Failed to fetch positions";
    return { configured: true, positions: [], error: message };
  }
}

/** Verify credentials without full status payload. */
export async function pingExchangeAuth(): Promise<boolean> {
  const creds = resolveExchangeCredentials();
  if (!creds) return false;
  try {
    await bybitPrivateGet(creds, "/v5/account/wallet-balance", {
      accountType: "UNIFIED",
    });
    return true;
  } catch {
    return false;
  }
}
