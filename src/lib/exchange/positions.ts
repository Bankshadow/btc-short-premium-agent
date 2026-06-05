import type { ExchangeCredentials } from "./exchange-config";
import { bybitPrivateGet } from "./bybit-auth-client";
import type { ExchangePositionSnapshot } from "./types";

interface PositionListResult {
  list: Array<Record<string, string>>;
}

function num(value: string | undefined): number {
  if (value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parsePositionRow(
  row: Record<string, string>,
  category: "linear" | "option",
): ExchangePositionSnapshot | null {
  const size = Math.abs(num(row.size));
  if (size <= 0) return null;

  const side = (row.side as "Buy" | "Sell" | "None") ?? "None";
  const liq = num(row.liqPrice);

  return {
    category,
    symbol: row.symbol ?? "",
    side,
    size,
    avgPrice: num(row.avgPrice),
    markPrice: num(row.markPrice),
    unrealisedPnl: num(row.unrealisedPnl),
    leverage: num(row.leverage),
    positionValueUsd: num(row.positionValue),
    liqPrice: liq > 0 ? liq : null,
  };
}

export async function fetchLinearPositions(
  creds: ExchangeCredentials,
): Promise<ExchangePositionSnapshot[]> {
  const { result } = await bybitPrivateGet<PositionListResult>(
    creds,
    "/v5/position/list",
    { category: "linear", settleCoin: "USDT" },
  );

  return (result.list ?? [])
    .map((row) => parsePositionRow(row, "linear"))
    .filter((p): p is ExchangePositionSnapshot => p !== null);
}

export async function fetchOptionPositions(
  creds: ExchangeCredentials,
): Promise<ExchangePositionSnapshot[]> {
  const { result } = await bybitPrivateGet<PositionListResult>(
    creds,
    "/v5/position/list",
    { category: "option", baseCoin: "BTC" },
  );

  return (result.list ?? [])
    .map((row) => parsePositionRow(row, "option"))
    .filter((p): p is ExchangePositionSnapshot => p !== null);
}
