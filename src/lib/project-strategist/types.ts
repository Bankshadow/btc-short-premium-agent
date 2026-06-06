export type ProjectHealthStatus = "GREEN" | "YELLOW" | "RED";

export type SkillType =
  | "PRODUCT_STRATEGY"
  | "UX_REFACTOR"
  | "AI_WORKFLOW"
  | "CURSOR_PROMPTING"
  | "TRADING_SYSTEM"
  | "TESTNET_EXECUTION"
  | "RISK_CONTROL"
  | "PLATFORM_ARCHITECTURE";

export type SkillCardStatus = "PROPOSED" | "APPROVED" | "REJECTED" | "ACTIVE";

export type SkillAdoptionDecision = "ADOPT" | "IGNORE" | "REVIEW";

export interface SkillStatusTransition {
  from: SkillCardStatus;
  to: SkillCardStatus;
  at: string;
  reason: string | null;
}

export interface SkillCard {
  skillId: string;
  sourceUrl: string | null;
  title: string;
  summary: string;
  extractedPrinciple: string;
  applicableToProject: string;
  proposedWorkflow: string[];
  risk: string;
  confidence: number;
  status: SkillCardStatus;
  skillType: SkillType;
  proposedAction: SkillAdoptionDecision;
  sourceContent: string | null;
  createdAt: string;
  updatedAt: string;
  statusHistory: SkillStatusTransition[];
}

export type StrategistSourceFetchStatus =
  | "ADDED"
  | "FETCHED"
  | "FETCH_FAILED"
  | "PASTED";

export interface StrategistExternalSource {
  sourceId: string;
  sourceUrl: string | null;
  title: string;
  sourceContent: string | null;
  fetchStatus: StrategistSourceFetchStatus;
  addedAt: string;
  updatedAt: string;
  lastError: string | null;
}

export type MVPComplexity = "SMALL" | "MEDIUM" | "LARGE";
export type MVPStatus = "PROPOSED" | "ACCEPTED" | "REJECTED" | "IMPLEMENTED";

export interface MVPProposal {
  mvpId: string;
  title: string;
  problem: string;
  whyNow: string;
  expectedImpact: string;
  implementationScope: string;
  affectedPages: string[];
  affectedAPIs: string[];
  affectedModules: string[];
  estimatedComplexity: MVPComplexity;
  oneDayPlan: string[];
  risks: string[];
  acceptanceCriteria: string[];
  cursorPrompt: string;
  status: MVPStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectStrategistReport {
  reportId: string;
  generatedAt: string;
  projectHealthStatus: ProjectHealthStatus;
  productDiagnosis: string;
  technicalDiagnosis: string;
  tradingReadinessDiagnosis: string;
  uxDiagnosis: string;
  automationDiagnosis: string;
  topProblems: string[];
  hiddenRisks: string[];
  recommendedMVP: MVPProposal;
  rejectedMVPs: MVPProposal[];
  oneDayImplementationPlan: string[];
  cursorPrompt: string;
  acceptanceCriteria: string[];
  skillUpdates: SkillCard[];
  nextReviewAt: string;
}

export interface ProjectStrategistState {
  workspaceId: string;
  latestUserGoal: string | null;
  lastRunAt: string | null;
  nextDailyReviewAt: string | null;
  nextWeeklyReviewAt: string | null;
  reports: ProjectStrategistReport[];
  sources: StrategistExternalSource[];
  skills: SkillCard[];
  mvpProposals: MVPProposal[];
}

export interface ProjectStrategistStatusSnapshot {
  state: ProjectStrategistState;
  latestReport: ProjectStrategistReport | null;
  acceptedMVPs: MVPProposal[];
  rejectedMVPs: MVPProposal[];
  implementedMVPs: MVPProposal[];
}

export interface ProjectStrategistRunInput {
  workspaceId?: string;
  trigger?: "manual" | "daily" | "weekly" | "cron";
  latestUserGoal?: string | null;
  externalLearningLinks?: Array<{ sourceUrl: string; title?: string }>;
}

export interface ProjectStrategistRunResult {
  ok: boolean;
  report: ProjectStrategistReport;
  state: ProjectStrategistState;
  trigger: "manual" | "daily" | "weekly" | "cron";
}

export interface ProjectStrategistSafety {
  cannotTrade: true;
  cannotChangeLiveSettings: true;
  cannotAutoMergeCode: true;
  cannotApproveOwnSkillUpdates: true;
  cannotApplyExternalPromptDirectly: true;
  cannotEnableLiveTrading: true;
  cannotDeleteModules: true;
}
