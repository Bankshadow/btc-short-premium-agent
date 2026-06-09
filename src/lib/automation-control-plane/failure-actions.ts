import { buildOperatorActionQueue } from "@/lib/operator-action-queue/build-action-queue";
import { dispatchExternalBriefing, sanitizeBriefingText } from "@/lib/smart-briefing/dispatch";
import {
  appendObservabilityError,
  loadObservabilityMetrics,
  saveObservabilityMetrics,
} from "@/lib/observability/store";
import type { OperatorAction } from "@/lib/operator-action-queue/types";
import type { AutomationFailedJob, AutomationJobType } from "./types";
import { mergeServerPendingOperatorActions } from "./state-store";
import type { AutomationServerContext } from "./server-context";

export function buildAutomationFailureAction(
  jobType: AutomationJobType,
  error: string,
  runId: string,
  workspaceId: string,
): OperatorAction {
  const ts = new Date().toISOString();
  return {
    actionId: `acp-fail-${jobType}`,
    type: "REVIEW_RISK_BLOCKER",
    priority: "HIGH",
    title: `Automation job failed: ${jobType}`,
    description: `Review automation failure and retry or fix underlying data. Error: ${error.slice(0, 200)}`,
    reason: `Automation control plane job ${jobType} failed on run ${runId}.`,
    linkedDecisionLogId: null,
    linkedTradeId: null,
    linkedModule: "automation-control-plane",
    requiresHumanApproval: true,
    status: "OPEN",
    createdAt: ts,
  };
}

export async function handleAutomationJobFailure(
  failed: AutomationFailedJob,
  ctx: AutomationServerContext,
): Promise<OperatorAction[]> {
  const failureAction = buildAutomationFailureAction(
    failed.jobType,
    failed.error,
    failed.runId,
    failed.workspaceId,
  );

  const queueActions = buildOperatorActionQueue({
    entries: ctx.entries,
    orders: ctx.orders,
    riskProfile: ctx.riskProfile,
    commandBlockers: [failed.error],
  }).filter((a) => a.type !== "NO_ACTION");

  const merged = await mergeServerPendingOperatorActions([
    failureAction,
    ...queueActions.slice(0, 3),
  ]);

  const message = sanitizeBriefingText(
    [
      "━━ Automation Failure ━━",
      `Job: ${failed.jobType}`,
      `Run: ${failed.runId}`,
      `Error: ${failed.error}`,
      "",
      "Open /automation-control to retry or pause automation.",
    ].join("\n"),
  );
  const dispatch = await dispatchExternalBriefing({ message }).catch(() => ({}));
  const anyDelivered = Object.values(dispatch).some((v) => v === true);
  const metrics = await loadObservabilityMetrics();
  if (!anyDelivered) {
    await saveObservabilityMetrics({
      alertDeliveryFailures: metrics.alertDeliveryFailures + 1,
    });
  } else {
    await saveObservabilityMetrics({
      lastAlertDeliveryAt: new Date().toISOString(),
      alertDeliveryFailures: metrics.alertDeliveryFailures,
    });
  }

  await appendObservabilityError({
    workspaceId: failed.workspaceId,
    source: `automation:${failed.jobType}`,
    message: failed.error,
    severity: failed.retryCount >= 2 ? "critical" : "high",
    linkedJobId: failed.failedJobId,
    metadata: { runId: failed.runId },
  });

  return merged;
}
