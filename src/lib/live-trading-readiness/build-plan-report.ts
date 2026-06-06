import { buildCommandCenterReport } from "@/lib/command-center/evaluate-status";
import type { CommandCenterInput } from "@/lib/command-center/types";
import { buildLiveReadinessReport } from "@/lib/live-readiness/build-readiness-report";
import type { LiveReadinessInput } from "@/lib/live-readiness/types";
import { buildScaleUpReport } from "@/lib/live-scale-up/build-scale-report";
import type { ScaleUpInput } from "@/lib/live-scale-up/types";
import { buildOptionsLiveReadinessReport } from "@/lib/options-execution/options-readiness";
import { evaluateRealTimeRisk } from "@/lib/real-time-risk/evaluate-realtime-risk";
import type { RealTimeRiskInput } from "@/lib/real-time-risk/types";
import { LIVE_TRADING_PLAN_SAFETY_NOTICE } from "./safety";
import { buildOperationalGates } from "./operational-gates";
import { buildPaperValidationSnapshot } from "./paper-validation";
import type {
  LivePilotPhaseSnapshot,
  LiveTradingPhase,
  LiveTradingPlanReport,
  PhaseStatus,
} from "./types";

function phaseStatus(
  blockers: string[],
  ready: boolean,
  disabled?: boolean,
): PhaseStatus {
  if (disabled) return "DISABLED";
  if (blockers.length > 0) return "BLOCKED";
  if (ready) return "READY";
  return "IN_PROGRESS";
}

function buildLivePilotSnapshot(input: {
  readinessAllowed: boolean;
  scaleTradingAllowed: boolean;
  operationalBlockers: string[];
  requireDoubleConfirm: boolean;
  maxNotional: number;
  pilotMode: string;
}): LivePilotPhaseSnapshot {
  const blockers = [...input.operationalBlockers];
  if (!input.readinessAllowed) {
    blockers.push("Live readiness checklist not passed.");
  }
  if (!input.scaleTradingAllowed) {
    blockers.push("Live scale-up stage is DISABLED — promote manually on /live-scale-up.");
  }

  return {
    allowed:
      blockers.length === 0 && input.readinessAllowed && input.scaleTradingAllowed,
    mode: input.pilotMode,
    humanApprovalRequired: true,
    doubleConfirmRequired: input.requireDoubleConfirm,
    optionsLiveBlocked: true,
    maxNotionalUsd: input.maxNotional,
    blockers,
  };
}

