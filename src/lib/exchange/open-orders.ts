import type { ExchangeCredentials } from "./exchange-config";
import { bybitPrivateGet } from "./bybit-auth-client";
import type { ExchangeOpenOrderSnapshot } from "./types";

interface OpenOrdersResult {
  list: Array<Record<string, string>>;
}

function num(value: string | undefined): number {
  if (value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseOrderRow(
  row: Record<string, string>,
  category: "linear" | "option",
): ExchangeOpenOrderSnapshot {
  const createdMs = num(row.createdTime);
  return {
    category,
    orderId: row.orderId ?? "",
    symbol: row.symbol ?? "",
    side: (row.side as "Buy" | "Sell") ?? "Buy",
    orderType: row.orderType ?? "Unknown",
    price: num(row.price),
    qty: num(row.qty),
    cumExecQty: num(row.cumExecQty),
    orderStatus: row.orderStatus ?? "Unknown",
    createdTime:
      createdMs > 0
        ? new Date(createdMs).toISOString()
        : new Date().toISOString(),
  };
}

export async function fetchOpenLinearOrders(
  creds: ExchangeCredentials,
): Promise<ExchangeOpenOrderSnapshot[]> {
  const { result } = await bybitPrivateGet<OpenOrdersResult>(
    creds,
    "/v5/order/realtime",
    { category: "linear", settleCoin: "USDT" },
  );

  return (result.list ?? []).map((row) => parseOrderRow(row, "linear"));
}

export async function fetchOpenOptionOrders(
  creds: ExchangeCredentials,
): Promise<ExchangeOpenOrderSnapshot[]> {
  const { result } = await bybitPrivateGet<OpenOrdersResult>(
    creds,
    "/v5/order/realtime",
    { category: "option", baseCoin: "BTC" },
  );

  return (result.list ?? []).map((row) => parseOrderRow(row, "option"));
}
