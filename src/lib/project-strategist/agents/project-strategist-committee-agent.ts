import { PROJECT_STRATEGIST_DAILY_REVIEW_HOURS } from "@/lib/project-strategist/config";
import { newStrategistReportId } from "@/lib/project-strategist/ids";
import type { ProjectStrategistReport } from "@/lib/project-strategist/types";
import type {
  AuditDiagnosis,
  MvpPlanningResult,
  SkillResearchResult,
} from "./types";

export function runProjectStrategistCommitteeAgent(input: {
  audit: AuditDiagnosis;
  mvp: MvpPlanningResult;
  skillResearch: SkillResearchResult;
  cursorPrompt: string;
}): ProjectStrategistReport {
  const now = new Date();
  return {
    reportId: newStrategistReportId(),
    generatedAt: now.toISOString(),
    projectHealthStatus: input.audit.projectHealthStatus,
    productDiagnosis: input.audit.productDiagnosis,
    technicalDiagnosis: input.audit.technicalDiagnosis,
    tradingReadinessDiagnosis: input.audit.tradingReadinessDiagnosis,
    uxDiagnosis: input.audit.uxDiagnosis,
    automationDiagnosis: input.audit.automationDiagnosis,
    topProblems: input.audit.topProblems,
    hiddenRisks: input.audit.hiddenRisks,
    recommendedMVP: input.mvp.recommendedMVP,
    rejectedMVPs: input.mvp.rejectedMVPs,
    oneDayImplementationPlan: input.mvp.oneDayImplementationPlan,
    cursorPrompt: input.cursorPrompt,
    acceptanceCriteria: input.mvp.acceptanceCriteria,
    skillUpdates: input.skillResearch.skillUpdates,
    nextReviewAt: new Date(
      now.getTime() + PROJECT_STRATEGIST_DAILY_REVIEW_HOURS * 60 * 60 * 1000,
    ).toISOString(),
  };
}
