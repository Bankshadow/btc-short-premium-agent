import type { OperatorAction } from "@/lib/operator-action-queue/types";
import type {
  CommitteeModeratorResult,
  CommitteeRecommendation,
  ParallelAgentReview,
} from "./types";
import { executionSafetyFlags } from "./safety";

function buildActionItem(
  partial: Omit<OperatorAction, "status" | "createdAt">,
): OperatorAction {
  return {
    ...partial,
    status: "OPEN",
    createdAt: new Date().toISOString(),
  };
}

function resolveRecommendation(reviews: ParallelAgentReview[]): CommitteeRecommendation {
  const critical = reviews.filter((r) => r.status === "CRITICAL");
  if (critical.some((r) => r.role === "RISK" || r.role === "EXECUTION")) {
    return "PAUSE_AND_REVIEW";
  }
  const strategist = reviews.find((r) => r.role === "PROJECT_STRATEGIST");
  if (
    strategist &&
    strategist.status !== "CRITICAL" &&
    strategist.recommendations.length > 0 &&
    strategist.headline.includes("Recommended MVP")
  ) {
    return "IMPLEMENT_FOLLOW_UP";
  }
  if (critical.length > 0) return "PAUSE_AND_REVIEW";
  const warnings = reviews.filter((r) => r.status === "WARNING").length;
  if (warnings >= 3) return "PAUSE_AND_REVIEW";
  return "CONTINUE";
}

function buildCursorPrompt(reviews: ParallelAgentReview[]): string | null {
  const strategist = reviews.find((r) => r.role === "PROJECT_STRATEGIST");
  if (!strategist?.headline.includes("Recommended MVP")) return null;
  const mvpTitle = strategist.headline.replace("Recommended MVP: ", "").trim();
  const problems = reviews.flatMap((r) => r.findings).slice(0, 6);
  const risks = reviews.flatMap((r) => r.risks).slice(0, 4);
  return [
    "You are working on btc-short-premium-agent.",
    "",
    `Parallel committee approved follow-up: ${mvpTitle}.`,
    "",
    "Constraints:",
    "- Parallel review only — do not execute testnet orders in this task.",
    "- Never bypass risk gate, loop guard, or double confirm.",
    "- Do not enable live trading.",
    "",
    "Committee findings:",
    ...problems.map((p) => `- ${p}`),
    "",
    "Risks to respect:",
    ...risks.map((r) => `- ${r}`),
    "",
    "Deliverables:",
    "- Focused implementation with tests where relevant.",
    "- Short summary for operator.",
  ].join("\n");
}

export function moderateCommitteeResults(
  reviews: ParallelAgentReview[],
  input?: { approveCursorPrompt?: boolean },
): CommitteeModeratorResult {
  const recommendation = resolveRecommendation(reviews);
  const critical = reviews.filter((r) => r.status === "CRITICAL");
  const warnings = reviews.filter((r) => r.status === "WARNING");

  const topReasons = [
    ...critical.map((r) => `${r.agentName}: ${r.headline}`),
    ...warnings.slice(0, 2).map((r) => `${r.agentName}: ${r.headline}`),
  ].slice(0, 5);

  const dissent = reviews
    .filter((r) => r.status === "CRITICAL" && r.recommendations[0])
    .map((r) => `${r.agentName} urges: ${r.recommendations[0]}`);

  const actionItems: OperatorAction[] = [];
  const ts = Date.now();

  for (const r of critical) {
    actionItems.push(
      buildActionItem({
        actionId: `oa-parallel-${r.role.toLowerCase()}-${ts}`,
        type: "REVIEW_RISK_BLOCKER",
        priority: "CRITICAL",
        title: `${r.agentName} critical finding`,
        description: r.findings[0] ?? r.headline,
        reason: r.headline,
        linkedDecisionLogId: null,
        linkedTradeId: null,
        linkedModule: "parallel-task-runner",
        requiresHumanApproval: true,
      }),
    );
  }

  if (recommendation === "IMPLEMENT_FOLLOW_UP") {
    const strategist = reviews.find((r) => r.role === "PROJECT_STRATEGIST");
    actionItems.push(
      buildActionItem({
        actionId: `oa-parallel-mvp-${ts}`,
        type: "REVIEW_STRATEGY",
        priority: "HIGH",
        title: "Committee-approved MVP follow-up",
        description: strategist?.headline ?? "Review parallel committee MVP recommendation",
        reason: "Parallel agent committee merged strategist recommendation.",
        linkedDecisionLogId: null,
        linkedTradeId: null,
        linkedModule: "parallel-task-runner",
        requiresHumanApproval: true,
      }),
    );
  }

  const cursorPrompt = buildCursorPrompt(reviews);
  const approve = input?.approveCursorPrompt === true;

  const summary =
    recommendation === "CONTINUE"
      ? `Committee: continue — ${reviews.length} parallel reviews, ${warnings.length} warning(s).`
      : recommendation === "PAUSE_AND_REVIEW"
        ? `Committee: pause and review — ${critical.length} critical, ${warnings.length} warning(s).`
        : `Committee: implement follow-up — strategist MVP approved for Cursor handoff.`;

  const flags = executionSafetyFlags();

  return {
    generatedAt: new Date().toISOString(),
    recommendation,
    summary,
    topReasons,
    dissent,
    actionItems,
    cursorPrompt: approve ? cursorPrompt : null,
    cursorPromptApproved: approve && Boolean(cursorPrompt),
    executionSerialized: flags.executionSerialized,
    parallelOrderExecutionBlocked: flags.parallelOrderExecutionBlocked,
  };
}
