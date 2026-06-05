import type { StrategyAdaptationProposal } from "@/lib/strategy-adaptation/types";
import type { CouncilGoalStatus } from "./types";
import type {
  CouncilAgentDebateRow,
  CouncilCommitteeDecision,
  CouncilCommitteeOutcome,
  CouncilProposal,
  CouncilRiskReview,
} from "./types";

export function runCommitteeModeratorAgent(input: {
  topic: string;
  goalStatus: CouncilGoalStatus;
  debate: CouncilAgentDebateRow[];
  proposals: CouncilProposal[];
  riskReview: CouncilRiskReview;
  capitalNote: string;
  adaptationProposals?: StrategyAdaptationProposal[];
}): {
  committeeDecision: CouncilCommitteeOutcome;
  councilMemo: string;
} {
  const proposalDecisions = input.proposals.map((p) => {
    const review = input.riskReview.items.find((i) => i.proposalId === p.id);
    let decision: CouncilCommitteeDecision = "NEED_MORE_DATA";

    if (review?.recommendation === "reject") {
      decision = "REJECT";
    } else if (review?.recommendation === "approve_paper") {
      decision = "APPROVE_FOR_PAPER_TEST";
    } else {
      decision = "NEED_MORE_DATA";
    }

    if (
      p.proposedChange.toLowerCase().includes("demote") &&
      p.targetStrategy !== "desk" &&
      p.targetStrategy !== "multi"
    ) {
      decision = "DEMOTE_TO_PAPER_ONLY";
    }

    return {
      proposalId: p.id,
      decision,
      rationale: review?.summary ?? "Insufficient council review.",
    };
  });

  const approveCount = proposalDecisions.filter(
    (d) => d.decision === "APPROVE_FOR_PAPER_TEST",
  ).length;
  const needData = proposalDecisions.filter(
    (d) => d.decision === "NEED_MORE_DATA",
  ).length;

  let overall: CouncilCommitteeDecision = "NEED_MORE_DATA";
  if (approveCount > 0 && needData <= approveCount) {
    overall = "APPROVE_FOR_PAPER_TEST";
  } else if (proposalDecisions.every((d) => d.decision === "REJECT")) {
    overall = "REJECT";
  }

  const committeeDecision: CouncilCommitteeOutcome = {
    decision: overall,
    proposalDecisions,
    summary: `Council recommends ${overall} for ${approveCount}/${input.proposals.length} proposals. Human must approve draft rules and strategy registry changes.`,
  };

  const memoLines = [
    `# AI Strategy Council Memo`,
    `Topic: ${input.topic}`,
    ``,
    `## Goal`,
    `- Equity ~$${input.goalStatus.currentEquityUsd.toLocaleString()} (${input.goalStatus.stageLabel})`,
    `- Progress to $20k: ${input.goalStatus.progressToGoalPct}%`,
    `- Bottleneck: ${input.goalStatus.bottleneck}`,
    ``,
    `## Committee decision`,
    overall,
    committeeDecision.summary,
    ``,
    `## Capital`,
    input.capitalNote,
    ``,
    `## Proposals (DRAFT until operator acts)`,
    ...input.proposals.map(
      (p, i) =>
        `${i + 1}. **${p.title}** — ${proposalDecisions.find((d) => d.proposalId === p.id)?.decision ?? "NEED_MORE_DATA"}`,
    ),
    ``,
    `## Adaptation engine (reference only — /adaptation)`,
    ...(input.adaptationProposals?.length
      ? input.adaptationProposals.map(
          (p, i) =>
            `${i + 1}. [${p.type}] ${p.targetStrategy} (${p.status}, conf ${p.confidence}%) — ${p.reason.slice(0, 120)}${p.reason.length > 120 ? "…" : ""}`,
        )
      : ["No pending adaptation proposals — run analysis on /adaptation."]),
    "Council cannot approve or apply adaptation proposals — operator must use /adaptation.",
    ``,
    `## Guardrails`,
    "- Hard risk rules locked",
    "- No live execution",
    "- No auto position size changes",
    "- Draft rules require human approval before affecting desk",
  ];

  const councilMemo = memoLines.join("\n");

  return { committeeDecision, councilMemo };
}
