import { TRADE_BLACK_BOX_DEBUG_PACK_VERSION } from "./config";
import type { TradeBlackBoxDebugPack, TradeBlackBoxRecord } from "./types";
import { TRADE_BLACK_BOX_SAFETY_NOTICE } from "./types";

export function buildDebugPack(record: TradeBlackBoxRecord): TradeBlackBoxDebugPack {
  return {
    packVersion: TRADE_BLACK_BOX_DEBUG_PACK_VERSION,
    generatedAt: new Date().toISOString(),
    tradeId: record.tradeId,
    safetyNotice: TRADE_BLACK_BOX_SAFETY_NOTICE,
    record,
    secretsRedacted: true,
  };
}

export function debugPackFilename(tradeId: string): string {
  const safe = tradeId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `trade-debug-pack-${safe}.json`;
}
