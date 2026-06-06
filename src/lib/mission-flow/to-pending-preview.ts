import type { BinanceOrderPreview } from "@/lib/exchange/binance/binance-types";
import type { MissionFlowPendingPreview } from "./types";

export function toMissionFlowPendingPreview(
  preview: BinanceOrderPreview,
): MissionFlowPendingPreview {
  return {
    previewId: preview.previewId,
    symbol: preview.symbol,
    side: preview.side,
    notionalUsd: preview.notionalUsd,
    estimatedQty: preview.estimatedQty,
    markPrice: preview.markPrice,
    expiresAt: preview.expiresAt,
    blocked: preview.blocked,
    blockReasons: preview.blockReasons,
    reason: preview.reason,
    decisionLogId: preview.decisionLogId,
  };
}
