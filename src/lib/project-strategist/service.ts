import {
  PROJECT_STRATEGIST_DAILY_REVIEW_HOURS,
  PROJECT_STRATEGIST_SAFETY_NOTICE,
  PROJECT_STRATEGIST_WEEKLY_REVIEW_HOURS,
} from "./config";
import { newStrategistSourceId } from "./ids";
import { buildProjectStrategistContext } from "./project-context";
import { assertProjectStrategistSafety } from "./safety";
import {
  appendStrategistReport,
  buildProjectStrategistStatusSnapshot,
  loadProjectStrategistState,
  mergeMvpProposals,
  mergeSkillCards,
  mergeStrategistSources,
  saveProjectStrategistState,
  updateMvpStatus,
  updateSkillStatus,
} from "./state-store";
import type {
  ProjectStrategistRunInput,
  ProjectStrategistRunResult,
  ProjectStrategistStatusSnapshot,
  StrategistExternalSource,
} from "./types";
import { runCursorPromptWriterAgent } from "./agents/cursor-prompt-writer-agent";
import { runMvpPlannerAgent } from "./agents/mvp-planner-agent";
import { runProjectAuditorAgent } from "./agents/project-auditor-agent";
import { runProjectStrategistCommitteeAgent } from "./agents/project-strategist-committee-agent";
import { runSkillResearchAgent } from "./agents/skill-research-agent";
import { runTradingSystemsArchitectAgent } from "./agents/trading-systems-architect-agent";
import { runUxStrategistAgent } from "./agents/ux-strategist-agent";
import { fetchExternalSourceContent } from "./skill-research/fetch-source";
import { inferSourceTitle } from "./skill-research/utils";

function resolveWorkspaceId(workspaceId?: string): string {
  return workspaceId?.trim() || "server-default";
}

function buildSource(partial: {
  sourceUrl: string | null;
  title?: string;
  sourceContent?: string | null;
  fetchStatus: "ADDED" | "FETCHED" | "FETCH_FAILED" | "PASTED";
  lastError?: string | null;
}): StrategistExternalSource {
  const now = new Date().toISOString();
  return {
    sourceId: newStrategistSourceId(),
    sourceUrl: partial.sourceUrl,
    title: inferSourceTitle({
      sourceUrl: partial.sourceUrl,
      sourceContent: partial.sourceContent ?? null,
      fallback: partial.title,
    }),
    sourceContent: partial.sourceContent ?? null,
    fetchStatus: partial.fetchStatus,
    addedAt: now,
    updatedAt: now,
    lastError: partial.lastError ?? null,
  };
}

export async function runProjectStrategist(
  input: ProjectStrategistRunInput = {},
): Promise<ProjectStrategistRunResult> {
  assertProjectStrategistSafety();
  const workspaceId = resolveWorkspaceId(input.workspaceId);
  const state = await loadProjectStrategistState(workspaceId);

  const newlyFetchedSources: StrategistExternalSource[] = [];
  for (const link of input.externalLearningLinks ?? []) {
    const fetched = await fetchExternalSourceContent(link);
    newlyFetchedSources.push({
      ...fetched,
      sourceId: newStrategistSourceId(),
    });
  }

  const mergedSources = mergeStrategistSources(state.sources, newlyFetchedSources);
  const context = await buildProjectStrategistContext();
  const auditorInput = {
    context,
    latestUserGoal: input.latestUserGoal ?? state.latestUserGoal,
    previousMvpProposals: state.mvpProposals,
  };

  const audit = runProjectAuditorAgent(auditorInput);
  const ux = runUxStrategistAgent(auditorInput);
  const architecture = runTradingSystemsArchitectAgent(auditorInput);
  const skillResearch = runSkillResearchAgent({ sources: mergedSources.slice(0, 20) });
  const mvp = runMvpPlannerAgent({
    agentInput: auditorInput,
    audit: {
      ...audit,
      technicalDiagnosis: architecture.technicalDiagnosis,
      tradingReadinessDiagnosis: architecture.tradingReadinessDiagnosis,
      automationDiagnosis: architecture.automationDiagnosis,
      uxDiagnosis: ux.uxDiagnosis,
      topProblems: [...new Set([...audit.topProblems, ...ux.topUxProblems])],
      hiddenRisks: [...new Set([...audit.hiddenRisks, ...architecture.architectureRisks])],
    },
    uxRecommendations: ux.simplifyRecommendations,
  });
  const cursorPromptBase = runCursorPromptWriterAgent({
    mvp: mvp.recommendedMVP,
    diagnosis: {
      ...audit,
      technicalDiagnosis: architecture.technicalDiagnosis,
      tradingReadinessDiagnosis: architecture.tradingReadinessDiagnosis,
      automationDiagnosis: architecture.automationDiagnosis,
      uxDiagnosis: ux.uxDiagnosis,
      topProblems: [...new Set([...audit.topProblems, ...ux.topUxProblems])],
      hiddenRisks: [...new Set([...audit.hiddenRisks, ...architecture.architectureRisks])],
    },
  });
  const dailyReviewTask = context.suggestedDailyReviewTask;
  const cursorPrompt = dailyReviewTask
    ? `${dailyReviewTask}\n\n---\n\nStrategist MVP context:\n${cursorPromptBase}`
    : cursorPromptBase;
  const report = runProjectStrategistCommitteeAgent({
    audit: {
      ...audit,
      technicalDiagnosis: architecture.technicalDiagnosis,
      tradingReadinessDiagnosis: architecture.tradingReadinessDiagnosis,
      automationDiagnosis: architecture.automationDiagnosis,
      uxDiagnosis: ux.uxDiagnosis,
      topProblems: [...new Set([...audit.topProblems, ...ux.topUxProblems])],
      hiddenRisks: [...new Set([...audit.hiddenRisks, ...architecture.architectureRisks])],
    },
    mvp,
    skillResearch,
    cursorPrompt,
  });

  state.latestUserGoal = input.latestUserGoal ?? state.latestUserGoal;
  state.sources = mergedSources;
  state.skills = mergeSkillCards(state.skills, report.skillUpdates);
  state.mvpProposals = mergeMvpProposals(state.mvpProposals, [
    report.recommendedMVP,
    ...report.rejectedMVPs,
  ]);
  state.reports = appendStrategistReport(state.reports, report);
  state.lastRunAt = report.generatedAt;
  state.nextDailyReviewAt = new Date(
    Date.now() + PROJECT_STRATEGIST_DAILY_REVIEW_HOURS * 60 * 60 * 1000,
  ).toISOString();
  state.nextWeeklyReviewAt = new Date(
    Date.now() + PROJECT_STRATEGIST_WEEKLY_REVIEW_HOURS * 60 * 60 * 1000,
  ).toISOString();
  await saveProjectStrategistState(state);

  return {
    ok: true,
    report,
    state,
    trigger: input.trigger ?? "manual",
  };
}

