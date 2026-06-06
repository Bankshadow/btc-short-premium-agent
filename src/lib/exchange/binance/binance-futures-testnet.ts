import {
  assertBinanceTestnetOnly,
  blockBinanceProductionOrder,
  isBinanceTestnetAutoExecuteEnabled,
  loadBinanceConfig,
  resolveBinanceCredentials,
} from "./binance-config";
import {
  binancePublicGet,
  binanceSignedGet,
  binanceSignedPost,
  fetchBinanceServerTime,
} from "./binance-client";
import { newClientOrderId } from "./binance-signer";
import {
  buildBinanceBlockers,
  buildBinanceEnvChecklist,
} from "./binance-diagnostics";
import type {
  BinanceAccountSnapshot,
  BinanceBalance,
  BinanceExchangeInfoSymbol,
  BinanceOpenOrder,
  BinanceOrderSide,
  BinancePosition,
  BinanceStatusResult,
} from "./binance-types";
import { BINANCE_TESTNET_SAFETY_NOTICE } from "./binance-types";

export async function getBinanceStatus(): Promise<BinanceStatusResult> {
  const config = loadBinanceConfig();
  const creds = resolveBinanceCredentials();
  const productionBlock = blockBinanceProductionOrder();

  if (!creds) {
    return {
      configured: false,
      testnetEnabled: config.testnetEnabled,
      liveEnabled: config.liveEnabled,
      liveBlocked: true,
      baseUrl: config.baseUrl,
      upstreamBaseUrl: config.upstreamBaseUrl,
      proxyEnabled: config.proxyEnabled,
      autoExecuteEnabled: isBinanceTestnetAutoExecuteEnabled(),
      allowedSymbols: config.allowedSymbols,
      connected: false,
      serverTimeMs: null,
      clockSkewMs: null,
      safetyNotice: BINANCE_TESTNET_SAFETY_NOTICE,
      error: "BINANCE_API_KEY / BINANCE_API_SECRET not configured",
      envChecklist: buildBinanceEnvChecklist(),
      blockers: buildBinanceBlockers({ apiError: null, clockSkewMs: null }),
    };
  }

  const serverTimeMs = await fetchBinanceServerTime(creds.baseUrl);
  let connected = false;
  let error: string | null = productionBlock;

  if (!error) {
    try {
      await binanceSignedGet(creds, "/fapi/v2/account");
      connected = true;
    } catch (e) {
      error = e instanceof Error ? e.message : "Binance testnet auth failed";
    }
  }

  return {
    configured: true,
    testnetEnabled: config.testnetEnabled,
    liveEnabled: config.liveEnabled,
    liveBlocked: true,
    baseUrl: creds.baseUrl,
    upstreamBaseUrl: config.upstreamBaseUrl,
    proxyEnabled: config.proxyEnabled,
    autoExecuteEnabled: isBinanceTestnetAutoExecuteEnabled(),
    allowedSymbols: config.allowedSymbols,
    connected,
    serverTimeMs,
    clockSkewMs:
      serverTimeMs != null ? Math.abs(Date.now() - serverTimeMs) : null,
    safetyNotice: BINANCE_TESTNET_SAFETY_NOTICE,
    error,
    envChecklist: buildBinanceEnvChecklist(),
    blockers: buildBinanceBlockers({
      apiError: error,
      clockSkewMs:
        serverTimeMs != null ? Math.abs(Date.now() - serverTimeMs) : null,
    }),
  };
}

export async function getExchangeInfo(): Promise<{
  symbols: BinanceExchangeInfoSymbol[];
}> {
  const config = loadBinanceConfig();
  const info = await binancePublicGet<{
    symbols: Array<{
      symbol: string;
      status: string;
      baseAsset: string;
      quoteAsset: string;
      pricePrecision: number;
      quantityPrecision: number;
      filters: Array<Record<string, string>>;
    }>;
  }>(config.baseUrl, "/fapi/v1/exchangeInfo");

  const allowed = new Set(config.allowedSymbols);
  const symbols = (info.symbols ?? [])
    .filter((s) => allowed.has(s.symbol))
    .map((s) => ({
      symbol: s.symbol,
      status: s.status,
      baseAsset: s.baseAsset,
      quoteAsset: s.quoteAsset,
      pricePrecision: s.pricePrecision,
      quantityPrecision: s.quantityPrecision,
      filters: s.filters,
    }));

  return { symbols };
}

export async function getAccount(): Promise<BinanceAccountSnapshot> {
  const gate = assertBinanceTestnetOnly();
  if (!gate.allowed) {
    throw new Error(gate.blockers[0] ?? "Binance testnet not allowed");
  }
  const creds = resolveBinanceCredentials()!;
  const account = await binanceSignedGet<{
    totalWalletBalance: string;
    availableBalance: string;
    totalUnrealizedProfit: string;
    canTrade: boolean;
  }>(creds, "/fapi/v2/account");

  return {
    totalWalletBalance: account.totalWalletBalance,
    availableBalance: account.availableBalance,
    totalUnrealizedProfit: account.totalUnrealizedProfit,
    canTrade: account.canTrade,
  };
}

