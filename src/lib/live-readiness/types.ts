import type { DeskIncident, GovernanceDeskState } from "@/lib/governance/governance-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { DeskCloudSettings } from "@/lib/desk/desk-settings";
import type { ExchangeStatusResult } from "@/lib/exchange/types";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { OperatorOverrideLogEntry } from "@/lib/governance/governance-types";
import type { PerpPaperPosition } from "@/lib/multi-asset/types";
import type { BacktestReadinessBridge } from "@/lib/historical-backtest/types";
import type { RiskBudgetResult } from "@/lib/risk-budget-optimizer/types";

export type ReadinessStatus = "PASS" | "WARNING" | "FAIL";

export type ReadinessCategoryId =
  | "data_readiness"
  | "paper_performance_readiness"
  | "risk_control_readiness"
  | "governance_readiness"
  | "exchange_connectivity_readiness"
  | "automation_readiness"
  | "alert_readiness"
  | "operator_discipline_readiness"
  | "environment_variable_readiness"
  | "kill_switch_readiness";

export interface ReadinessCategoryResult {
  id: ReadinessCategoryId;
  label: string;
  status: ReadinessStatus;
  score: number;
  reasons: string[];
  blockingIssues: string[];
  recommendedActions: string[];
}

export interface StrictPaperMetrics {
  closedTrades: number;
  winRate: number;
  avgPnlPct: number;
  maxDrawdownPct: number;
  recentLossStreak: number;
  expectancy: number;
  relaxedExcludedCount: number;
}

export interface ServerReadinessContext {
  exchangeStatus: ExchangeStatusResult;
  liveExecution: {
    enabled: boolean;
    configured: boolean;
    network: string | null;
    requireDoubleConfirm: boolean;
  };
  maxLiveNotionalUsd: number;
  cronSecretConfigured: boolean;
  supabaseConfigured: boolean;
  telegramConfigured: boolean;
  discordEnvConfigured: boolean;
  deskWebhookConfigured: boolean;
  llmConfigured: boolean;
  serverAutomationAllowed: boolean;
  timestamp: string;
}

export interface LiveReadinessInput {
  entries: DecisionLogEntry[];
  orders: PaperOrder[];
  perpPositions?: PerpPaperPosition[];
  riskProfile: DeskRiskProfile;
  governance?: GovernanceDeskState;
  incidents?: DeskIncident[];
  overrideLog?: OperatorOverrideLogEntry[];
  deskSettings?: DeskCloudSettings;
  latestAnalysis?: AnalyzeApiResponse | null;
  backtestBridge?: BacktestReadinessBridge | null;
  riskBudget?: RiskBudgetResult | null;
  serverContext: ServerReadinessContext;
}

export interface LiveReadinessReport {
  generatedAt: string;
  overallStatus: ReadinessStatus;
  overallScore: number;
  readyForSmallLivePerpPilot: boolean;
  btcOptionsLiveSupported: false;
  categories: ReadinessCategoryResult[];
  hardBlockers: string[];
  recommendedNextActions: string[];
  strictPaperMetrics: StrictPaperMetrics;
  liveModeVisibility: {
    liveExecutionEnabled: boolean;
    requireDoubleConfirm: boolean;
    exchangeConfigured: boolean;
    exchangeConnected: boolean;
    network: string | null;
    maxLiveNotionalUsd: number;
    note: string;
  };
  safetyNotice: string;
}

export interface ReadinessReportExport {
  markdown: string;
  text: string;
  json: LiveReadinessReport;
}
