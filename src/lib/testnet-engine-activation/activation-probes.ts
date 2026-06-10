import { getBinanceStatus } from "@/lib/exchange/binance/binance-futures-testnet";
import type { BinanceStatusResult } from "@/lib/exchange/binance/binance-types";
import { withActivationTimeout } from "./build-engine-health-status";

const DEFAULT_PROBE_MS = 2_500;

/** Bounded Binance status probe for activation APIs (avoids hanging health checks). */
export async function probeBinanceStatus(
  ms = DEFAULT_PROBE_MS,
): Promise<BinanceStatusResult | null> {
  return withActivationTimeout(getBinanceStatus().catch(() => null), ms, null);
}
