import type {
  AiStatusCardState,
  AiStatusCommitteeSummary,
  AiStatusEvent,
  AiStatusLoopBlocker,
  AiStatusMemorySummary,
} from "./types";
import type { CommitteeModeratorResult } from "@/lib/parallel-task-runner/types";
import type { SecondBrainMemorySummary } from "@/lib/second-brain/types";
import { AI_STATUS_PROGRESS, AI_STATUS_STEP_LABELS } from "./labels";
import type { LoopGuardBlocker, LoopGuardDecision } from "@/lib/autopilot-loop-guard/types";

const PIPELINE_ORDER = [
  "ANALYSIS_STARTED",
  "MARKET_FETCHED",
  "AGENTS_REVIEWED",
  "RISK_CHECKED",
  "TRADE_CANDIDATE_CREATED",
  "TESTNET_PREVIEW_CREATED",
  "PERMISSION_REQUESTED",
  "ORDER_EXECUTED",
  "POSITION_MONITORED",
  "TRADE_CLOSED",
  "LEARNING_UPDATED",
] as const;

export interface BuildCardStateInput {
  events: AiStatusEvent[];
  permissionNeeded?: boolean;
  permissionReason?: string | null;
  estimatedNextAction?: string;
  activeRunId?: string | null;
  loopGuard?: {
    blocker?: LoopGuardBlocker | null;
    decision?: LoopGuardDecision | null;
    selfCheckSummary?: string | null;
  } | null;
  memorySummary?: SecondBrainMemorySummary | null;
  committee?: {
    committee: CommitteeModeratorResult;
    reviews: { length: number };
    completedAt: string | null;
  } | null;
}

function toAiCommitteeSummary(
  input: BuildCardStateInput["committee"],
): AiStatusCommitteeSummary | null {
  if (!input?.committee) return null;
  const c = input.committee;
  return {
    recommendation: c.recommendation,
    summary: c.summary,
    topReasons: c.topReasons.slice(0, 3),
    agentCount: input.reviews.length,
    actionItemCount: c.actionItems.length,
    lastRunAt: input.completedAt,
  };
}

function toAiMemorySummary(
  summary: SecondBrainMemorySummary | null | undefined,
): AiStatusMemorySummary | null {
  if (!summary) return null;
  return {
    headline: summary.headline,
    consciousHighlights: summary.consciousHighlights,
    topLessons: summary.topLessons,
    lessonCount: summary.lessonCount,
    subconsciousCount: summary.subconsciousCount,
    lastConsolidatedAt: summary.lastConsolidatedAt,
  };
}

function buildLoopBlocker(input: BuildCardStateInput): AiStatusLoopBlocker {
  const blocker = input.loopGuard?.blocker;
  const decision = input.loopGuard?.decision;
  const metrics = decision?.metrics ?? blocker?.metrics;
  const active = Boolean(blocker?.active) || decision?.stopLoop === true;
  const reason =
    blocker?.reason ??
    (decision?.stopLoop ? decision.reason : null) ??
    (decision?.requiresPermission ? decision.reason : null);
  return {
    active,
    reason: reason ?? null,
    riskLevel:
      blocker?.loopRiskLevel ??
      decision?.level ??
      metrics?.loopRiskLevel ??
      null,
    actionDiversityPct:
      metrics != null ? Math.round(metrics.actionDiversity * 100) : null,
    successRatePct:
      metrics != null ? Math.round(metrics.successRate * 100) : null,
    selfCheckSummary: input.loopGuard?.selfCheckSummary ?? decision?.selfCheckSummary ?? null,
  };
}

function isRecent(timestamp: string, maxAgeMs = 120_000): boolean {
  return Date.now() - new Date(timestamp).getTime() < maxAgeMs;
}

export function buildAiStatusCardState(
  input: BuildCardStateInput,
): AiStatusCardState {
  const events = input.events;
  const latest = events[0] ?? null;
  const runEvents = input.activeRunId
    ? events.filter((e) => e.runId === input.activeRunId)
    : events;

  const permissionEvent = events.find((e) => e.type === "PERMISSION_REQUESTED");
  const loopBlocker = buildLoopBlocker(input);
  const permissionNeeded =
    input.permissionNeeded ??
    (loopBlocker.active ||
      loopBlocker.riskLevel === "SUSPICIOUS" ||
      Boolean(permissionEvent && isRecent(permissionEvent.timestamp, 300_000)));

  const latestPipeline = runEvents.find((e) =>
    PIPELINE_ORDER.includes(e.type as (typeof PIPELINE_ORDER)[number]),
  );

  const progressPct = latestPipeline
    ? AI_STATUS_PROGRESS[latestPipeline.type]
    : latest
      ? AI_STATUS_PROGRESS[latest.type] ?? 5
      : 0;

  const isActive =
    latest != null &&
    isRecent(latest.timestamp, 90_000) &&
    latest.type !== "LEARNING_UPDATED" &&
    latest.type !== "TRADE_CLOSED";

  const currentStep = latestPipeline
    ? AI_STATUS_STEP_LABELS[latestPipeline.type]
    : "Idle / scheduled cycle";

  const estimatedNextAction =
    input.estimatedNextAction ??
    (loopBlocker.active
      ? "Clear autopilot loop blocker on AI Status"
      : loopBlocker.riskLevel === "SUSPICIOUS"
        ? "Approve suspicious loop continuation or review self-check"
        : permissionNeeded
          ? "Review and approve the pending action"
          : isActive
            ? "Complete current desk cycle"
            : "Next scheduled autopilot cycle");

  const currentTask = loopBlocker.active
    ? "Autopilot paused — loop guard blocker"
    : isActive
      ? latestPipeline?.label ?? latest?.label ?? "AI desk active"
      : "Standing by — monitoring market";

  return {
    updatedAt: new Date().toISOString(),
    currentTask,
    currentStep: loopBlocker.active ? "Loop detection stopped autopilot" : currentStep,
    progressPct,
    permissionNeeded,
    permissionReason:
      loopBlocker.reason ??
      input.permissionReason ??
      (permissionNeeded ? permissionEvent?.detail ?? "Operator approval required" : null),
    estimatedNextAction,
    recentToolActions: events.slice(0, 5),
    isActive,
    runId: input.activeRunId ?? latest?.runId ?? null,
    liveLocked: true,
    loopBlocker,
    memorySummary: toAiMemorySummary(input.memorySummary),
    committeeSummary: toAiCommitteeSummary(input.committee),
  };
}
