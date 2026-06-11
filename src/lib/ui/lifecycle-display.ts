import type { LifecyclePhase } from "@/components/ui/lifecycle-timeline";
import type { DashboardUiContext } from "@/lib/core/ui-context-zero";
import type { MissionSnapshot } from "@/lib/mission/mission-types";

/** Presentation-only mapping from API-provided fields — no journal replay. */
export function deriveLifecycleDisplay(
  mission: Pick<
    MissionSnapshot,
    "latestRunId" | "latestDecisionLogId" | "latestVerdict"
  >,
  ctx: Pick<
    DashboardUiContext,
    | "latestPreview"
    | "latestExecutionReview"
    | "latestOpenTrade"
    | "latestClosePreview"
    | "latestClosedTrade"
  >,
  evidenceValid: number,
): {
  activePhase: LifecyclePhase | null;
  completedPhases: LifecyclePhase[];
  fields: Array<{ label: string; value: string }>;
} {
  const completed: LifecyclePhase[] = [];
  if (mission.latestRunId) completed.push("Analysis");
  if (ctx.latestPreview) completed.push("Preview");
  if (ctx.latestExecutionReview) completed.push("Safety Review");
  if (ctx.latestOpenTrade) {
    completed.push("Execute", "Position Open", "Monitor");
  }
  if (ctx.latestClosePreview) completed.push("Close");
  if (ctx.latestClosedTrade) completed.push("PnL");
  if (evidenceValid > 0) completed.push("Evidence");

  let active: LifecyclePhase | null = null;
  if (ctx.latestOpenTrade && !ctx.latestClosedTrade) active = "Monitor";
  else if (ctx.latestClosePreview && !ctx.latestClosedTrade) active = "Close";
  else if (ctx.latestClosedTrade?.status === "CLOSED_PENDING_PNL") active = "PnL";
  else if (ctx.latestPreview && !ctx.latestOpenTrade) active = "Preview";
  else if (mission.latestVerdict && !ctx.latestPreview) active = "Analysis";
  else if (ctx.latestClosedTrade) active = "Learning";

  return {
    activePhase: active,
    completedPhases: completed,
    fields: [
      { label: "runId", value: mission.latestRunId ?? "—" },
      { label: "decisionLogId", value: mission.latestDecisionLogId ?? "—" },
      { label: "verdict", value: mission.latestVerdict ?? "—" },
      { label: "previewId", value: ctx.latestPreview?.previewId ?? "—" },
      { label: "tradeId", value: ctx.latestOpenTrade?.tradeId ?? ctx.latestClosedTrade?.tradeId ?? "—" },
      { label: "position", value: ctx.latestOpenTrade?.position?.status ?? "—" },
      { label: "PnL", value: ctx.latestClosedTrade?.result ?? "—" },
      { label: "learning", value: ctx.latestClosedTrade?.learningId ?? "—" },
    ],
  };
}
