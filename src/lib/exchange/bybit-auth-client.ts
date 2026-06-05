import crypto from "crypto";
import type { ExchangeCredentials } from "./exchange-config";

const RECV_WINDOW = "5000";
const USER_AGENT =
  "Mozilla/5.0 (compatible; BTCShortPremiumAgent/1.0; exchange-read-only)";

export interface BybitPrivateResponse<T> {
  retCode: number;
  retMsg: string;
  result: T;
  time?: number;
}

export class ExchangeApiError extends Error {
  readonly status?: number;
  readonly retCode?: number;
  readonly retMsg?: string;
  readonly path: string;

  constructor(
    message: string,
    options: {
      status?: number;
      retCode?: number;
      retMsg?: string;
      path: string;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options.cause });
    this.name = "ExchangeApiError";
    this.status = options.status;
    this.retCode = options.retCode;
    this.retMsg = options.retMsg;
    this.path = options.path;
  }
}

function buildQueryString(
  params?: Record<string, string | number | boolean>,
): string {
  if (!params) return "";
  const keys = Object.keys(params).sort();
  return keys.map((key) => `${key}=${params[key]}`).join("&");
}

function signPayload(
  timestamp: string,
  apiKey: string,
  body: string,
  apiSecret: string,
): string {
  const payload = timestamp + apiKey + RECV_WINDOW + body;
  return crypto.createHmac("sha256", apiSecret).update(payload).digest("hex");
}

function signGet(
  timestamp: string,
  apiKey: string,
  queryString: string,
  apiSecret: string,
): string {
  return signPayload(timestamp, apiKey, queryString, apiSecret);
}

/**
 * Authenticated read-only GET for Bybit V5 private endpoints.
 * Server-only — credentials must never reach the browser.
 */
export async function bybitPrivateGet<T>(
  creds: ExchangeCredentials,
  path: string,
  params?: Record<string, string | number | boolean>,
): Promise<{ result: T; serverTimeMs: number | null }> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const queryString = buildQueryString(params);
  const timestamp = String(Date.now());
  const signature = signGet(
    timestamp,
    creds.apiKey,
    queryString,
    creds.apiSecret,
  );

  const url = new URL(normalizedPath, creds.baseUrl);
  if (queryString) {
    url.search = queryString;
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": USER_AGENT,
        "X-BAPI-API-KEY": creds.apiKey,
        "X-BAPI-TIMESTAMP": timestamp,
        "X-BAPI-SIGN": signature,
        "X-BAPI-RECV-WINDOW": RECV_WINDOW,
      },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Network request failed";
    throw new ExchangeApiError(
      `Exchange request failed: ${normalizedPath} (${detail})`,
      { path: normalizedPath, cause: error },
    );
  }

  if (!response.ok) {
    throw new ExchangeApiError(
      `Exchange HTTP ${response.status}: ${response.statusText}`,
      { status: response.status, path: normalizedPath },
    );
  }

  let body: BybitPrivateResponse<T>;
  try {
    body = (await response.json()) as BybitPrivateResponse<T>;
  } catch (error) {
    throw new ExchangeApiError(`Exchange invalid JSON: ${normalizedPath}`, {
      status: response.status,
      path: normalizedPath,
      cause: error,
    });
  }

  if (body.retCode !== 0) {
    throw new ExchangeApiError(
      `Bybit API ${body.retCode}: ${body.retMsg}`,
      {
        status: response.status,
        retCode: body.retCode,
        retMsg: body.retMsg,
        path: normalizedPath,
      },
    );
  }

  return {
    result: body.result,
    serverTimeMs: body.time ?? null,
  };
}

/** Authenticated POST for Bybit V5 private endpoints (order create, etc.). */
export async function bybitPrivatePost<T>(
  creds: ExchangeCredentials,
  path: string,
  body: Record<string, unknown>,
): Promise<{ result: T; serverTimeMs: number | null }> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const jsonBody = JSON.stringify(body);
  const timestamp = String(Date.now());
  const signature = signPayload(
    timestamp,
    creds.apiKey,
    jsonBody,
    creds.apiSecret,
  );

  const url = new URL(normalizedPath, creds.baseUrl);
  let response: Response;

  try {
    response = await fetch(url.toString(), {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
        "X-BAPI-API-KEY": creds.apiKey,
        "X-BAPI-TIMESTAMP": timestamp,
        "X-BAPI-SIGN": signature,
        "X-BAPI-RECV-WINDOW": RECV_WINDOW,
      },
      body: jsonBody,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "Network request failed";
    throw new ExchangeApiError(
      `Exchange POST failed: ${normalizedPath} (${detail})`,
      { path: normalizedPath, cause: error },
    );
  }

  if (!response.ok) {
    throw new ExchangeApiError(
      `Exchange HTTP ${response.status}: ${response.statusText}`,
      { status: response.status, path: normalizedPath },
    );
  }

  let parsed: BybitPrivateResponse<T>;
  try {
    parsed = (await response.json()) as BybitPrivateResponse<T>;
  } catch (error) {
    throw new ExchangeApiError(`Exchange invalid JSON: ${normalizedPath}`, {
      status: response.status,
      path: normalizedPath,
      cause: error,
    });
  }

  if (parsed.retCode !== 0) {
    throw new ExchangeApiError(
      `Bybit API ${parsed.retCode}: ${parsed.retMsg}`,
      {
        status: response.status,
        retCode: parsed.retCode,
        retMsg: parsed.retMsg,
        path: normalizedPath,
      },
    );
  }

  return {
    result: parsed.result,
    serverTimeMs: parsed.time ?? null,
  };
}

/** Public server time — used to detect clock skew before authenticated calls. */
export async function fetchBybitServerTime(
  baseUrl: string,
): Promise<number | null> {
  try {
    const url = new URL("/v5/market/time", baseUrl);
    const response = await fetch(url.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as BybitPrivateResponse<{
      timeSecond: string;
      timeNano: string;
    }>;
    if (body.retCode !== 0) return null;
    return Number(body.result.timeSecond) * 1000;
  } catch {
    return null;
  }
}