export async function getProjectStrategistStatus(
  workspaceId?: string,
): Promise<ProjectStrategistStatusSnapshot> {
  const state = await loadProjectStrategistState(resolveWorkspaceId(workspaceId));
  return buildProjectStrategistStatusSnapshot(state);
}

export async function addProjectStrategistSource(input: {
  workspaceId?: string;
  sourceUrl: string;
  title?: string;
}): Promise<ProjectStrategistStatusSnapshot> {
  const workspaceId = resolveWorkspaceId(input.workspaceId);
  const state = await loadProjectStrategistState(workspaceId);
  const fetched = await fetchExternalSourceContent({
    sourceUrl: input.sourceUrl,
    title: input.title,
  });
  const source: StrategistExternalSource = {
    ...fetched,
    sourceId: newStrategistSourceId(),
  };
  state.sources = mergeStrategistSources(state.sources, [source]);
  await saveProjectStrategistState(state);
  return buildProjectStrategistStatusSnapshot(state);
}

export async function pasteProjectStrategistSource(input: {
  workspaceId?: string;
  sourceUrl?: string | null;
  title?: string;
  sourceContent: string;
}): Promise<ProjectStrategistStatusSnapshot> {
  const workspaceId = resolveWorkspaceId(input.workspaceId);
  const state = await loadProjectStrategistState(workspaceId);
  const source = buildSource({
    sourceUrl: input.sourceUrl ?? null,
    title: input.title,
    sourceContent: input.sourceContent,
    fetchStatus: "PASTED",
  });
  state.sources = mergeStrategistSources(state.sources, [source]);
  await saveProjectStrategistState(state);
  return buildProjectStrategistStatusSnapshot(state);
}

export async function approveProjectStrategistSkill(input: {
  workspaceId?: string;
  skillId: string;
}): Promise<ProjectStrategistStatusSnapshot> {
  const state = await loadProjectStrategistState(resolveWorkspaceId(input.workspaceId));
  state.skills = updateSkillStatus(
    state.skills,
    input.skillId,
    "ACTIVE",
    "Approved by operator.",
  );
  await saveProjectStrategistState(state);
  return buildProjectStrategistStatusSnapshot(state);
}

export async function rejectProjectStrategistSkill(input: {
  workspaceId?: string;
  skillId: string;
  reason?: string | null;
}): Promise<ProjectStrategistStatusSnapshot> {
  const state = await loadProjectStrategistState(resolveWorkspaceId(input.workspaceId));
  state.skills = updateSkillStatus(
    state.skills,
    input.skillId,
    "REJECTED",
    input.reason ?? "Rejected by operator.",
  );
  await saveProjectStrategistState(state);
  return buildProjectStrategistStatusSnapshot(state);
}

export async function markProjectStrategistMvp(input: {
  workspaceId?: string;
  mvpId: string;
  status: "ACCEPTED" | "IMPLEMENTED";
}): Promise<ProjectStrategistStatusSnapshot> {
  const state = await loadProjectStrategistState(resolveWorkspaceId(input.workspaceId));
  state.mvpProposals = updateMvpStatus(state.mvpProposals, input.mvpId, input.status);
  await saveProjectStrategistState(state);
  return buildProjectStrategistStatusSnapshot(state);
}

export function getProjectStrategistSafetyNotice(): string {
  return PROJECT_STRATEGIST_SAFETY_NOTICE;
}
