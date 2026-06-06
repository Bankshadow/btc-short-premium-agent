import type {
  DetectedImprovementIssue,
  ImprovementCommitteeReview,
  ImprovementIssueType,
  ImprovementProposal,
} from "./types";
import { CONTINUOUS_IMPROVEMENT_SAFETY_NOTICE } from "./types";
import { generateImprovementCursorPrompt } from "./generate-cursor-prompt";

function scopeForType(type: ImprovementIssueType): {
  pages: string[];
  apis: string[];
  modules: string[];
  scope: string;
} {
  const map: Record<
    ImprovementIssueType,
    { pages: string[]; apis: string[]; modules: string[]; scope: string }
  > = {
    UX_ISSUE: {
      pages: ["/", "/reports", "/cockpit"],
      apis: [],
      modules: ["components", "ux"],
      scope: "Improve operator UX flow and reduce friction.",
    },
    DATA_NOT_FLOWING: {
      pages: ["/data", "/cockpit"],
      apis: ["/api/data-backbone/sync", "/api/analyze"],
      modules: ["data-backbone", "analyze"],
      scope: "Restore data pipeline health and trust signals.",
    },
    TESTNET_FAILURE: {
      pages: ["/binance-testnet", "/testnet-monitor", "/trades"],
      apis: [
        "/api/exchange/binance/testnet/execute",
        "/api/testnet-monitor/refresh",
        "/api/trade-black-box",
      ],
      modules: ["exchange/binance", "testnet-monitor", "trade-black-box"],
      scope: "Fix testnet execution or monitoring failure path.",
    },
    STRATEGY_WEAKNESS: {
      pages: ["/strategy-health", "/strategy-garage", "/learning"],
      apis: ["/api/strategy-health", "/api/strategy-garage/review"],
      modules: ["strategy-health", "strategy-garage", "self-learning"],
      scope: "Strengthen strategy signal quality and gating.",
    },
    REPORT_MISSING: {
      pages: ["/reports"],
      apis: ["/api/daily-self-review/run", "/api/daily-self-review/latest"],
      modules: ["daily-self-review"],
      scope: "Ensure daily AI self-review generates reliably.",
    },
    RISK_GAP: {
      pages: ["/validation", "/ai-status", "/real-time-risk"],
      apis: ["/api/risk/realtime", "/api/mission-controller/status"],
      modules: ["real-time-risk", "mission-controller", "validation"],
      scope: "Close risk control gap without enabling live trading.",
    },
  };
  return map[type];
}

function acceptanceForType(type: ImprovementIssueType, issue: DetectedImprovementIssue): string[] {
  const base = [
    "Fix does not enable live trading or weaken kill switch.",
    "Human approval still required for testnet execute/close.",
    "No auto-merge — operator reviews PR manually.",
    `Regression check: ${issue.title} no longer reproduces.`,
  ];
  const extra: Record<ImprovementIssueType, string[]> = {
    UX_ISSUE: ["Operator can complete flow in fewer steps."],
    DATA_NOT_FLOWING: ["Data trust grade improves or enginesNeedingAttention drops."],
    TESTNET_FAILURE: ["Testnet execute/close path succeeds in dry run."],
    STRATEGY_WEAKNESS: ["Strategy health tradeAllowed true or block reason documented."],
    REPORT_MISSING: ["Daily self-review appears on /reports after cron or manual run."],
    RISK_GAP: ["Risk blocker cleared or documented override path added."],
  };
  return [...base, ...extra[type]];
}

export function buildImprovementProposal(input: {
  issue: DetectedImprovementIssue;
  committee: ImprovementCommitteeReview;
  workspaceId?: string;
}): ImprovementProposal {
  const { issue, committee } = input;
  const scoped = scopeForType(issue.issueType);
  const now = new Date().toISOString();
  const proposalId = `cip-${issue.fingerprint}-${Date.now()}`;

  const draft: Omit<ImprovementProposal, "cursorPrompt"> = {
    proposalId,
    workspaceId: input.workspaceId ?? "server-default",
    issueType: issue.issueType,
    fingerprint: issue.fingerprint,
    title: issue.title,
    problem: issue.summary,
    whyNow: committee.topReasons[0] ?? issue.evidence[0] ?? "Detected in continuous improvement scan.",
    expectedImpact: `Resolve ${issue.issueType.replace(/_/g, " ").toLowerCase()} and reduce operator toil.`,
    implementationScope: scoped.scope,
    affectedPages: scoped.pages,
    affectedAPIs: scoped.apis,
    affectedModules: scoped.modules,
    acceptanceCriteria: acceptanceForType(issue.issueType, issue),
    status: committee.recommendation === "REJECT" ? "REJECTED" : "PROPOSED",
    detectedIssue: issue,
    committeeReview: committee,
    approvedAt: null,
    approvedBy: null,
    implementedAt: null,
    verifiedAt: null,
    verificationSummary: null,
    verificationPassed: null,
    createdAt: now,
    updatedAt: now,
    cannotAutoMerge: true,
    cannotEnableLive: true,
    requiresHumanApproval: true,
    safetyNotice: CONTINUOUS_IMPROVEMENT_SAFETY_NOTICE,
  };

  const cursorPrompt = generateImprovementCursorPrompt({
    proposal: { ...draft, cursorPrompt: "" },
    committee,
  });

  return { ...draft, cursorPrompt };
}
