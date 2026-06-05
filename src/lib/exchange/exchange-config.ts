import type { ExchangeConfigPublic, ExchangeNetwork } from "./types";

const MAINNET_BASE_URLS = [
  process.env.BYBIT_API_BASE_URL?.trim(),
  "https://api.bytick.com",
  "https://api.bybit.com",
].filter((url): url is string => Boolean(url));

const TESTNET_BASE_URL = "https://api-testnet.bybit.com";

export interface ExchangeCredentials {
  apiKey: string;
  apiSecret: string;
  network: ExchangeNetwork;
  baseUrl: string;
}

function isTestnetEnabled(): boolean {
  const raw = process.env.BYBIT_TESTNET?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes";
}

export function resolveExchangeCredentials(): ExchangeCredentials | null {
  const apiKey = process.env.BYBIT_API_KEY?.trim();
  const apiSecret = process.env.BYBIT_API_SECRET?.trim();
  if (!apiKey || !apiSecret) return null;

  const testnet = isTestnetEnabled();
  return {
    apiKey,
    apiSecret,
    network: testnet ? "testnet" : "mainnet",
    baseUrl: testnet ? TESTNET_BASE_URL : MAINNET_BASE_URLS[0],
  };
}

export function getExchangeConfigPublic(): ExchangeConfigPublic {
  const creds = resolveExchangeCredentials();
  if (!creds) {
    return {
      configured: false,
      network: null,
      baseUrl: null,
      readOnly: true,
    };
  }
  return {
    configured: true,
    network: creds.network,
    baseUrl: creds.baseUrl,
    readOnly: true,
  };
}

export const EXCHANGE_ENV_HINT =
  "Set BYBIT_API_KEY + BYBIT_API_SECRET (server env). Use BYBIT_TESTNET=true for testnet. " +
  "Read-only key recommended — no withdraw permission.";