export function buildLiveTradingPlanReport(input: {
  readinessInput: LiveReadinessInput;
  commandCenterInput?: CommandCenterInput;
  realTimeRiskInput?: RealTimeRiskInput;
  scaleUpInput?: ScaleUpInput | null;
  optionsDryRunHistory?: import("@/lib/options-dry-run/types").OptionsDryRunResult[];
  optionsRiskReport?: import("@/lib/options-risk-greeks/types").OptionsRiskReport | null;
  pilotMode?: string;
  auditEnabled?: boolean;
  alertsGovernanceOff?: boolean;
}): LiveTradingPlanReport {
  const paperValidation = buildPaperValidationSnapshot(
    input.readinessInput.entries,
    input.readinessInput.orders,
  );

  const liveReadiness = buildLiveReadinessReport(input.readinessInput);

  const commandCenter = input.commandCenterInput
    ? buildCommandCenterReport(input.commandCenterInput)
    : null;

  const realTimeRisk = input.realTimeRiskInput
    ? evaluateRealTimeRisk(input.realTimeRiskInput)
    : null;

  const operationalGates = buildOperationalGates({
    deskSettings: input.readinessInput.deskSettings,
    serverContext: input.readinessInput.serverContext,
    commandCenter,
    realTimeRisk,
    auditEnabled: input.auditEnabled,
    alertsGovernanceOff: input.alertsGovernanceOff,
    killSwitchTested: input.readinessInput.killSwitchTested,
  });

  const scaleUp = input.scaleUpInput ? buildScaleUpReport(input.scaleUpInput) : null;

  const optionsPrep = buildOptionsLiveReadinessReport({
    dryRunHistory: input.optionsDryRunHistory,
    optionsRiskReport: input.optionsRiskReport ?? null,
  });

  const livePilot = buildLivePilotSnapshot({
    readinessAllowed: liveReadiness.readyForSmallLivePerpPilot,
    scaleTradingAllowed: scaleUp?.tradingAllowed ?? false,
    operationalBlockers: operationalGates.blockers,
    requireDoubleConfirm: liveReadiness.liveModeVisibility.requireDoubleConfirm,
    maxNotional: liveReadiness.liveModeVisibility.maxLiveNotionalUsd,
    pilotMode: input.pilotMode ?? "LIVE_DISABLED",
  });

  const hardBlockers = [
    ...new Set([
      ...liveReadiness.hardBlockers,
      ...paperValidation.blockers,
      ...operationalGates.blockers,
      ...livePilot.blockers,
    ]),
  ];

  const perpMicroPilotAllowed =
    livePilot.allowed &&
    liveReadiness.readyForSmallLivePerpPilot &&
    operationalGates.blockers.length === 0;

  const phases: LiveTradingPlanReport["phases"] = {
    paper_validation: {
      label: "Paper autopilot validation",
      status: phaseStatus(
        paperValidation.blockers,
        paperValidation.outcomePipelineReady,
      ),
      summary: `${paperValidation.productionDecisionLogCount} logs · ${paperValidation.resolvedTrades} resolved · ${paperValidation.pendingResolutions} pending`,
      nextAction:
        paperValidation.blockers[0] ??
        "Continue paper autopilot and resolve closed trades.",
    },
    live_readiness: {
      label: "Live readiness gate",
      status: phaseStatus(
        liveReadiness.hardBlockers,
        liveReadiness.readyForSmallLivePerpPilot,
      ),
      summary: `${liveReadiness.overallStatus} · score ${liveReadiness.overallScore}`,
      nextAction:
        liveReadiness.recommendedNextActions[0] ??
        "Review /live-readiness checklist.",
    },
    live_pilot: {
      label: "Live perp micro pilot",
      status: phaseStatus(
        livePilot.blockers,
        livePilot.allowed,
        !input.readinessInput.serverContext.liveExecution.enabled &&
          input.pilotMode === "LIVE_DISABLED",
      ),
      summary: livePilot.allowed
        ? `Micro pilot ready · max $${livePilot.maxNotionalUsd}`
        : `${livePilot.blockers.length} blocker(s)`,
      nextAction:
        livePilot.blockers[0] ?? "Open /live-pilot for human-approved execution.",
    },
    live_scale_up: {
      label: "Live scale-up",
      status: phaseStatus(
        scaleUp?.shouldAutoDemote ? scaleUp.autoDemoteReasons : [],
        (scaleUp?.currentStage ?? "LIVE_STAGE_0_DISABLED") !== "LIVE_STAGE_0_DISABLED",
        scaleUp?.currentStage === "LIVE_STAGE_0_DISABLED",
      ),
      summary: scaleUp
        ? `${scaleUp.currentStageDefinition.label} · auto-promote disabled`
        : "Stage 0 disabled (default)",
      nextAction: scaleUp?.promotion.eligible
        ? "Operator may approve one-stage promotion on /live-scale-up."
        : scaleUp?.promotion.blockers[0] ?? "Complete micro pilot before promotion.",
    },
    options_preparation: {
      label: "BTC options live preparation",
      status: phaseStatus(
        optionsPrep.checks.filter((c) => c.status === "FAIL").map((c) => c.message),
        optionsPrep.overallStatus === "PASS",
        true,
      ),
      summary: "Testnet only · live disabled",
      nextAction:
        optionsPrep.recommendedActions[0] ??
        "Run options dry-run and testnet drills.",
    },
  };

  const recommendedNextAction =
    hardBlockers[0] ??
    (perpMicroPilotAllowed
      ? "Perp micro pilot allowed — use /live-pilot with approval + double confirm."
      : liveReadiness.recommendedNextActions[0] ??
        "Continue strict paper trading and resolve outcomes.");

  return {
    generatedAt: new Date().toISOString(),
    overallAllowed: perpMicroPilotAllowed,
    perpMicroPilotAllowed,
    optionsLiveAllowed: false,
    automaticLiveTrading: false,
    phases,
    paperValidation,
    operationalGates,
    liveReadiness,
    livePilot,
    scaleUp,
    optionsPrep,
    commandCenter,
    realTimeRisk,
    hardBlockers,
    recommendedNextAction,
    safetyNotice: LIVE_TRADING_PLAN_SAFETY_NOTICE,
  };
}

export function phaseOrder(): LiveTradingPhase[] {
  return [
    "paper_validation",
    "live_readiness",
    "live_pilot",
    "live_scale_up",
    "options_preparation",
  ];
}
