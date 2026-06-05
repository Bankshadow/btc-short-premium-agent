import type { DeskManagerAction } from "@/lib/autonomous-desk-manager/types";
import type { DeskIncident, GovernanceDeskState } from "@/lib/governance/governance-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { ExchangeStatusResult } from "@/lib/exchange/types";
import type { LiveReadinessReport } from "@/lib/live-readiness/types";
import type { ServerReadinessContext } from "@/lib/live-readiness/types";
import type { LiveTradeJournalEntry, PilotStatusSnapshot } from "@/lib/live-pilot/types";
import type { PerpPaperPosition } from "@/lib/multi-asset/types";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { KillSwitchStatus } from "@/lib/validation/validation-types";
import type { RiskBudgetResult } from "@/lib/risk-budget-optimizer/types";
import type { StrategyAdaptationProposal } from "@/lib/strategy-adaptation/types";
import type { StrategyExperiment } from "@/lib/strategy-experiments/types";
import type { PersistedStrategyRegistry } from "@/lib/strategy-registry/strategy-registry-store";
import type { TradeFrequencyGovernorOutput } from "@/lib/frequency/trade-frequency-governor";
import type { DeskHealthSnapshot } from "@/lib/operator/desk-health";
import type { UnifiedPaperPosition } from "@/lib/portfolio/unified-types";

export const COMMAND_CENTER_SAFETY_NOTICE =
  "Command center can pause or reduce risk only — it cannot increase risk, approve AI proposals, or bypass governance.";

export type CommandCenterStatus = "SAFE" | "CAUTION" | "BLOCKED" | "EMERGENCY";

export type CommandCenterBlockerId =
  | "exchange_disconnected"
  | "kill_switch_active"
  | "daily_loss_limit_breached"
  | "unresolved_critical_incident"
  | "live_readiness_fail"
  | "missing_alert_channel"
  | "governance_pause_active"
  | "data_trust_critical"
  | "pilot_emergency_stop";

export interface CommandCenterBlocker {
  id: CommandCenterBlockerId;
  label: string;
  detail: string;
  hard: boolean;
}

export interface SystemHealthPanel {
  deskHealth: DeskHealthSnapshot;
  lastAnalyzedAt: string | null;
  sourceErrorCount: number;
  automationEnabled: boolean;
  pauseAnalysis: boolean;
  safeMode: boolean;
}

export interface ExchangeConnectivityPanel {
  configured: boolean;
  connected: boolean;
  network: string | null;
  clockSkewMs: number | null;
  error: string | null;
  linearPositionCount: number;
  optionPositionCount: number;
}

export interface OpenPaperPositionsPanel {
  optionsOpen: number;
  perpOpen: number;
  totalOpen: number;
  positions: UnifiedPaperPosition[];
}

export interface OpenLivePositionsPanel {
  pilotOpen: number;
  exchangeLinearOpen: number;
  openTrades: LiveTradeJournalEntry[];
}

export interface ActiveAiActionsPanel {
  pendingDeskManager: number;
  pendingActions: DeskManagerAction[];
}

export interface PendingApprovalsPanel {
  adaptationPending: number;
  adaptationProposals: StrategyAdaptationProposal[];
}

export interface ActiveExperimentsPanel {
  running: number;
  experiments: StrategyExperiment[];
}

export interface StrategyRegistryPanel {
  overrideCount: number;
  recentChanges: Array<{
    strategyId: string;
    status: string;
    note: string;
    at: string;
  }>;
}

export interface AlertsStatusPanel {
  alertsDisabled: boolean;
  telegramConfigured: boolean;
  discordConfigured: boolean;
  deskWebhookConfigured: boolean;
  anyChannelReady: boolean;
}

export interface IncidentStatusPanel {
  openCount: number;
  criticalOpen: number;
  incidents: DeskIncident[];
}

export interface KillSwitchPanel {
  tradingPaused: boolean;
  activeReasons: string[];
  messages: string[];
  operatorPaused: boolean;
  cooldownUntil: string | null;
}

