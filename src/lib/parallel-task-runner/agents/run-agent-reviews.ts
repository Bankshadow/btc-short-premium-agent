import { runUxStrategistAgent } from "@/lib/project-strategist/agents/ux-strategist-agent";
import type { ParallelAgentReview, ParallelAgentRole, ParallelReviewStatus } from "../types";
import { PARALLEL_AGENT_LABELS } from "../config";
import type { ParallelReviewContext } from "../build-review-context";

function review(
  role: ParallelAgentRole,
  partial: Omit<ParallelAgentReview, "role" | "agentName" | "durationMs"> & {
    durationMs?: number;
  },
): ParallelAgentReview {
  return {
    role,
    agentName: PARALLEL_AGENT_LABELS[role],
    durationMs: partial.durationMs ?? 0,
    ...partial,
  };
}

function statusFromFlags(critical: boolean, warning: boolean): ParallelReviewStatus {
  if (critical) return "CRITICAL";
  if (warning) return "WARNING";
  return "OK";
}

export async function runStrategyAgentReview(
  ctx: ParallelReviewContext,
): Promise<ParallelAgentReview> {
  const start = Date.now();
  const sh = ctx.strategyHealth.totals;
  const paused = sh.paused;
  const reviewRequired = sh.reviewRequired;
  const critical = paused > 0;
  const warning = reviewRequired > 0;
  return review("STRATEGY", {
    status: statusFromFlags(critical, warning),
    headline:
      paused > 0
        ? `${paused} strategy(ies) paused`
        : reviewRequired > 0
          ? `${reviewRequired} strategy(ies) need review`
          : "Strategy health within limits",
    findings: ctx.strategyHealth.rows.slice(0, 4).map(
      (r) => `${r.strategyLabel}: ${r.currentStatus} · ${r.recommendation}`,
    ),
    risks: paused > 0 ? ["Paused strategies may still influence desk memory bullets."] : [],
    recommendations:
      reviewRequired > 0
        ? ["Resolve strategy review flags before increasing autopilot aggression."]
        : ["Continue monitoring strategy health on /strategy-health."],
    error: null,
    durationMs: Date.now() - start,
  });
}

export async function runRiskAgentReview(
  ctx: ParallelReviewContext,
): Promise<ParallelAgentReview> {
  const start = Date.now();
  const blocked = ctx.riskReport.blockNewTrades;
  const loopActive = ctx.loopGuard?.blocker.active === true;
  const critical = blocked || loopActive;
  const warning = ctx.riskReport.riskStatus === "CAUTION";
  const findings = [
    ...ctx.riskReport.triggeredLimits.slice(0, 3),
    ...(loopActive && ctx.loopGuard?.blocker.reason
      ? [`Loop guard: ${ctx.loopGuard.blocker.reason}`]
      : []),
  ];
  return review("RISK", {
    status: statusFromFlags(critical, warning),
    headline: blocked
      ? "Risk engine blocking new trades"
      : loopActive
        ? "Autopilot loop guard active"
        : `Risk status ${ctx.riskReport.riskStatus}`,
    findings: findings.length ? findings : ["No active risk limits triggered."],
    risks: critical ? ["Do not bypass risk gate or loop guard for convenience."] : [],
    recommendations: critical
      ? ["Clear blockers on AI Status before next testnet cycle."]
      : ["Maintain double confirm on all testnet executes."],
    error: null,
    durationMs: Date.now() - start,
  });
}

export async function runUxAgentReview(
  ctx: ParallelReviewContext,
): Promise<ParallelAgentReview> {
  const start = Date.now();
  if (!ctx.strategistContext) {
    return review("UX", {
      status: "SKIPPED",
      headline: "Project context unavailable",
      findings: [],
      risks: [],
      recommendations: ["Run project strategist review to refresh UX context."],
      error: "Strategist context missing",
      durationMs: Date.now() - start,
    });
  }
  const ux = runUxStrategistAgent({
    context: ctx.strategistContext,
    latestUserGoal: ctx.strategistStatus?.state.latestUserGoal ?? null,
    previousMvpProposals: ctx.strategistStatus?.state.mvpProposals ?? [],
  });
  const warning = ux.topUxProblems.length > 0;
  return review("UX", {
    status: statusFromFlags(false, warning),
    headline: ux.uxDiagnosis.slice(0, 120),
    findings: ux.topUxProblems,
    risks: warning ? ["Operator may miss blockers buried in advanced modules."] : [],
    recommendations: ux.simplifyRecommendations,
    error: null,
    durationMs: Date.now() - start,
  });
}

