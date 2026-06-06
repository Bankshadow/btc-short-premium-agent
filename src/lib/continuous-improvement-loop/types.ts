export const CONTINUOUS_IMPROVEMENT_SAFETY_NOTICE =
  "Continuous improvement proposals are advisory — AI cannot auto-merge code or enable live trading. Human approval required before Cursor implementation.";

export type ImprovementIssueType =
  | "UX_ISSUE"
  | "DATA_NOT_FLOWING"
  | "TESTNET_FAILURE"
  | "STRATEGY_WEAKNESS"
  | "REPORT_MISSING"
  | "RISK_GAP";

export type ImprovementProposalStatus =
  | "DETECTED"
  | "COMMITTEE_REVIEWED"
  | "PROPOSED"
  | "APPROVED"
  | "REJECTED"
  | "IMPLEMENTED"
  | "VERIFYING"
  | "VERIFIED"
  | "VERIFY_FAILED";

export interface DetectedImprovementIssue {
  issueId: string;
  issueType: ImprovementIssueType;
  fingerprint: string;
  title: string;
  summary: string;
  evidence: string[];
  severity: "LOW" | "MEDIUM" | "HIGH";
  detectedAt: string;
  sourceModule: string;
}

export interface ImprovementCommitteeReview {
  reviewedAt: string;
  recommendation: "APPROVE_PROPOSAL" | "PAUSE_AND_REVIEW" | "REJECT";
  summary: string;
  topReasons: string[];
  dissent: string[];
  agentNotes: Array<{ agent: string; note: string }>;
}

export interface ImprovementProposal {
  proposalId: string;
  workspaceId: string;
  issueType: ImprovementIssueType;
  fingerprint: string;
  title: string;
  problem: string;
  whyNow: string;
  expectedImpact: string;
  implementationScope: string;
  affectedPages: string[];
  affectedAPIs: string[];
  affectedModules: string[];
  acceptanceCriteria: string[];
  cursorPrompt: string;
  status: ImprovementProposalStatus;
  detectedIssue: DetectedImprovementIssue;
  committeeReview: ImprovementCommitteeReview | null;
  approvedAt: string | null;
  approvedBy: string | null;
  implementedAt: string | null;
  verifiedAt: string | null;
  verificationSummary: string | null;
  verificationPassed: boolean | null;
  createdAt: string;
  updatedAt: string;
  cannotAutoMerge: true;
  cannotEnableLive: true;
  requiresHumanApproval: true;
  safetyNotice: typeof CONTINUOUS_IMPROVEMENT_SAFETY_NOTICE;
}

export interface ContinuousImprovementStore {
  workspaceId: string;
  proposals: ImprovementProposal[];
  lastDetectAt: string | null;
  updatedAt: string;
}

export interface ContinuousImprovementStatus {
  workspaceId: string;
  proposalCount: number;
  pendingApproval: number;
  awaitingVerification: number;
  verified: number;
  recent: ImprovementProposal[];
  lastDetectAt: string | null;
  safetyNotice: typeof CONTINUOUS_IMPROVEMENT_SAFETY_NOTICE;
}
