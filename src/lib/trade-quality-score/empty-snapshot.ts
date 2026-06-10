import { buildTradeQualitySummary } from "./build-summary";
import type { IntegratedTradeQualitySnapshot } from "./types";
import { TRADE_QUALITY_MVP } from "./types";

const INTEGRATED_LABEL = "Integrated Trade Quality Score";

/** Client-safe empty integrated trade quality snapshot (no fs). */
export function emptyIntegratedTradeQuality(): IntegratedTradeQualitySnapshot {
  return {
    mvp: TRADE_QUALITY_MVP,
    label: INTEGRATED_LABEL,
    summary: buildTradeQualitySummary([]),
    scoresByTradeId: {},
    autoStrategyChangeAllowed: false,
    lastUpdatedAt: new Date().toISOString(),
  };
}