export async function runExecutionAgentReview(
  ctx: ParallelReviewContext,
): Promise<ParallelAgentReview> {
  const start = Date.now();
  const eq = ctx.executionQuality;
  const gate = eq.liveQualityGate.status;
  const critical = gate === "FAIL";
  const warning = gate === "WARNING";
  return review("EXECUTION", {
    status: statusFromFlags(critical, warning),
    headline: `Execution quality ${gate} · rejection ${eq.rejectionRatePct}%`,
    findings: [
      `Failed orders: ${eq.failedOrderCount}`,
      `Duplicate submissions: ${eq.duplicateSubmissionCount}`,
      `Avg latency ms: ${eq.averageLatencyMs}`,
      ...eq.exchangeErrors.slice(0, 2).map((e) => `${e.error} (${e.count}×)`),
    ],
    risks:
      eq.duplicateSubmissionCount > 0
        ? ["Duplicate testnet submissions detected — loop guard should block retries."]
        : [],
    recommendations:
      critical || warning
        ? ["Review /execution-quality and testnet journal before next auto-execute."]
        : ["Execution path remains serialized — no parallel orders."],
    error: null,
    durationMs: Date.now() - start,
  });
}

export async function runLearningAgentReview(
  ctx: ParallelReviewContext,
): Promise<ParallelAgentReview> {
  const start = Date.now();
  const pending = ctx.pendingLearning;
  const lessons = ctx.secondBrain?.summary.topLessons ?? [];
  const warning = pending > 3;
  return review("LEARNING", {
    status: statusFromFlags(false, warning),
    headline: ctx.secondBrain?.summary.headline ?? "Second brain not yet populated",
    findings: [
      `${pending} testnet trade(s) pending learning review`,
      `${ctx.secondBrain?.summary.subconsciousCount ?? 0} stored memory(ies)`,
      ...lessons.slice(0, 2),
    ],
    risks: pending > 5 ? ["Learning backlog may stale committee calibration."] : [],
    recommendations:
      pending > 0
        ? ["Mark closed testnet trades as learned on /testnet-monitor."]
        : ["Run SECOND_BRAIN_CONSOLIDATE after new resolved outcomes."],
    error: null,
    durationMs: Date.now() - start,
  });
}

export async function runProjectStrategistAgentReview(
  ctx: ParallelReviewContext,
): Promise<ParallelAgentReview> {
  const start = Date.now();
  if (!ctx.strategistStatus) {
    return review("PROJECT_STRATEGIST", {
      status: "WARNING",
      headline: "Strategist status unavailable",
      findings: ["Could not load project strategist state."],
      risks: [],
      recommendations: ["Run /api/project-strategist/run or automation PROJECT_STRATEGIST_REVIEW."],
      error: null,
      durationMs: Date.now() - start,
    });
  }
  const last = ctx.strategistStatus.latestReport;
  const health = last?.projectHealthStatus ?? "YELLOW";
  const critical = health === "RED";
  const warning = health === "YELLOW";
  const mvp = last?.recommendedMVP;
  return review("PROJECT_STRATEGIST", {
    status: statusFromFlags(critical, warning),
    headline: mvp
      ? `Recommended MVP: ${mvp.title}`
      : "No strategist report yet — run project strategist review",
    findings: (last?.topProblems ?? []).slice(0, 4),
    risks: (last?.hiddenRisks ?? []).slice(0, 3),
    recommendations: mvp
      ? [`Consider implementing: ${mvp.title}`]
      : ["Schedule PROJECT_STRATEGIST_REVIEW automation job."],
    error: null,
    durationMs: Date.now() - start,
  });
}

export const PARALLEL_REVIEW_RUNNERS: Record<
  ParallelAgentRole,
  (ctx: ParallelReviewContext) => Promise<ParallelAgentReview>
> = {
  STRATEGY: runStrategyAgentReview,
  RISK: runRiskAgentReview,
  UX: runUxAgentReview,
  EXECUTION: runExecutionAgentReview,
  LEARNING: runLearningAgentReview,
  PROJECT_STRATEGIST: runProjectStrategistAgentReview,
};