export async function getBalance(): Promise<BinanceBalance[]> {
  const gate = assertBinanceTestnetOnly();
  if (!gate.allowed) {
    throw new Error(gate.blockers[0] ?? "Binance testnet not allowed");
  }
  const creds = resolveBinanceCredentials()!;
  const balances = await binanceSignedGet<
    Array<{
      asset: string;
      balance: string;
      crossWalletBalance: string;
      availableBalance: string;
    }>
  >(creds, "/fapi/v2/balance");

  return (balances ?? []).map((b) => ({
    asset: b.asset,
    balance: b.balance,
    crossWalletBalance: b.crossWalletBalance,
    availableBalance: b.availableBalance,
  }));
}

export async function getPositions(): Promise<BinancePosition[]> {
  const gate = assertBinanceTestnetOnly();
  if (!gate.allowed) {
    throw new Error(gate.blockers[0] ?? "Binance testnet not allowed");
  }
  const creds = resolveBinanceCredentials()!;
  const config = loadBinanceConfig();
  const allowed = new Set(config.allowedSymbols);

  const positions = await binanceSignedGet<
    Array<{
      symbol: string;
      positionAmt: string;
      entryPrice: string;
      markPrice: string;
      unRealizedProfit: string;
      leverage: string;
      positionSide: string;
      notional: string;
    }>
  >(creds, "/fapi/v2/positionRisk");

  return (positions ?? [])
    .filter(
      (p) =>
        allowed.has(p.symbol) && Math.abs(Number(p.positionAmt)) > 0,
    )
    .map((p) => ({
      symbol: p.symbol,
      positionAmt: p.positionAmt,
      entryPrice: p.entryPrice,
      markPrice: p.markPrice,
      unRealizedProfit: p.unRealizedProfit,
      leverage: p.leverage,
      positionSide: p.positionSide,
      notional: p.notional,
    }));
}

export async function getOpenOrders(): Promise<BinanceOpenOrder[]> {
  const gate = assertBinanceTestnetOnly();
  if (!gate.allowed) {
    throw new Error(gate.blockers[0] ?? "Binance testnet not allowed");
  }
  const creds = resolveBinanceCredentials()!;
  const config = loadBinanceConfig();

  const orders = await binanceSignedGet<
    Array<{
      orderId: number;
      symbol: string;
      side: BinanceOrderSide;
      type: string;
      origQty: string;
      executedQty: string;
      status: string;
      reduceOnly: boolean;
      time: number;
    }>
  >(creds, "/fapi/v1/openOrders");

  const allowed = new Set(config.allowedSymbols);
  return (orders ?? [])
    .filter((o) => allowed.has(o.symbol))
    .map((o) => ({
      orderId: o.orderId,
      symbol: o.symbol,
      side: o.side,
      type: o.type,
      origQty: o.origQty,
      executedQty: o.executedQty,
      status: o.status,
      reduceOnly: o.reduceOnly,
      time: o.time,
    }));
}

export async function getMarkPrice(symbol: string): Promise<number | null> {
  const config = loadBinanceConfig();
  try {
    const ticker = await binancePublicGet<{ price: string }>(
      config.baseUrl,
      "/fapi/v1/ticker/price",
      { symbol },
    );
    const price = Number(ticker.price);
    return Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

async function ensureOneWayModeAndLeverage(symbol: string): Promise<void> {
  const creds = resolveBinanceCredentials()!;
  const config = loadBinanceConfig();

  try {
    await binanceSignedPost(creds, "/fapi/v1/positionSide/dual", {
      dualSidePosition: "false",
    });
  } catch {
    // May already be one-way
  }

  try {
    await binanceSignedPost(creds, "/fapi/v1/leverage", {
      symbol,
      leverage: config.leverage,
    });
  } catch {
    // May already be set
  }
}

export async function placeTestnetMarketOrder(input: {
  symbol: string;
  side: BinanceOrderSide;
  quantity: string;
  clientOrderId?: string;
}): Promise<{ orderId: number; clientOrderId: string; status: string }> {
  const gate = assertBinanceTestnetOnly();
  if (!gate.allowed) {
    throw new Error(gate.blockers[0] ?? "Binance testnet not allowed");
  }

  const creds = resolveBinanceCredentials()!;
  await ensureOneWayModeAndLeverage(input.symbol);

  const clientOrderId = input.clientOrderId ?? newClientOrderId();
  const result = await binanceSignedPost<{
    orderId: number;
    clientOrderId: string;
    status: string;
  }>(creds, "/fapi/v1/order", {
    symbol: input.symbol,
    side: input.side,
    type: "MARKET",
    quantity: input.quantity,
    newClientOrderId: clientOrderId,
  });

  return {
    orderId: result.orderId,
    clientOrderId: result.clientOrderId ?? clientOrderId,
    status: result.status,
  };
}

export async function closeTestnetPositionReduceOnly(input: {
  symbol: string;
  side: BinanceOrderSide;
  quantity: string;
}): Promise<{ orderId: number; clientOrderId: string; status: string }> {
  const gate = assertBinanceTestnetOnly();
  if (!gate.allowed) {
    throw new Error(gate.blockers[0] ?? "Binance testnet not allowed");
  }

  const creds = resolveBinanceCredentials()!;
  const clientOrderId = newClientOrderId("desk-close");

  const result = await binanceSignedPost<{
    orderId: number;
    clientOrderId: string;
    status: string;
  }>(creds, "/fapi/v1/order", {
    symbol: input.symbol,
    side: input.side,
    type: "MARKET",
    quantity: input.quantity,
    reduceOnly: "true",
    newClientOrderId: clientOrderId,
  });

  return {
    orderId: result.orderId,
    clientOrderId: result.clientOrderId ?? clientOrderId,
    status: result.status,
  };
}
