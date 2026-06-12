import type { BinanceTestnetClient } from "./binance-testnet-client";
import type { BinanceOrderResult } from "./binance-testnet-types";

function positiveAvgPrice(order: BinanceOrderResult): number | null {
  const avg = order.avgPrice != null ? Number(order.avgPrice) : null;
  if (avg != null && Number.isFinite(avg) && avg > 0) return avg;
  return null;
}

export async function resolveMarketOrderFill(
  client: BinanceTestnetClient,
  symbol: string,
  initial: BinanceOrderResult,
  options?: { attempts?: number; delayMs?: number },
): Promise<BinanceOrderResult> {
  const attempts = options?.attempts ?? 5;
  const delayMs = options?.delayMs ?? 1000;

  let latest = initial;
  if (positiveAvgPrice(latest) && parseFloat(latest.executedQty || "0") > 0) {
    return latest;
  }

  for (let i = 0; i < attempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    try {
      latest = await client.getOrder(symbol, String(initial.orderId));
      if (positiveAvgPrice(latest) && parseFloat(latest.executedQty || "0") > 0) {
        return latest;
      }
    } catch {
      // keep retrying until attempts exhausted
    }
  }

  return latest;
}

export function orderSummaryFromResult(order: BinanceOrderResult) {
  return {
    symbol: order.symbol,
    side: order.side,
    qty: order.executedQty || order.origQty,
    orderId: String(order.orderId),
    clientOrderId: order.clientOrderId,
    status: order.status,
    avgPrice: order.avgPrice,
    executedQty: order.executedQty,
    updateTime: order.updateTime,
  };
}
