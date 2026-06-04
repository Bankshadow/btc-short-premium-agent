export type DataSourceKind =
  | "BYBIT"
  | "COINGLASS"
  | "MANUAL"
  | "LOCAL_STORAGE"
  | "SUPABASE"
  | "MOCK"
  | "MISSING"
  | "DERIVED";

export type DataConfidenceLevel = "HIGH" | "MEDIUM" | "LOW" | "CRITICAL";

export interface DataProvenanceField {
  fieldName: string;
  value: unknown;
  source: DataSourceKind;
  updatedAt: string | null;
  freshnessSeconds: number | null;
  confidence: DataConfidenceLevel;
  issue?: string;
}

export interface DataConfidenceResult {
  score: number;
  grade: DataConfidenceLevel;
  criticalIssues: string[];
  warnings: string[];
  tradeAllowed: boolean;
}

export type ConflictLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ConflictSuggestedAction = "ALLOW" | "REDUCE_SIZE" | "WAIT" | "SKIP";

export interface StrategyConflictAnalysis {
  conflictScore: number;
  conflictLevel: ConflictLevel;
  conflicts: string[];
  suggestedAction: ConflictSuggestedAction;
}

export type ConflictGateSource =
  | "NONE"
  | "DATA_TRUST"
  | "CONFLICT"
  | "RISK_VETO";

export interface ConflictGateResult {
  tradeBlocked: boolean;
  blockReason: string;
  gateSource: ConflictGateSource;
  originalVerdict: import("@/lib/agents/types").AgentRecommendation;
  gatedVerdict: import("@/lib/agents/types").AgentRecommendation;
  paperOnlyRecommended: boolean;
  statusLabel: string;
}

export interface DataTrustPipelineResult {
  dataTrust: DataConfidenceResult;
  dataProvenance: DataProvenanceField[];
  conflictAnalysis: StrategyConflictAnalysis;
  conflictGate: ConflictGateResult;
}
