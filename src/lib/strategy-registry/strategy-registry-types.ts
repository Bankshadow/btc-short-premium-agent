import type { CanonicalRegime } from "@/lib/validation/validation-types";
import type { StrategyId } from "@/lib/validation/validation-types";

export type StrategyProductType =
  | "OPTIONS"
  | "SPOT"
  | "FUTURES"
  | "PORTFOLIO";

export type StrategyRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "AGGRESSIVE";

export type StrategyRegistryStatus =
  | "DRAFT"
  | "PAPER_TESTING"
  | "ACTIVE"
  | "WATCHLIST"
  | "DISABLED"
  | "DEPRECATED";

export interface StrategyVersionEntry {
  version: string;
  changedAt: string;
  note: string;
  status: StrategyRegistryStatus;
}

export interface StrategySkill {
  id: StrategyId;
  name: string;
  version: string;
  productType: StrategyProductType;
  allowedRegimes: CanonicalRegime[];
  riskLevel: StrategyRiskLevel;
  requiredData: string[];
  ownerAgent: string;
  status: StrategyRegistryStatus;
  /** Auto-computed 0–100 from desk metrics */
  performanceScore: number;
  winRate: number;
  avgR: number;
  maxDrawdown: number;
  sampleSize: number;
  lastUsed: string | null;
  linkedDraftRules: string[];
  versionHistory: StrategyVersionEntry[];
  /** true when operator set status manually */
  statusLocked: boolean;
  promotionReason: string;
}

export interface StrategyRegistryOverride {
  status?: StrategyRegistryStatus;
  statusLocked?: boolean;
  linkedDraftRules?: string[];
}

export type StrategyRegistryOverrides = Partial<
  Record<StrategyId, StrategyRegistryOverride>
>;

/** Sent on POST /api/analyze so server committee respects registry. */
export interface StrategyRegistryAnalyzePayload {
  strategies: Array<{
    id: StrategyId;
    status: StrategyRegistryStatus;
    linkedDraftRules: string[];
  }>;
}

export interface StrategyRegistrySnapshot {
  strategies: StrategySkill[];
  generatedAt: string;
}