export interface DailyTradingLimitsPanel {
  killSwitch: Pick<
    KillSwitchStatus,
    "dailyPnlPct" | "weeklyPnlPct" | "consecutiveLosses"
  >;
  frequency: TradeFrequencyGovernorOutput;
  pilotTradesToday: number;
  pilotDailyLossUsd: number;
  pilotDailyTradeLimit: number;
  pilotDailyLossLimitUsd: number;
}

export interface CommandCenterPanels {
  systemHealth: SystemHealthPanel;
  exchangeConnectivity: ExchangeConnectivityPanel;
  liveReadiness: Pick<
    LiveReadinessReport,
    "overallStatus" | "overallScore" | "hardBlockers" | "readyForSmallLivePerpPilot"
  >;
  riskBudget: RiskBudgetResult | null;
  openPaperPositions: OpenPaperPositionsPanel;
  openLivePositions: OpenLivePositionsPanel;
  activeAiActions: ActiveAiActionsPanel;
  pendingApprovals: PendingApprovalsPanel;
  activeExperiments: ActiveExperimentsPanel;
  strategyRegistry: StrategyRegistryPanel;
  alertsStatus: AlertsStatusPanel;
  incidentStatus: IncidentStatusPanel;
  killSwitch: KillSwitchPanel;
  dailyTradingLimits: DailyTradingLimitsPanel;
}

export interface CommandCenterReport {
  generatedAt: string;
  status: CommandCenterStatus;
  statusLabel: string;
  blockers: CommandCenterBlocker[];
  cautions: string[];
  panels: CommandCenterPanels;
  safetyNotice: string;
  cannotIncreaseRisk: true;
  cannotAutoApproveProposals: true;
  cannotBypassGovernance: true;
}

export interface CommandCenterInput {
  entries: DecisionLogEntry[];
  orders: PaperOrder[];
  perpPositions?: PerpPaperPosition[];
  paperPositions?: UnifiedPaperPosition[];
  riskProfile: DeskRiskProfile;
  governance?: GovernanceDeskState;
  incidents?: DeskIncident[];
  latestAnalysis?: AnalyzeApiResponse | null;
  riskBudget?: RiskBudgetResult | null;
  livePilotJournal?: LiveTradeJournalEntry[];
  emergencyStopActive?: boolean;
  deskManagerActions?: DeskManagerAction[];
  adaptationProposals?: StrategyAdaptationProposal[];
  experiments?: StrategyExperiment[];
  registry?: PersistedStrategyRegistry | null;
  automationEnabled?: boolean;
  serverContext: ServerReadinessContext;
}

export type CommandCenterActionType =
  | "PAUSE_ANALYSIS"
  | "PAUSE_PAPER_TRADING"
  | "PAUSE_LIVE_PILOT"
  | "TRIGGER_KILL_SWITCH"
  | "REVIEW_PENDING_PROPOSAL"
  | "OPEN_LIVE_SUPERVISOR"
  | "OPEN_INCIDENT_REPORT"
  | "EXPORT_DAILY_REPORT";

export interface CommandCenterActionRequest {
  action: CommandCenterActionType;
  operatorNote?: string;
  proposalId?: string;
}

export interface CommandCenterGovernancePatch {
  pauseAnalysis?: boolean;
  pausePaperAutoOpen?: boolean;
  safeMode?: boolean;
  operatorPaused?: boolean;
  operatorPauseReason?: string;
  operatorPausedAt?: string | null;
  cooldownUntil?: string | null;
}

export interface CommandCenterActionResult {
  ok: boolean;
  action: CommandCenterActionType;
  riskReducingOnly: true;
  clientMustPersist: boolean;
  governancePatch?: CommandCenterGovernancePatch;
  killSwitchPatch?: {
    operatorPaused: boolean;
    operatorPauseReason: string;
    operatorPausedAt: string | null;
    cooldownUntil: string | null;
  };
  pilotEmergencyStop?: boolean;
  navigateTo?: string;
  exportReport?: string;
  message: string;
  error?: string;
}

export type { PilotStatusSnapshot, ExchangeStatusResult };
