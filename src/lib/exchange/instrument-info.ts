import { bybitGet } from "@/lib/bybit/client";

export interface LinearInstrumentInfo {
  symbol: string;
  minOrderQty: number;
  maxOrderQty: number;
  qtyStep: number;
  minNotionalValue: number;
}

interface InstrumentsResult {
  list: Array<{
    symbol: string;
    lotSizeFilter?: {
      minOrderQty?: string;
      maxOrderQty?: string;
      qtyStep?: string;
      minNotionalValue?: string;
    };
  }>;
}

function num(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const cache = new Map<string, { info: LinearInstrumentInfo; at: number }>();
const CACHE_MS = 5 * 60 * 1000;

export async function fetchLinearInstrumentInfo(
  symbol: string,
): Promise<LinearInstrumentInfo> {
  const cached = cache.get(symbol);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return cached.info;
  }

  const result = await bybitGet<InstrumentsResult>(
    "/v5/market/instruments-info",
    { category: "linear", symbol },
  );

  const row = result.list?.[0];
  if (!row) {
    return {
      symbol,
      minOrderQty: 0.001,
      maxOrderQty: 1_000_000,
      qtyStep: 0.001,
      minNotionalValue: 5,
    };
  }

  const filter = row.lotSizeFilter;
  const info: LinearInstrumentInfo = {
    symbol,
    minOrderQty: num(filter?.minOrderQty, 0.001),
    maxOrderQty: num(filter?.maxOrderQty, 1_000_000),
    qtyStep: num(filter?.qtyStep, 0.001),
    minNotionalValue: num(filter?.minNotionalValue, 5),
  };

  cache.set(symbol, { info, at: Date.now() });
  return info;
}
