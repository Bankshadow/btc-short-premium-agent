import type {
  DerivativesOverrides,
  LiquidationData,
  MarketSnapshot,
} from "@/lib/types/market";

export function applyDerivativesOverrides(
  market: MarketSnapshot,
  liquidation: LiquidationData,
  overrides?: DerivativesOverrides,
): { market: MarketSnapshot; liquidation: LiquidationData } {
  if (!overrides) {
    return { market, liquidation };
  }

  const nextMarket: MarketSnapshot = { ...market };
  const nextLiquidation: LiquidationData = { ...liquidation };

  if (overrides.oi24hChange != null) {
    nextMarket.oiChange24hPct = overrides.oi24hChange;
  }
  if (overrides.oi1hChange != null) {
    nextMarket.oiChange1hPct = overrides.oi1hChange;
  }
  if (overrides.volume24hChange != null) {
    nextMarket.volumeChange24hPct = overrides.volume24hChange;
  }
  if (overrides.liquidation24h != null) {
    nextLiquidation.liquidation24h = overrides.liquidation24h;
    nextLiquidation.source = "manual";
  }

  return { market: nextMarket, liquidation: nextLiquidation };
}
