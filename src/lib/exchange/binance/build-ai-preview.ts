import type { AnalyzeApiResponse } from "@/lib/types/market";
import { GOAL_MIN_TRADES_FOR_TRUST } from "@/lib/goal-engine/types";
import { loadBinanceConfig } from "./binance-config";
import { resolveTrustScaledNotionalUsd } from "./trust-scaled-notional";
import type { BinanceOrderPreviewInput, BinanceOrderSide } from "./binance-types";

export function inferBinanceSideFromAnalysis(
  data: AnalyzeApiResponse | null,
): BinanceOrderSide {
  const verdict =
    data?.tradingDesk?.weightedCommittee?.weightedVerdict ??
    data?.step5_verdict?.recommendation ??
    "WAIT";
  const v = String(verdict).toUpperCase();
  // Short premium desk: TRADE often implies short bias → SELL futures
  if (v === "TRADE" || v === "SHORT") return "SELL";
  if (v === "LONG") return "BUY";
  return "SELL";
}

export function inferBinanceSymbolFromAnalysis(
  data: AnalyzeApiResponse | null,
): string {
  const asset =
    data?.marketSnapshot?.symbol ??
    data?.step1_marketSnapshot?.symbol ??
    "BTC";
  const normalized = String(asset).toUpperCase().replace(/[^A-Z]/g, "");
  const config = loadBinanceConfig();
  const candidate = normalized.endsWith("USDT")
    ? normalized
    : `${normalized}USDT`;
  if (config.allowedSymbols.includes(candidate)) return candidate;
  return config.allowedSymbols[0] ?? "BTCUSDT";
}

export function buildBinancePreviewInputFromAiSignal(input: {
  data: AnalyzeApiResponse | null;
  decisionLogId?: string | null;
  notionalUsd?: number;
  completedTrades?: number;
  minTradesForTrust?: number;
  symbol?: string;
  side?: BinanceOrderSide;
  reason?: string;
}): BinanceOrderPreviewInput {
  const config = loadBinanceConfig();
  const notionalUsd =
    input.notionalUsd ??
    resolveTrustScaledNotionalUsd({
      completedTrades: input.completedTrades ?? 0,
      minRequired: input.minTradesForTrust ?? GOAL_MIN_TRADES_FOR_TRUST,
      maxNotionalUsd: config.maxNotionalUsd,
    });
  return {
    source: "ai_signal",
    symbol: input.symbol ?? inferBinanceSymbolFromAnalysis(input.data),
    side: input.side ?? inferBinanceSideFromAnalysis(input.data),
    notionalUsd,
    reason: input.reason ?? "AI desk signal → Binance testnet preview",
    decisionLogId: input.decisionLogId ?? null,
  };
}
