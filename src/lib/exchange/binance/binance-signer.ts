import crypto from "crypto";

export const BINANCE_RECV_WINDOW = 5000;

export function buildSortedQueryString(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const keys = Object.keys(params)
    .filter((k) => params[k] !== undefined && params[k] !== "")
    .sort();
  return keys.map((key) => `${key}=${params[key]}`).join("&");
}

/** Binance HMAC SHA256 signature over the query string. */
export function signBinanceQuery(
  queryString: string,
  apiSecret: string,
): string {
  return crypto.createHmac("sha256", apiSecret).update(queryString).digest("hex");
}

export function signBinanceParams(
  params: Record<string, string | number | boolean | undefined>,
  apiSecret: string,
): { queryString: string; signature: string } {
  const timestamp = Date.now();
  const base = {
    ...params,
    timestamp,
    recvWindow: BINANCE_RECV_WINDOW,
  };
  const queryString = buildSortedQueryString(base);
  const signature = signBinanceQuery(queryString, apiSecret);
  return { queryString: `${queryString}&signature=${signature}`, signature };
}

export function newClientOrderId(prefix = "desk-tn"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
