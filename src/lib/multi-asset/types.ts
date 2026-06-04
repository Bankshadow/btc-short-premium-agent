import type { PerpAssetId } from "./asset-config";

export type PerpDirection = "LONG" | "SHORT" | "FLAT";
export type SignalConfidence = "HIGH" | "MEDIUM" | "LOW";

export interface PerpDirectionalSignal {
  assetId: PerpAssetId;
  symbol: string;
  label: string;
  hasOptions: boolean;
  price: number;
  priceChange24hPct: number;
  fundingRatePct: number | null;
  trend: "bullish" | "bearish" | "neutral";
  rsi14: number;
  macdHistogram: number;
  atr: number;
  /** Directional conviction score, -100 (max short) .. +100 (max long). */
  score: number;
  direction: PerpDirection;
  confidence: SignalConfidence;
  /** True when this signal is strong enough to open a paper position. */
  actionable: boolean;
  suggestedSizePct: number;
  stopLoss: number | null;
  takeProfit: number | null;
  reasons: string[];
  risks: string[];
  dataFresh: boolean;
  error?: string;
}

export interface MultiAssetScanResult {
  generatedAt: string;
  signals: PerpDirectionalSignal[];
  actionableCount: number;
  errorCount: number;
  disclaimer: string;
}

export type PerpPositionStatus = "OPEN" | "CLOSED";

export interface PerpPaperPosition {
  id: string;
  assetId: PerpAssetId;
  symbol: string;
  label: string;
  direction: Exclude<PerpDirection, "FLAT">;
  entryPrice: number;
  sizePct: number;
  notionalUsd: number;
  stopLoss: number | null;
  takeProfit: number | null;
  confidence: SignalConfidence;
  status: PerpPositionStatus;
  openedAt: string;
  openedBy: "scanner_auto" | "manual";
  reason: string;
  lastMarkPrice: number;
  lastMarkAt: string;
  unrealizedPnlPct: number;
  closedAt: string | null;
  exitPrice: number | null;
  realizedPnlPct: number | null;
}
