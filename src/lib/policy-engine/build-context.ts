import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { GovernanceDeskState } from "@/lib/governance/governance-types";
import type { CommandCenterReport } from "@/lib/command-center/types";
import type { LiveReadinessReport } from "@/lib/live-readiness/types";
import { preMortemBlocksTicket } from "@/lib/mortem/apply-mortem-layer";
import { evaluateKillSwitch } from "@/lib/validation/kill-switch";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { WorkspaceRole } from "@/lib/platform/types";
import type { PolicyInput, PolicyActionType } from "./types";

export function dataTrustFromAnalysis(
  data: AnalyzeApiResponse | null | undefined,
): PolicyInput["dataTrust"] {
  const dt = data?.dataTrust;
  if (!dt) return null;
  return {
    grade: dt.grade,
    score: dt.score,
    tradeAllowed: dt.tradeAllowed,
    critical: dt.grade === "CRITICAL",
  };
}

export function conflictGateFromAnalysis(
  data: AnalyzeApiResponse | null | undefined,
): PolicyInput["conflictGate"] {
  const gate = data?.conflictGate;
  if (!gate) return null;
  return {
    blocked: gate.tradeBlocked,
    reason: gate.blockReason,
    severity: gate.gateSource,
  };
}

export function preMortemFromAnalysis(
  data: AnalyzeApiResponse | null | undefined,
): PolicyInput["preMortem"] {
  const pm = data?.preMortem;
  if (!pm) return null;
  return {
    blocksTicket: preMortemBlocksTicket(pm),
    level: pm.preMortemVerdict,
    summary: pm.topFailureReason,
  };
}

export function buildPolicyInput(input: {
  workspaceId: string;
  userRole: WorkspaceRole;
  environmentMode: string;
  action: PolicyActionType;
  latestAnalysis?: AnalyzeApiResponse | null;
  governance?: GovernanceDeskState | null;
  commandCenter?: CommandCenterReport | null;
  liveReadiness?: LiveReadinessReport | null;
  entries?: DecisionLogEntry[];
  orders?: PaperOrder[];
  riskProfile?: DeskRiskProfile;
  backboneHealthy?: boolean;
  auditAvailable?: boolean;
  operatorApproval?: boolean;
  doubleConfirm?: boolean;
  observability?: PolicyInput["observability"];
}): PolicyInput {
  const kill = input.entries
    ? evaluateKillSwitch({
        entries: input.entries,
        orders: input.orders ?? [],
        riskProfile: input.riskProfile ?? "balanced",
        latestAnalysis: input.latestAnalysis,
      })
    : null;

  const openPaper = (input.orders ?? []).filter((o) => o.status === "OPEN");

  return {
    workspaceId: input.workspaceId,
    userRole: input.userRole,
    environmentMode: input.environmentMode,
    action: input.action,
    portfolio: {
      openTrades: openPaper.length,
      exposureUsd: openPaper.reduce((s, o) => s + o.notionalUsd, 0),
    },
    risk: {
      killSwitchActive: kill?.tradingPaused ?? false,
      tradingPaused: kill?.tradingPaused ?? false,
      dailyPnlPct: kill?.dailyPnlPct,
      hardRiskVeto: Boolean(
        input.latestAnalysis?.tradingDesk?.committee?.riskVeto ||
          input.latestAnalysis?.tradingDesk?.riskManager?.veto,
      ),
    },
    governance: input.governance ?? null,
    dataTrust: dataTrustFromAnalysis(input.latestAnalysis),
    conflictGate: conflictGateFromAnalysis(input.latestAnalysis),
    preMortem: preMortemFromAnalysis(input.latestAnalysis),
    liveReadiness: input.liveReadiness
      ? {
          status: input.liveReadiness.overallStatus,
          blockers: input.liveReadiness.hardBlockers,
          readyForPilot: input.liveReadiness.readyForSmallLivePerpPilot,
        }
      : null,
    commandCenter: input.commandCenter
      ? {
          status: input.commandCenter.status,
          blockers: input.commandCenter.blockers.map((b) => b.detail),
        }
      : null,
    backboneHealthy: input.backboneHealthy,
    auditAvailable: input.auditAvailable ?? true,
    operatorApproval: input.operatorApproval,
    doubleConfirm: input.doubleConfirm,
    latestAnalysis: input.latestAnalysis,
    preMortemRaw: input.latestAnalysis?.preMortem ?? null,
    observability: input.observability ?? null,
  };
}
