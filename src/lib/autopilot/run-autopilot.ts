import {
  AUTOPILOT_SAFETY_NOTICE,
  DEFAULT_AUTOPILOT_SETTINGS,
  resolveEffectiveMode,
} from "./config";
import { runAutopilotModules } from "./module-runner";
import type {
  AutopilotModuleId,
  AutopilotRunInput,
  AutopilotRunResult,
  AutopilotRunStatus,
} from "./types";

function newRunId(): string {
  return `ap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function verdictFromAnalysis(
  input: AutopilotRunInput,
): AutopilotRunResult["finalVerdict"] {
  const v =
    input.latestAnalysis?.tradingDesk?.weightedCommittee?.weightedVerdict ??
    input.latestAnalysis?.step5_verdict?.recommendation;
  if (v === "TRADE") return "TRADE";
  if (v === "SKIP") return "SKIP";
  if (v === "WAIT") return "WAIT";
  return "NONE";
}

function buildBriefing(input: {
  mode: string;
  deskStatus: string;
  verdict: string;
  confidence: number;
  learningLabel: string;
  primaryAction: string;
  blockers: string[];
}): string {
  const lines = [
    `AI desk cycle · ${input.mode} · status ${input.deskStatus}`,
    `Verdict ${input.verdict} (${input.confidence}% confidence).`,
    input.learningLabel,
    `Next: ${input.primaryAction}`,
  ];
  if (input.blockers.length > 0) {
    lines.push(`Blockers: ${input.blockers.slice(0, 2).join("; ")}`);
  }
  return lines.join(" ");
}

export async function runAutopilotCycle(
  input: AutopilotRunInput = {},
): Promise<AutopilotRunResult> {
  const startedAt = new Date().toISOString();
  const runId = newRunId();
  const settings = {
    ...DEFAULT_AUTOPILOT_SETTINGS,
    ...input.settings,
    liveAutopilotEnabled: false as const,
    requireHumanApprovalForLive: true as const,
  };
  const mode = resolveEffectiveMode(settings);

  if (!settings.autopilotEnabled || mode === "OFF") {
    return {
      runId,
      startedAt,
      completedAt: new Date().toISOString(),
      status: "IDLE",
      mode: "OFF",
      deskStatus: "SAFE",
      finalVerdict: "NONE",
      confidence: 0,
      recommendedAction: "Enable autopilot on /autopilot to run desk cycles.",
      blockers: [],
      actionsCreated: [],
      modulesRun: [],
      modulesSkipped: [],
      portfolioSnapshot: {
        paperPnlPct: 0,
        openPaperTrades: 0,
        sampleSize: 0,
        drawdownPct: 0,
        exposureUsd: 0,
      },
      learningStatus: {
        decisionLogsCount: 0,
        resolvedOutcomesCount: 0,
        paperTradesCount: 0,
        shadowTradesCount: 0,
        strategySampleSize: 0,
        minRequiredSampleSize: 12,
        agentScoreboardReady: false,
        validationReady: false,
        capitalScalingReady: false,
        label: "Autopilot off",
        detail: "Turn on autopilot to start the operating loop.",
      },
      briefing: "Autopilot is off.",
      analyze: input.latestAnalysis ?? null,
      nextRunAt: null,
      errors: [],
      cannotEnableLiveAutopilot: true,
      safetyNotice: AUTOPILOT_SAFETY_NOTICE,
    };
  }

  const modules: AutopilotModuleId[] = [
    "portfolio",
    "validation",
    "strategy_registry",
    "learning",
    "alert_check",
    "sync_check",
    "command_center",
    "action_queue",
  ];
  if (input.latestAnalysis && !input.skipAnalyze) {
    modules.unshift("analyze");
  }

  const errors: string[] = [];
  let status: AutopilotRunStatus = "RUNNING";

  try {
    const out = await runAutopilotModules({
      runInput: input,
      modules,
    });

    const moduleErrors = out.results
      .filter((r) => r.status === "ERROR")
      .map((r) => r.error ?? r.summary);
    errors.push(...moduleErrors);

    const verdict = verdictFromAnalysis(input);
    const confidence =
      input.latestAnalysis?.step5_verdict?.confidence ??
      input.latestAnalysis?.tradingDesk?.weightedCommittee?.tradeScore ??
      0;
    const primaryAction =
      out.actions[0]?.title ?? "Monitor desk — no urgent actions.";

    const nextRunAt = new Date(
      Date.now() + settings.runIntervalMinutes * 60_000,
    ).toISOString();

    status =
      out.deskStatus === "EMERGENCY" || out.deskStatus === "BLOCKED"
        ? "BLOCKED"
        : moduleErrors.length > 0
          ? "FAILED"
          : "COMPLETED";

    return {
      runId,
      startedAt,
      completedAt: new Date().toISOString(),
      status,
      mode,
      deskStatus: out.deskStatus,
      finalVerdict: verdict,
      confidence,
      recommendedAction: primaryAction,
      blockers: out.blockers,
      actionsCreated: out.actions,
      modulesRun: out.results,
      modulesSkipped: out.skipped,
      portfolioSnapshot: out.portfolioBrief,
      learningStatus: out.learningStatus,
      briefing: buildBriefing({
        mode,
        deskStatus: out.deskStatus,
        verdict,
        confidence,
        learningLabel: out.learningStatus.label,
        primaryAction,
        blockers: out.blockers,
      }),
      analyze: input.latestAnalysis ?? null,
      nextRunAt,
      errors,
      cannotEnableLiveAutopilot: true,
      safetyNotice: AUTOPILOT_SAFETY_NOTICE,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Autopilot failed";
    errors.push(message);
    return {
      runId,
      startedAt,
      completedAt: new Date().toISOString(),
      status: "FAILED",
      mode,
      deskStatus: "BLOCKED",
      finalVerdict: verdictFromAnalysis(input),
      confidence: 0,
      recommendedAction: "Review autopilot errors and run desk cycle manually.",
      blockers: [message],
      actionsCreated: [],
      modulesRun: [],
      modulesSkipped: modules,
      portfolioSnapshot: {
        paperPnlPct: 0,
        openPaperTrades: 0,
        sampleSize: 0,
        drawdownPct: 0,
        exposureUsd: 0,
      },
      learningStatus: {
        decisionLogsCount: input.entries?.length ?? 0,
        resolvedOutcomesCount: 0,
        paperTradesCount: 0,
        shadowTradesCount: 0,
        strategySampleSize: 0,
        minRequiredSampleSize: 12,
        agentScoreboardReady: false,
        validationReady: false,
        capitalScalingReady: false,
        label: "Autopilot error",
        detail: message,
      },
      briefing: message,
      analyze: input.latestAnalysis ?? null,
      nextRunAt: null,
      errors,
      cannotEnableLiveAutopilot: true,
      safetyNotice: AUTOPILOT_SAFETY_NOTICE,
    };
  }
}
