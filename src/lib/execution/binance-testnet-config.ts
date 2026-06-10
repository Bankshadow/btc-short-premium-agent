export const DEFAULT_BINANCE_FUTURES_TESTNET_BASE_URL = "https://demo-fapi.binance.com";

export const MISSING_BINANCE_CREDENTIALS_REASON =
  "BINANCE_API_KEY / BINANCE_API_SECRET not configured";

export const MISSING_BINANCE_CREDENTIALS_RECOMMENDATION =
  "Set Binance Futures Testnet API key/secret in server env and redeploy.";

export function resolveTestnetBaseUrl(): string {
  const raw = process.env.BINANCE_FUTURES_TESTNET_BASE_URL?.trim();
  return raw || DEFAULT_BINANCE_FUTURES_TESTNET_BASE_URL;
}
