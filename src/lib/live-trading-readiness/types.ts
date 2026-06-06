import type { CommandCenterReport } from "@/lib/command-center/types";
import type { LiveReadinessReport } from "@/lib/live-readiness/types";
import type { ScaleUpReport } from "@/lib/live-scale-up/types";
import type { OptionsLiveReadinessReport } from "@/lib/options-execution/options-readiness";
import type { RealTimeRiskReport } from "@/lib/real-time-risk/types";

export type LiveTradingPhase =
  | "paper_validation"
  | "live_readiness"
  | "live_pilot"
  | "live_scale_up"
  | "options_preparation";

export type PhaseStatus = "READY" | "IN_PROGRESS" | "BLOCKED" | "DISABLED";

export interface PaperValidationSnapshot {
  decisionLogCount: number;
  productionDecisionLogCount: number;
  linkedPaperTrades: number;
  linkedShadowTrades: number;
  unlinkedTrades: number;
  pendingResolutions: number;
  resolvedTrades: number;
  everyAnalyzeCreatesLog: boolean;
  paperAutopilotLinked: boolean;
  outcomePipelineReady: boolean;
  blockers: string[];
}

export interface OperationalGateSnapshot {
  syncEnabled: boolean;
  syncHealthy: boolean;
  auditEnabled: boolean;
  auditHealthy: boolean;
  alertsEnabled: boolean;
  killSwitchTested: boolean;
  commandCenterStatus: string;
  realTimeRiskStatus: string;
  exchangeConnected: boolean;
  blockers: string[];
}

export interface LivePilotPhaseSnapshot {
  allowed: boolean;
  mode: string;
  humanApprovalRequired: true;
  doubleConfirmRequired: boolean;
  optionsLiveBlocked: true;
  maxNotionalUsd: number;
  blockers: string[];
}

export interface LiveTradingPlanReport {
  generatedAt: string;
  overallAllowed: boolean;
  perpMicroPilotAllowed: boolean;
  optionsLiveAllowed: false;
  automaticLiveTrading: false;
  phases: Record<
    LiveTradingPhase,
    {
      label: string;
      status: PhaseStatus;
      summary: string;
      nextAction: string;
    }
  >;
  paperValidation: PaperValidationSnapshot;
  operationalGates: OperationalGateSnapshot;
  liveReadiness: LiveReadinessReport | null;
  livePilot: LivePilotPhaseSnapshot;
  scaleUp: ScaleUpReport | null;
  optionsPrep: OptionsLiveReadinessReport | null;
  commandCenter: CommandCenterReport | null;
  realTimeRisk: RealTimeRiskReport | null;
  hardBlockers: string[];
  recommendedNextAction: string;
  safetyNotice: string;
}
