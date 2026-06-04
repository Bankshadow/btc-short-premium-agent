import type { EthCorrelationRead } from "./research-types";
import type { SpotQuote } from "@/lib/types/market";

const DIVERGENCE_THRESHOLD_PCT = 1.5;

export function computeEthCorrelation(
  btcChange24hPct: number | null | undefined,
  ethQuote?: SpotQuote | null,
): EthCorrelationRead {
  if (!ethQuote || ethQuote.price <= 0) {
    return {
      ethPrice: null,
      ethChange24hPct: null,
      btcChange24hPct: btcChange24hPct ?? null,
      alignment: "unknown",
      summary: "ETH tape unavailable — correlation read skipped.",
    };
  }

  const ethCh = ethQuote.priceChange24hPct;
  const btcCh = btcChange24hPct ?? 0;
  const diff = Math.abs(ethCh - btcCh);

  let alignment: EthCorrelationRead["alignment"] = "aligned";
  if (diff >= DIVERGENCE_THRESHOLD_PCT) {
    const sameSign = (ethCh >= 0 && btcCh >= 0) || (ethCh < 0 && btcCh < 0);
    alignment = sameSign ? "aligned" : "divergent";
  }

  const summary =
    alignment === "divergent"
      ? `ETH ${ethCh >= 0 ? "+" : ""}${ethCh.toFixed(2)}% vs BTC ${btcCh >= 0 ? "+" : ""}${btcCh.toFixed(2)}% — cross-asset divergence.`
      : `ETH ${ethCh >= 0 ? "+" : ""}${ethCh.toFixed(2)}% tracks BTC ${btcCh >= 0 ? "+" : ""}${btcCh.toFixed(2)}% — risk-on/off aligned.`;

  return {
    ethPrice: ethQuote.price,
    ethChange24hPct: ethCh,
    btcChange24hPct: btcCh,
    alignment,
    summary,
  };
}
