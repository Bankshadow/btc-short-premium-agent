import type { AutopilotRunResult } from "@/lib/autopilot/types";
import type { PaperAutopilotRunResult } from "@/lib/paper-autopilot/types";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { SmartBriefingPayload } from "./types";
import { emitSmartBriefing } from "./emit";

function topReasonsFromAnalysis(data: AnalyzeApiResponse): string[] {
  return (
    data.tradingDesk?.committee.topReasons?.slice(0, 3) ??
    data.step5_verdict.risks?.slice(0, 3) ??
    []
  );
}

function verdictFromAnalysis(data: AnalyzeApiResponse): string {
  return String(
    data.tradingDesk?.committee.finalVerdict ?? data.step5_verdict.recommendation,
  ).toUpperCase();
}

export function buildPayloadFromAnalysis(
  data: AnalyzeApiResponse,
  eventType: SmartBriefingPayload["eventType"],
): SmartBriefingPayload {
  const verdict = verdictFromAnalysis(data);
  const riskVeto = data.tradingDesk?.committee.riskVeto ?? false;
  return {
    eventType,
    status: data.dataTrust?.grade ?? "OK",
    verdict,
    recommendedAction: data.step6_actionPlan.entryNotes || data.step6_actionPlan.action,
    topReasons: topReasonsFromAnalysis(data),
    blocker: riskVeto
      ? data.tradingDesk?.riskManager.reasons?.[0] ?? "Risk veto active"
      : null,
    actionRequired: eventType === "TRADE_CANDIDATE_FOUND" || riskVeto,
    deskLabel: "DESK",
  };
}

export async function emitFromAnalysis(
  data: AnalyzeApiResponse,
  options?: { isDemo?: boolean },
): Promise<void> {
  if (options?.isDemo) return;

  const verdict = verdictFromAnalysis(data);
  const riskVeto = data.tradingDesk?.committee.riskVeto ?? false;

  if (riskVeto) {
    await emitSmartBriefing(
      buildPayloadFromAnalysis(data, "RISK_BLOCKER_TRIGGERED"),
    );
    return;
  }

  if (verdict === "TRADE") {
    await emitSmartBriefing(
      buildPayloadFromAnalysis(data, "TRADE_CANDIDATE_FOUND"),
    );
  }

  if (data.dataTrust?.grade === "CRITICAL" || data.dataTrust?.grade === "LOW") {
    await emitSmartBriefing({
      eventType: "DATA_STALE",
      status: data.dataTrust.grade,
      verdict,
      recommendedAction: "Re-run analysis when data recovers.",
      topReasons: data.dataTrust.criticalIssues?.slice(0, 3) ?? [],
      blocker: data.dataTrust.criticalIssues?.[0] ?? "Data trust degraded",
      actionRequired: true,
      deskLabel: "DESK",
    });
  }
}

export async function emitFromAutopilotResult(
  result: AutopilotRunResult | null,
): Promise<void> {
  if (!result) return;

  if (result.status === "FAILED" || result.errors.length > 0) {
    await emitSmartBriefing({
      eventType: "AUTOPILOT_ERROR",
      status: result.status,
      verdict: result.finalVerdict,
      recommendedAction: result.recommendedAction,
      topReasons: result.blockers.slice(0, 3),
      blocker: result.errors[0] ?? result.blockers[0] ?? "Autopilot error",
      actionRequired: true,
      deskLabel: "DESK",
      body: result.briefing,
    });
    return;
  }

  if (result.status === "COMPLETED") {
    await emitSmartBriefing({
      eventType: "DESK_CYCLE_COMPLETED",
      status: result.deskStatus,
      verdict: result.finalVerdict,
      recommendedAction: result.recommendedAction,
      topReasons: result.blockers.slice(0, 3),
      blocker: result.blockers[0] ?? null,
      deskLabel: "DESK",
      body: result.briefing,
    });
  }

  const { strategySampleSize, minRequiredSampleSize } = result.learningStatus;
  if (
    strategySampleSize >= minRequiredSampleSize &&
    strategySampleSize === minRequiredSampleSize
  ) {
    await emitSmartBriefing({
      eventType: "LEARNING_MILESTONE_REACHED",
      status: "READY",
      verdict: result.finalVerdict,
      recommendedAction: "Review validation on /validation",
      topReasons: [result.learningStatus.label, result.learningStatus.detail],
      deskLabel: "DESK",
    });
  }
}

