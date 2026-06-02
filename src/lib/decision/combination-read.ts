import type {
  CombinationPattern,
  CombinationReadResult,
  LiquidationData,
  LiquidationRegime,
  MarketSnapshot,
} from "@/lib/types/market";

const PATTERN_META: Record<
  Exclude<CombinationPattern, "partial_data">,
  { label: string; actionHint: string }
> = {
  bullish_accumulation: {
    label: "Pattern 1: Bullish Accumulation",
    actionHint: "Short Put aligned; Short Call risky.",
  },
  long_capitulation: {
    label: "Pattern 2: Long Capitulation",
    actionHint: "SKIP — wait for liquidation < $50M.",
  },
  new_shorts_piling: {
    label: "Pattern 3: New Shorts Piling",
    actionHint: "Short Call aligned; Short Put counter-positioning.",
  },
  quiet_deleveraging: {
    label: "Pattern 4: Quiet Deleveraging",
    actionHint: "Either side OK — follow macro view.",
  },
  unclear: {
    label: "Unclear pattern",
    actionHint: "No dominant combination — reduce confidence.",
  },
};

function resolveLiquidationRegime(
  liquidation24h: number | null,
): LiquidationRegime {
  if (liquidation24h === null) return "unknown";
  if (liquidation24h > 200_000_000) return "cascade";
  if (liquidation24h >= 50_000_000) return "caution";
  if (liquidation24h > 0) return "safe";
  return "unknown";
}

function detectMissingFields(
  market: MarketSnapshot,
  liquidation: LiquidationData,
): string[] {
  const missing: string[] = [];
  if (liquidation.liquidation24h === null) missing.push("liquidation24h");
  if (market.oiChange24hPct === null) missing.push("oi24hChange");
  if (market.oiChange1hPct === null) missing.push("oi1hChange");
  if (market.volumeChange24hPct === null) missing.push("volume24hChange");
  return missing;
}

/**
 * Combination Read — Price + Volume + OI + Liquidation together.
 * Marks PARTIAL_DATA when liquidation or OI change is unavailable.
 */
export function evaluateCombinationRead(
  market: MarketSnapshot,
  liquidation: LiquidationData,
): CombinationReadResult {
  const missingFields = detectMissingFields(market, liquidation);
  const dataStatus =
    missingFields.length > 0 ? "partial_data" : "complete";
  const regime = resolveLiquidationRegime(liquidation.liquidation24h);

  if (dataStatus === "partial_data") {
    return {
      pattern: "partial_data",
      label: "Combination Read — PARTIAL_DATA",
      actionHint:
        "Liquidation and/or OI data missing — pattern recognition incomplete.",
      liquidationRegime: regime,
      dataStatus,
      missingFields,
    };
  }

  const priceChange = market.priceChange24hPct ?? 0;
  const volumeChange = market.volumeChange24hPct ?? 0;
  const oiChange = market.oiChange24hPct ?? 0;
  const liq = liquidation.liquidation24h ?? 0;

  const priceUp = priceChange > 0.5;
  const priceDown = priceChange < -0.5;
  const priceFlat = !priceUp && !priceDown;
  const volUp = volumeChange > 10;
  const volSpike = volumeChange > 50;
  const oiUp = oiChange > 0.5;
  const oiDown = oiChange < -0.5;
  const volDown = volumeChange < -10;

  let pattern: CombinationPattern = "unclear";

  if (priceDown && volSpike && oiDown && liq > 200_000_000) {
    pattern = "long_capitulation";
  } else if (priceUp && volUp && oiUp) {
    pattern = "bullish_accumulation";
  } else if (priceDown && volUp && oiUp) {
    pattern = "new_shorts_piling";
  } else if (priceFlat && volDown && oiDown) {
    pattern = "quiet_deleveraging";
  }

  const meta = PATTERN_META[pattern];

  return {
    pattern,
    label: meta.label,
    actionHint: meta.actionHint,
    liquidationRegime: regime,
    dataStatus: "complete",
    missingFields: [],
  };
}

export function combinationPatternOpposesTrade(
  pattern: CombinationPattern,
  action: "sell_call" | "sell_put",
): boolean {
  if (pattern === "partial_data" || pattern === "unclear") return false;
  if (pattern === "long_capitulation") return true;
  if (pattern === "bullish_accumulation" && action === "sell_call") return true;
  if (pattern === "new_shorts_piling" && action === "sell_put") return true;
  return false;
}

export function isLiquidationCaution(
  liquidation: LiquidationData,
): boolean {
  const liq = liquidation.liquidation24h;
  return liq !== null && liq >= 50_000_000 && liq <= 200_000_000;
}
