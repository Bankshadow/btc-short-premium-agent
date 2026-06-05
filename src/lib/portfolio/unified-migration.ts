import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { PerpPaperPosition } from "@/lib/multi-asset/types";
import type { AgentRecommendation } from "@/lib/agents/types";
import {
  loadPerpPositions,
  PERP_PAPER_STORAGE_KEY,
} from "@/lib/multi-asset/perp-paper-store";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/** Adds trace metadata to perp rows without removing existing fields. */
export function enrichPerpPositionMetadata(
  position: PerpPaperPosition,
  riskProfile: DeskRiskProfile,
): PerpPaperPosition {
  const verdict: AgentRecommendation =
    position.verdict ??
    (position.direction === "LONG" || position.direction === "SHORT"
      ? "TRADE"
      : "WAIT");

  return {
    ...position,
    decisionLogId: position.decisionLogId ?? `perp-trace-${position.id}`,
    sourceAgent: position.sourceAgent ?? "Perp Directional Agent",
    strategyName: position.strategyName ?? "perp_directional",
    verdict,
    riskProfile: position.riskProfile ?? riskProfile,
  };
}

function perpNeedsMigration(
  position: PerpPaperPosition,
  riskProfile: DeskRiskProfile,
): boolean {
  const enriched = enrichPerpPositionMetadata(position, riskProfile);
  return (
    enriched.decisionLogId !== position.decisionLogId ||
    enriched.sourceAgent !== position.sourceAgent ||
    enriched.strategyName !== position.strategyName ||
    enriched.verdict !== position.verdict ||
    enriched.riskProfile !== position.riskProfile
  );
}

/**
 * Soft migration: persists optional metadata fields on perp positions only when missing.
 * Does not delete or rewrite unrelated data.
 */
export function migratePerpPositionsInStorage(
  riskProfile: DeskRiskProfile = "balanced",
): { positions: PerpPaperPosition[]; changed: boolean } {
  if (!isBrowser()) {
    return { positions: [], changed: false };
  }

  const current = loadPerpPositions();
  let changed = false;
  const next = current.map((p) => {
    if (!perpNeedsMigration(p, riskProfile)) return p;
    changed = true;
    return enrichPerpPositionMetadata(p, riskProfile);
  });

  if (changed) {
    localStorage.setItem(PERP_PAPER_STORAGE_KEY, JSON.stringify(next));
  }

  return { positions: next, changed };
}

export const UNIFIED_PORTFOLIO_META_STORAGE_KEY =
  "btc-desk:unified-paper-meta";

export interface UnifiedPortfolioMeta {
  lastSyncedAt: string | null;
  lastMigrationAt: string | null;
  perpMigrationVersion: number;
}

export const UNIFIED_PORTFOLIO_MIGRATION_VERSION = 1;

export function loadUnifiedPortfolioMeta(): UnifiedPortfolioMeta {
  if (!isBrowser()) {
    return {
      lastSyncedAt: null,
      lastMigrationAt: null,
      perpMigrationVersion: 0,
    };
  }
  try {
    const raw = localStorage.getItem(UNIFIED_PORTFOLIO_META_STORAGE_KEY);
    if (!raw) {
      return {
        lastSyncedAt: null,
        lastMigrationAt: null,
        perpMigrationVersion: 0,
      };
    }
    return { ...JSON.parse(raw) } as UnifiedPortfolioMeta;
  } catch {
    return {
      lastSyncedAt: null,
      lastMigrationAt: null,
      perpMigrationVersion: 0,
    };
  }
}

export function saveUnifiedPortfolioMeta(
  patch: Partial<UnifiedPortfolioMeta>,
): UnifiedPortfolioMeta {
  const next = { ...loadUnifiedPortfolioMeta(), ...patch };
  if (isBrowser()) {
    localStorage.setItem(
      UNIFIED_PORTFOLIO_META_STORAGE_KEY,
      JSON.stringify(next),
    );
  }
  return next;
}