export async function emitFromPaperAutopilotResult(
  result: import("@/lib/paper-autopilot/types").PaperAutopilotRunResult,
): Promise<void> {
  for (const order of result.created) {
    const isShadow = order.paperMode === "RELAXED_PAPER";
    await emitSmartBriefing({
      eventType: isShadow ? "SHADOW_TRADE_CREATED" : "PAPER_TRADE_OPENED",
      status: "OPEN",
      verdict: order.committeeVerdict,
      recommendedAction: `Monitor ${order.instrument} on /portfolio`,
      topReasons: [order.notes || order.relaxedReason || "Autopilot entry"],
      deskLabel: isShadow ? "SHADOW" : "PAPER",
      linkHref: "/portfolio",
    });
  }

  if (result.closeRecommended > 0) {
    const signal = result.signals.find((s) => s.recommendClose);
    await emitSmartBriefing({
      eventType: "CLOSE_RECOMMENDED",
      status: "CLOSE_RECOMMENDED",
      verdict: null,
      recommendedAction: "Review close recommendation on /autopilot",
      topReasons: result.signals
        .filter((s) => s.recommendClose)
        .map((s) => s.detail)
        .slice(0, 3),
      blocker: signal?.detail ?? null,
      actionRequired: true,
      deskLabel: "PAPER",
      linkHref: "/autopilot",
    });
  }
}

export async function emitOutcomeResolved(input: {
  verdict: string;
  outcomeLabel: string;
  pnlPct: number;
  notes: string;
}): Promise<void> {
  await emitSmartBriefing({
    eventType: "OUTCOME_RESOLVED",
    status: "RESOLVED",
    verdict: input.verdict,
    recommendedAction: "Learning metrics updated — review /validation",
    topReasons: [input.outcomeLabel, `PnL ${input.pnlPct}%`, input.notes].filter(Boolean),
    deskLabel: "PAPER",
    linkHref: "/",
  });
}

export async function emitFromLivePilotAction(input: {
  ok: boolean;
  symbol: string;
  liveTradeId: string | null;
  error?: string;
}): Promise<void> {
  await emitSmartBriefing({
    eventType: input.ok ? "LIVE_PILOT_EXECUTE" : "LIVE_PILOT_BLOCKED",
    status: input.ok ? "EXECUTED" : "BLOCKED",
    verdict: null,
    recommendedAction: input.ok
      ? "Monitor position on /live-pilot and /live-supervisor"
      : "Review blockers on /live-readiness before retry",
    topReasons: input.ok
      ? [`${input.symbol} · ${input.liveTradeId ?? "trade"}`]
      : [input.error ?? "Pilot guards blocked execution"],
    blocker: input.ok ? null : input.error ?? "Blocked",
    actionRequired: !input.ok,
    deskLabel: "LIVE",
    linkHref: "/live-pilot",
  });
}

export async function emitActionQueueSummary(input: {
  openCount: number;
  topAction: string;
}): Promise<void> {
  if (input.openCount === 0) return;
  await emitSmartBriefing({
    eventType: "DESK_CYCLE_COMPLETED",
    briefingType: "action_queue_summary",
    status: "ACTIONS_PENDING",
    verdict: null,
    recommendedAction: input.topAction,
    topReasons: [`${input.openCount} open operator action(s)`],
    actionRequired: true,
    deskLabel: "DESK",
    linkHref: "/actions",
    title: "Action queue summary",
  });
}
