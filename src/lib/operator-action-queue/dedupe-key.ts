import type { OperatorAction } from "./types";

/** Stable key so recurring operator actions replace instead of stacking. */
export function operatorActionDedupeKey(action: OperatorAction): string {
  if (action.linkedDecisionLogId) {
    return `${action.type}:log:${action.linkedDecisionLogId}`;
  }
  if (action.linkedTradeId) {
    return `${action.type}:trade:${action.linkedTradeId}`;
  }
  if (
    action.linkedModule === "automation-control-plane" &&
    action.type === "REVIEW_RISK_BLOCKER" &&
    action.title.startsWith("Automation job failed:")
  ) {
    const jobType = action.title.replace("Automation job failed: ", "").trim();
    return `acp-fail:${jobType}`;
  }
  if (action.actionId.startsWith("oa-blocker-")) {
    return `${action.type}:blocker:${action.description.slice(0, 120)}`;
  }
  return `${action.type}:${action.linkedModule ?? "none"}:${action.title}`;
}
