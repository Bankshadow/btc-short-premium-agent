import { moderateCommitteeResults } from "@/lib/parallel-task-runner/committee-moderator";
import type { ParallelAgentReview } from "@/lib/parallel-task-runner/types";
import type {
  DetectedImprovementIssue,
  ImprovementCommitteeReview,
  ImprovementIssueType,
} from "./types";

function agentForType(issueType: ImprovementIssueType): ParallelAgentReview["role"] {
  const map: Record<ImprovementIssueType, ParallelAgentReview["role"]> = {
    UX_ISSUE: "UX",
    DATA_NOT_FLOWING: "EXECUTION",
    TESTNET_FAILURE: "EXECUTION",
    STRATEGY_WEAKNESS: "STRATEGY",
    REPORT_MISSING: "LEARNING",
    RISK_GAP: "RISK",
  };
  return map[issueType];
}

function statusFromSeverity(
  severity: DetectedImprovementIssue["severity"],
): ParallelAgentReview["status"] {
  if (severity === "HIGH") return "CRITICAL";
  if (severity === "MEDIUM") return "WARNING";
  return "OK";
}

export function reviewIssueWithCommittee(
  issue: DetectedImprovementIssue,
): ImprovementCommitteeReview {
  const primaryRole = agentForType(issue.issueType);
  const primaryStatus = statusFromSeverity(issue.severity);

  const reviews: ParallelAgentReview[] = [
    {
      role: primaryRole,
      agentName: `${primaryRole} Review Agent`,
      status: primaryStatus,
      headline: issue.title,
      findings: issue.evidence,
      risks: [
        "Must not enable live trading.",
        "Must not auto-merge without human approval.",
      ],
      recommendations: [
        `Create improvement proposal for: ${issue.title}`,
        "Generate Cursor prompt for operator-approved implementation.",
      ],
      durationMs: 1,
      error: null,
    },
    {
      role: "PROJECT_STRATEGIST",
      agentName: "Project Strategist",
      status: primaryStatus === "CRITICAL" ? "WARNING" : "OK",
      headline: `Recommended MVP: ${issue.title}`,
      findings: [issue.summary],
      risks: ["Scope creep — keep one-day MVP boundary."],
      recommendations: ["Approve Cursor task after human review."],
      durationMs: 1,
      error: null,
    },
    {
      role: "RISK",
      agentName: "Risk Manager",
      status: issue.issueType === "RISK_GAP" ? "CRITICAL" : "OK",
      headline:
        issue.issueType === "RISK_GAP" ? "Risk gap requires fix" : "Risk gates preserved",
      findings: issue.issueType === "RISK_GAP" ? issue.evidence : ["Live locked"],
      risks: ["No live enablement in fix."],
      recommendations:
        issue.issueType === "RISK_GAP"
          ? ["Patch risk gap before new trades."]
          : ["Preserve double confirm on testnet."],
      durationMs: 1,
      error: null,
    },
  ];

  const committee = moderateCommitteeResults(reviews, { approveCursorPrompt: false });

  const recommendation =
    committee.recommendation === "PAUSE_AND_REVIEW"
      ? "PAUSE_AND_REVIEW"
      : committee.recommendation === "IMPLEMENT_FOLLOW_UP"
        ? "APPROVE_PROPOSAL"
        : primaryStatus === "CRITICAL"
          ? "PAUSE_AND_REVIEW"
          : "APPROVE_PROPOSAL";

  return {
    reviewedAt: new Date().toISOString(),
    recommendation,
    summary: committee.summary,
    topReasons: committee.topReasons,
    dissent: committee.dissent,
    agentNotes: reviews.map((r) => ({
      agent: r.agentName,
      note: r.headline,
    })),
  };
}
