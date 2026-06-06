import type { BinanceCredentials } from "./binance-types";
import { signBinanceParams } from "./binance-signer";

const USER_AGENT =
  "Mozilla/5.0 (compatible; BTCShortPremiumAgent/1.0; binance-testnet-only)";

function binanceRequestHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  const headers: Record<string, string> = {
    ...extra,
  };
  const proxySecret = process.env.BINANCE_PROXY_SECRET?.trim();
  if (proxySecret) {
    headers["X-Binance-Proxy-Secret"] = proxySecret;
  }
  return headers;
}

export class BinanceApiError extends Error {
  readonly status?: number;
  readonly code?: number;
  readonly path: string;

  constructor(
    message: string,
    options: { status?: number; code?: number; path: string; cause?: unknown },
  ) {
    super(message, { cause: options.cause });
    this.name = "BinanceApiError";
    this.status = options.status;
    this.code = options.code;
    this.path = options.path;
  }
}

export async function binancePublicGet<T>(
  baseUrl: string,
  path: string,
  params?: Record<string, string | number | boolean>,
): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(normalizedPath, baseUrl);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      headers: binanceRequestHeaders({
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new BinanceApiError(
      `Binance public GET failed: ${normalizedPath}`,
      { path: normalizedPath, cause: error },
    );
  }

  return parseBinanceResponse<T>(response, normalizedPath);
}

export async function binanceSignedGet<T>(
  creds: BinanceCredentials,
  path: string,
  params?: Record<string, string | number | boolean>,
): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const { queryString } = signBinanceParams(params ?? {}, creds.apiSecret);
  const url = new URL(normalizedPath, creds.baseUrl);
  url.search = queryString;

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      headers: binanceRequestHeaders({
        Accept: "application/json",
        "User-Agent": USER_AGENT,
        "X-MBX-APIKEY": creds.apiKey,
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new BinanceApiError(
      `Binance signed GET failed: ${normalizedPath}`,
      { path: normalizedPath, cause: error },
    );
  }

  return parseBinanceResponse<T>(response, normalizedPath);
}

export async function binanceSignedPost<T>(
  creds: BinanceCredentials,
  path: string,
  params?: Record<string, string | number | boolean>,
): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const { queryString } = signBinanceParams(params ?? {}, creds.apiSecret);
  const url = new URL(normalizedPath, creds.baseUrl);

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "POST",
      cache: "no-store",
      headers: binanceRequestHeaders({
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
        "X-MBX-APIKEY": creds.apiKey,
      }),
      body: queryString,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw new BinanceApiError(
      `Binance signed POST failed: ${normalizedPath}`,
      { path: normalizedPath, cause: error },
    );
  }

  return parseBinanceResponse<T>(response, normalizedPath);
}

async function parseBinanceResponse<T>(
  response: Response,
  path: string,
): Promise<T> {
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const errBody = (await response.json()) as { msg?: string; code?: number };
      detail = errBody.msg ?? detail;
      throw new BinanceApiError(`Binance HTTP ${response.status}: ${detail}`, {
        status: response.status,
        code: errBody.code,
        path,
      });
    } catch (e) {
      if (e instanceof BinanceApiError) throw e;
      throw new BinanceApiError(`Binance HTTP ${response.status}: ${detail}`, {
        status: response.status,
        path,
      });
    }
  }

  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new BinanceApiError(`Binance invalid JSON: ${path}`, {
      status: response.status,
      path,
      cause: error,
    });
  }
}

export async function fetchBinanceServerTime(
  baseUrl: string,
): Promise<number | null> {
  try {
    const result = await binancePublicGet<{ serverTime: number }>(
      baseUrl,
      "/fapi/v1/time",
    );
    return result.serverTime ?? null;
  } catch {
    return null;
  }
}
