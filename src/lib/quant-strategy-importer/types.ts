export const QUANT_IMPORT_SAFETY_NOTICE =
  "Imported quant strategies are research-only. They cannot place orders, change live settings, or enable auto-trading without explicit human review and approval.";

export const QUANT_SOURCE_REPO = "je-suis-tm/quant-trading";
export const QUANT_SOURCE_BASE_URL =
  "https://github.com/je-suis-tm/quant-trading";

export type QuantImportStatus =
  | "RESEARCH_ONLY"
  | "READY_FOR_BACKTEST"
  | "READY_FOR_PAPER"
  | "REJECTED";

export type SuggestedUse =
  | "ENTRY"
  | "EXIT"
  | "FILTER"
  | "RISK_GATE"
  | "RESEARCH_ONLY";

export interface StrategySource {
  sourceId: string;
  sourceUrl: string;
  repoName: string;
  strategyName: string;
  category: string;
  description: string;
  originalAssumptions: string[];
  riskNotes: string[];
  importStatus: QuantImportStatus;
}

export interface ImportedStrategyCard extends StrategySource {
  thesis: string;
  marketRegimeFit: string[];
  cryptoAdaptationNotes: string[];
  requiredData: string[];
  riskWarning: string;
  suggestedUse: SuggestedUse;
  aiReviewSummary: string;
  importedAt: string;
  lastReviewedAt: string | null;
  /** Hard safety flag — imported strategies never auto-execute. */
  humanApprovalRequired: true;
  executionBlocked: true;
}

export interface QuantImporterCatalog {
  generatedAt: string;
  sourceRepo: string;
  sourceUrl: string;
  analysisOnly: true;
  noLiveExecution: true;
  noAutoTrading: true;
  safetyNotice: string;
  strategies: ImportedStrategyCard[];
  statusCounts: Record<QuantImportStatus, number>;
}

export interface PromoteImportInput {
  sourceId: string;
  targetStatus: "READY_FOR_BACKTEST" | "READY_FOR_PAPER" | "REJECTED";
  humanApproval: boolean;
  operatorNote?: string;
}

export interface PromoteImportResult {
  ok: boolean;
  card: ImportedStrategyCard | null;
  backtestUrl: string | null;
  message: string;
  executionBlocked: true;
}
