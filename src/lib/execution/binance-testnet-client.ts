import { isLiveEnabled, isTestnetConfigured } from "@/lib/risk/risk-gate";
import { buildSignedQuery } from "./binance-signer";
import {
  DEFAULT_BINANCE_FUTURES_TESTNET_BASE_URL,
  resolveTestnetBaseUrl,
} from "./binance-testnet-config";
import type {
  BinanceAccountSummary,
  BinanceClientConfig,
  BinanceExchangeSymbol,
  BinanceOrderResult,
  BinancePosition,
  BinanceServerTime,
  CreateMarketOrderInput,
} from "./binance-testnet-types";

const MAX_CLOCK_SKEW_MS = 5_000;

export { DEFAULT_BINANCE_FUTURES_TESTNET_BASE_URL, resolveTestnetBaseUrl };

export function resolveBinanceClientConfig(): BinanceClientConfig {
  const proxyUrl =
    process.env.BINANCE_PROXY_URL?.trim() ||
    process.env.BINANCE_TESTNET_PROXY_URL?.trim() ||
    null;
  const proxyEnabledRaw = process.env.BINANCE_PROXY_ENABLED?.trim().toLowerCase();
  const proxyEnabled =
    proxyEnabledRaw === "true" ||
    proxyEnabledRaw === "1" ||
    proxyEnabledRaw === "yes";

  return {
    baseUrl: resolveTestnetBaseUrl(),
    apiKey: process.env.BINANCE_API_KEY?.trim() ?? "",
    apiSecret: process.env.BINANCE_API_SECRET?.trim() ?? "",
    proxyEnabled,
    proxyUrl,
    proxySecret: process.env.BINANCE_PROXY_SECRET?.trim() || null,
  };
}

export function hasBinanceApiCredentials(config = resolveBinanceClientConfig()): boolean {
  return Boolean(config.apiKey && config.apiSecret);
}

function resolveRequestBase(config: BinanceClientConfig): string {
  if (config.proxyEnabled && config.proxyUrl) {
    return config.proxyUrl.replace(/\/$/, "");
  }
  return config.baseUrl.replace(/\/$/, "");
}

function sanitizeErrorBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object") return {};
  const record = body as Record<string, unknown>;
  const safe: Record<string, unknown> = {};
  for (const key of ["code", "msg", "status", "orderId", "clientOrderId", "symbol", "side"]) {
    if (record[key] !== undefined) safe[key] = record[key];
  }
  return safe;
}

export class BinanceTestnetClient {
  readonly config: BinanceClientConfig;
  private orderCallCount = 0;

  constructor(config: BinanceClientConfig = resolveBinanceClientConfig()) {
    this.config = config;
  }

  get orderCalls(): number {
    return this.orderCallCount;
  }

  async request<T>(
    path: string,
    init?: RequestInit & { signed?: boolean; params?: Record<string, string | number | boolean> },
  ): Promise<{ ok: boolean; status: number; data: T; raw: unknown }> {
    const base = resolveRequestBase(this.config);
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    };

    if (init?.signed && this.config.apiKey) {
      headers["X-MBX-APIKEY"] = this.config.apiKey;
    }
    if (this.config.proxyEnabled && this.config.proxySecret) {
      headers["X-Binance-Proxy-Secret"] = this.config.proxySecret;
    }

    let url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

    if (init?.signed) {
      if (!this.config.apiSecret) {
        throw new Error("API secret required for signed request");
      }
      const params = init.params ?? {};
      const query = buildSignedQuery(params, this.config.apiSecret);
      url = `${url}?${query}`;
    } else if (init?.params) {
      const qs = new URLSearchParams(
        Object.entries(init.params).map(([k, v]) => [k, String(v)]),
      ).toString();
      url = `${url}?${qs}`;
    }

    const res = await fetch(url, {
      ...init,
      headers,
      cache: "no-store",
    });

    let raw: unknown = null;
    const text = await res.text();
    if (text) {
      try {
        raw = JSON.parse(text);
      } catch {
        raw = { msg: text.slice(0, 200) };
      }
    }

    return {
      ok: res.ok,
      status: res.status,
      data: raw as T,
      raw,
    };
  }

  async getServerTime(): Promise<BinanceServerTime> {
    const res = await this.request<BinanceServerTime>("/fapi/v1/time", { method: "GET" });
    if (!res.ok) {
      throw new Error(`Server time failed HTTP ${res.status}`);
    }
    return res.data;
  }

  async getExchangeInfo(): Promise<{ symbols: BinanceExchangeSymbol[] }> {
    const res = await this.request<{ symbols: BinanceExchangeSymbol[] }>("/fapi/v1/exchangeInfo", {
      method: "GET",
    });
    if (!res.ok) {
      throw new Error(`Exchange info failed HTTP ${res.status}`);
    }
    return res.data;
  }

  async getAccount(): Promise<BinanceAccountSummary> {
    const res = await this.request<BinanceAccountSummary>("/fapi/v2/account", {
      method: "GET",
      signed: true,
    });
    if (!res.ok) {
      const summary = sanitizeErrorBody(res.raw);
      throw new Error(
        typeof summary.msg === "string" ? summary.msg : `Account failed HTTP ${res.status}`,
      );
    }
    return res.data;
  }

  async getPositions(): Promise<BinancePosition[]> {
    const res = await this.request<BinancePosition[]>("/fapi/v2/positionRisk", {
      method: "GET",
      signed: true,
    });
    if (!res.ok) {
      throw new Error(`Positions failed HTTP ${res.status}`);
    }
    return res.data;
  }

  async createMarketOrder(input: CreateMarketOrderInput): Promise<BinanceOrderResult> {
    this.orderCallCount += 1;
    const params: Record<string, string> = {
      symbol: input.symbol.toUpperCase(),
      side: input.side,
      type: "MARKET",
      quantity: input.quantity,
    };
    if (input.clientOrderId) {
      params.newClientOrderId = input.clientOrderId;
    }
    if (input.reduceOnly) {
      params.reduceOnly = "true";
    }

    const res = await this.request<BinanceOrderResult>("/fapi/v1/order", {
      method: "POST",
      signed: true,
      params,
    });

    if (!res.ok) {
      const summary = sanitizeErrorBody(res.raw);
      throw new Error(
        typeof summary.msg === "string" ? summary.msg : `Order failed HTTP ${res.status}`,
      );
    }
    return res.data;
  }

  async getOrder(symbol: string, orderId: string): Promise<BinanceOrderResult> {
    const res = await this.request<BinanceOrderResult>("/fapi/v1/order", {
      method: "GET",
      signed: true,
      params: { symbol: symbol.toUpperCase(), orderId },
    });
    if (!res.ok) {
      throw new Error(`Get order failed HTTP ${res.status}`);
    }
    return res.data;
  }

  async ping(): Promise<{ ok: boolean; status: number }> {
    const res = await this.request<Record<string, never>>("/fapi/v1/ping", { method: "GET" });
    return { ok: res.ok, status: res.status };
  }

  async checkClockSkew(): Promise<{ ok: boolean; skewMs: number }> {
    const { serverTime } = await this.getServerTime();
    const skewMs = Math.abs(Date.now() - serverTime);
    return { ok: skewMs <= MAX_CLOCK_SKEW_MS, skewMs };
  }
}

export function createBinanceTestnetClient(
  config?: BinanceClientConfig,
): BinanceTestnetClient {
  return new BinanceTestnetClient(config);
}

export { MAX_CLOCK_SKEW_MS };
