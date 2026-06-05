import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { PerpPaperPosition } from "@/lib/multi-asset/types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import { mapAllToUnifiedPositions } from "./unified-mappers";
import {
  buildEquityCurve,
  buildPnlByAsset,
  buildPnlByStrategy,
  computeUnifiedMetrics,
} from "./unified-metrics";
import { enrichPerpPositionMetadata } from "./unified-migration";
import type {
  UnifiedPaperTrade,
  UnifiedPortfolioInput,
  UnifiedPortfolioSnapshot,
} from "./unified-types";
import { UNIFIED_PORTFOLIO_BASE_EQUITY_USD } from "./unified-types";

export function buildUnifiedPortfolioSnapshot(
  input: UnifiedPortfolioInput = {},
): UnifiedPortfolioSnapshot {
  const entries = input.entries ?? [];
  const orders = input.orders ?? [];
  const riskProfile = input.riskProfile ?? "balanced";
  const baseEquityUsd =
    input.baseEquityUsd ?? UNIFIED_PORTFOLIO_BASE_EQUITY_USD;

  const perpPositions = (input.perpPositions ?? []).map((p) =>
    enrichPerpPositionMetadata(p, riskProfile),
  );

  const all = mapAllToUnifiedPositions({
    orders,
    perpPositions,
    entries,
    riskProfile,
  });

  const openPositions = all.filter((p) => p.status === "OPEN");
  const closedTrades = all.filter(
    (p) => p.status === "CLOSED" || p.status === "CANCELLED",
  ) as UnifiedPaperTrade[];

  const metrics = computeUnifiedMetrics(all, baseEquityUsd);
  const equityCurve = buildEquityCurve(closedTrades, baseEquityUsd);

  const migrationApplied = perpPositions.some(
    (p, i) =>
      (input.perpPositions?.[i]?.decisionLogId ?? null) !==
      (p.decisionLogId ?? null),
  );

  return {
    generatedAt: new Date().toISOString(),
    metrics,
    openPositions,
    closedTrades,
    equityCurve,
    pnlByAsset: buildPnlByAsset(all),
    pnlByStrategy: buildPnlByStrategy(all),
    migrationApplied,
  };
}

export type { DecisionLogEntry, PaperOrder, PerpPaperPosition, DeskRiskProfile };
