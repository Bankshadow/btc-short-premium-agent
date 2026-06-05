import type { CouncilSessionResult } from "@/lib/council/types";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { MultiAssetScanResult } from "@/lib/multi-asset/types";
import type { ExchangeStatusResult } from "@/lib/exchange/types";
import type { LiveExecuteResult } from "@/lib/exchange/types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { PerpPaperPosition } from "@/lib/multi-asset/types";
import type { UnifiedPortfolioSnapshot } from "@/lib/portfolio/unified-types";
import type { RegretMetrics } from "@/lib/mortem/types";
import type { TradeFrequencyGovernorOutput } from "@/lib/frequency/trade-frequency-governor";
import type { CapitalReport } from "@/lib/capital/capital-types";
import type { ValidationReport } from "@/lib/validation/validation-types";

export type AutomationModuleId =
  | "analyze"
  | "assets"
  | "council"
  | "mortem"
  | "simulation"
  | "war_room"
  | "capital"
  | "validation"
  | "frequency"
  | "exchange"
  | "operator";

export type AutomationActionType =
  | "OPEN_PAPER_PERP"
  | "REVIEW_BTC_TRADE"
  | "COUNCIL_PROPOSAL"
  | "LOWER_RISK"
  | "ENABLE_SAFE_MODE"
  | "PAUSE_PAPER_AUTO"
  | "WAR_ROOM_ALERT"
  | "LIVE_PERP_EXECUTE"
  | "OPERATOR_COOLDOWN"
  | "REGRET_REVIEW";

export interface AutomationAction {
  id: string;
  type: AutomationActionType;
  priority: "HIGH" | "MEDIUM" | "LOW";
  module: AutomationModuleId;
  title: string;
  detail: string;
  autoApplicable: boolean;
  payload?: unknown;
}

export interface DeskAutomationInput {
  entries?: DecisionLogEntry[];
  orders?: PaperOrder[];
  perpPositions?: PerpPaperPosition[];
  riskProfile?: "balanced" | "aggressive";
  currentEquity?: number;
  modules?: AutomationModuleId[];
  topic?: string;
}

export interface ModuleRunMeta {
  ok: boolean;
  durationMs: number;
  error?: string;
}

export interface DeskAutomationResult {
  runId: string;
  timestamp: string;
  modulesRun: AutomationModuleId[];
  meta: Partial<Record<AutomationModuleId, ModuleRunMeta>>;
  analyze: AnalyzeApiResponse | null;
  assets: MultiAssetScanResult | null;
  council: CouncilSessionResult | null;
  mortem: RegretMetrics | null;
  simulation: {
    probabilityRuin: number;
    aggressiveModeSafe: boolean;
    recommendedRiskPct: number;
  } | null;
  warRoom: { scenarioId: string; recommendedAction: string } | null;
  capital: CapitalReport | null;
  validation: ValidationReport | null;
  frequency: TradeFrequencyGovernorOutput | null;
  exchange: ExchangeStatusResult | null;
  operator: { disciplineScore: number; grade: string } | null;
  unifiedPortfolio: UnifiedPortfolioSnapshot | null;
  actions: AutomationAction[];
  summary: string;
  aiBrief: string;
}

export interface DeskAutomationSettings {
  enabled: boolean;
  intervalMinutes: number;
  autoApplyPaper: boolean;
  autoApplySafeMode: boolean;
  lastRunAt: string | null;
  lastRunId: string | null;
}

export const AUTOMATION_SETTINGS_KEY = "btc-desk:automation-settings";
export const AUTOMATION_LAST_RUN_KEY = "btc-desk:automation-last-run";

export const DEFAULT_AUTOMATION_SETTINGS: DeskAutomationSettings = {
  enabled: true,
  intervalMinutes: 15,
  autoApplyPaper: true,
  autoApplySafeMode: false,
  lastRunAt: null,
  lastRunId: null,
};

export interface ApplyAutomationResult {
  applied: string[];
  skipped: string[];
  liveExecute?: LiveExecuteResult;
}
