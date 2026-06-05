import type { HypotheticalAction } from "@/lib/types/market";
import type { RealTimeRiskReport } from "@/lib/real-time-risk/types";
import type { OptionsOrderPreview } from "@/lib/options-execution/types";

export const OPTIONS_DRY_RUN_SAFETY_NOTICE =
  "DRY-RUN ONLY — no real BTC options orders are sent. Dry-run cannot enable live mode or call exchange write endpoints.";

export type OptionsDryRunRiskStatus = "PASS" | "WARNING" | "FAIL";

export interface OptionsDryRunGreeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  iv: number;
}

export interface OptionsDryRunResult {
  dryRunId: string;
  decisionLogId: string;
  instrument: string;
  side: "short" | "long";
  qty: number;
  premium: number;
  bidAskSpread: number;
  estimatedMargin: number;
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  riskStatus: OptionsDryRunRiskStatus;
  wouldSubmit: boolean;
  rejectionReasons: string[];
  createdAt: string;
  /** Full preview artifact for audit */
  preview: OptionsOrderPreview;
  realTimeRisk: RealTimeRiskReport | null;
  simulatedExchangeDecision: "ACCEPT" | "REJECT";
  dryRunOnly: true;
  noRealOrders: true;
  cannotEnableLive: true;
  disclaimer: string;
  rejectionCategory?:
    | "liquidity"
    | "margin"
    | "governance"
    | "risk_engine"
    | "mapping"
    | "production_block"
    | "other"
    | null;
  playbookAction?: HypotheticalAction;
}

export interface OptionsDryRunInput {
  ticket?: import("@/lib/trade-control/trade-control-types").OrderTicket;
  data?: import("@/lib/types/market").AnalyzeApiResponse | null;
  candidate?: import("@/lib/types/market").OptionCandidate | null;
  decisionLogId?: string;
  entries?: import("@/lib/journal/decision-log-types").DecisionLogEntry[];
  orders?: import("@/lib/paper/paper-order-types").PaperOrder[];
  governance?: import("@/lib/governance/governance-types").GovernanceDeskState;
  incidents?: import("@/lib/governance/governance-types").DeskIncident[];
  journal?: import("@/lib/options-execution/types").OptionsPreviewJournalEntry[];
  history?: OptionsDryRunResult[];
}

export interface RejectedTradeAnalysis {
  reason: string;
  count: number;
  category: string;
}

export interface PaperVsDryRunComparison {
  paperTrades: number;
  dryRuns: number;
  paperWouldSubmitMatchPct: number;
  dryRunWouldSubmitCount: number;
  alignedDecisions: number;
}

export interface OptionsDryRunPerformanceReport {
  generatedAt: string;
  totalDryRuns: number;
  wouldSubmitCount: number;
  wouldBeLiveWinRatePct: number | null;
  rejectedTradeAnalysis: RejectedTradeAnalysis[];
  paperVsDryRun: PaperVsDryRunComparison;
  missedDueToLiquidity: number;
  missedDueToMargin: number;
  rejectedByGovernance: number;
  rejectedByRiskEngine: number;
  recentResults: OptionsDryRunResult[];
  readinessContribution: {
    dryRunSampleSize: number;
    wouldSubmitRatePct: number;
    readyForLiveGate: boolean;
    blockers: string[];
  };
  safetyNotice: string;
  cannotEnableLive: true;
}
