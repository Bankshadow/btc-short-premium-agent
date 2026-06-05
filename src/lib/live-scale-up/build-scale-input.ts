import { buildCommandCenterReport } from "@/lib/command-center/evaluate-status";
import { buildCommandCenterServerContext } from "@/lib/command-center/server-context";
import { buildLiveReadinessReport } from "@/lib/live-readiness/build-readiness-report";
import { enrichRealTimeRiskInput, evaluateRealTimeRisk } from "@/lib/real-time-risk";
import { buildScaleUpReport } from "./build-scale-report";
import { getEffectiveScaleStage, loadServerScaleState } from "./scale-store";
import type { LiveScaleStage, ScaleUpInput, ScaleUpReport } from "./types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { LiveTradeJournalEntry } from "@/lib/live-pilot/types";
import type { PerpPaperPosition } from "@/lib/multi-asset/types";
import type { GovernanceDeskState, DeskIncident } from "@/lib/governance/governance-types";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { RiskBudgetResult } from "@/lib/risk-budget-optimizer/types";

export type ScaleUpClientPayload = {
  currentStage?: LiveScaleStage;
  journal?: LiveTradeJournalEntry[];
  incidents?: DeskIncident[];
  entries?: DecisionLogEntry[];
  orders?: PaperOrder[];
  perpPositions?: PerpPaperPosition[];
  riskProfile?: DeskRiskProfile;
  governance?: GovernanceDeskState;
  latestAnalysis?: AnalyzeApiResponse | null;
  riskBudget?: RiskBudgetResult | null;
  emergencyStopActive?: boolean;
};

export async function buildScaleUpInput(
  client: ScaleUpClientPayload,
): Promise<{ input: ScaleUpInput; currentStage: LiveScaleStage }> {
  const serverContext = await buildCommandCenterServerContext();
  const serverState = await loadServerScaleState();
  const currentStage = await getEffectiveScaleStage(
    client.currentStage ?? serverState.currentStage,
  );

  const readiness = buildLiveReadinessReport({
    entries: client.entries ?? [],
    orders: client.orders ?? [],
    perpPositions: client.perpPositions,
    riskProfile: client.riskProfile ?? "balanced",
    governance: client.governance,
    incidents: client.incidents,
    latestAnalysis: client.latestAnalysis,
    riskBudget: client.riskBudget,
    serverContext,
  });

  const commandCenter = buildCommandCenterReport({
    entries: client.entries ?? [],
    orders: client.orders ?? [],
    perpPositions: client.perpPositions,
    riskProfile: client.riskProfile ?? "balanced",
    governance: client.governance,
    incidents: client.incidents,
    latestAnalysis: client.latestAnalysis,
    riskBudget: client.riskBudget,
    livePilotJournal: client.journal,
    emergencyStopActive: client.emergencyStopActive,
    serverContext,
  });

  const riskInput = await enrichRealTimeRiskInput({
    entries: client.entries ?? [],
    orders: client.orders ?? [],
    perpPositions: client.perpPositions,
    liveTrades: client.journal,
    governance: client.governance,
    incidents: client.incidents,
    riskBudget: client.riskBudget,
    emergencyStopActive: client.emergencyStopActive,
    market: client.latestAnalysis,
    commandCenter,
  });
  const realTimeRisk = evaluateRealTimeRisk(riskInput);

  const input: ScaleUpInput = {
    currentStage,
    journal: client.journal ?? [],
    incidents: client.incidents ?? [],
    readiness,
    realTimeRisk,
    commandCenter,
    governance: client.governance,
    emergencyStopActive: client.emergencyStopActive,
    exchangeStatus: serverContext.exchangeStatus,
    approvalHistory: serverState.approvalHistory,
    entries: client.entries,
  };

  return { input, currentStage };
}

export async function buildScaleUpStatus(
  client: ScaleUpClientPayload,
): Promise<{ report: ScaleUpReport; currentStage: LiveScaleStage }> {
  const { input, currentStage } = await buildScaleUpInput(client);
  return { report: buildScaleUpReport(input), currentStage };
}
