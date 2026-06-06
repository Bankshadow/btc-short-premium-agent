import type {
  MVPProposal,
  ProjectHealthStatus,
  SkillCard,
} from "@/lib/project-strategist/types";
import type { ProjectStrategistContext } from "@/lib/project-strategist/project-context";

export interface StrategistAgentInput {
  context: ProjectStrategistContext;
  latestUserGoal: string | null;
  previousMvpProposals: MVPProposal[];
}

export interface AuditDiagnosis {
  projectHealthStatus: ProjectHealthStatus;
  productDiagnosis: string;
  technicalDiagnosis: string;
  tradingReadinessDiagnosis: string;
  uxDiagnosis: string;
  automationDiagnosis: string;
  topProblems: string[];
  hiddenRisks: string[];
}

export interface SkillResearchResult {
  skillUpdates: SkillCard[];
  sourceInsights: string[];
}

export interface MvpPlanningResult {
  recommendedMVP: MVPProposal;
  rejectedMVPs: MVPProposal[];
  oneDayImplementationPlan: string[];
  acceptanceCriteria: string[];
}
