import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import {
  PROJECT_STRATEGIST_DAILY_REVIEW_HOURS,
  PROJECT_STRATEGIST_MAX_MVPS,
  PROJECT_STRATEGIST_MAX_REPORTS,
  PROJECT_STRATEGIST_MAX_SKILLS,
  PROJECT_STRATEGIST_MAX_SOURCES,
  PROJECT_STRATEGIST_STATE_FILE,
  PROJECT_STRATEGIST_WEEKLY_REVIEW_HOURS,
} from "./config";
import type {
  MVPProposal,
  MVPStatus,
  ProjectStrategistReport,
  ProjectStrategistState,
  ProjectStrategistStatusSnapshot,
  SkillCard,
  SkillCardStatus,
  StrategistExternalSource,
} from "./types";

export function defaultProjectStrategistState(
  workspaceId = "server-default",
): ProjectStrategistState {
  const now = Date.now();
  return {
    workspaceId,
    latestUserGoal: null,
    lastRunAt: null,
    nextDailyReviewAt: new Date(
      now + PROJECT_STRATEGIST_DAILY_REVIEW_HOURS * 60 * 60 * 1000,
    ).toISOString(),
    nextWeeklyReviewAt: new Date(
      now + PROJECT_STRATEGIST_WEEKLY_REVIEW_HOURS * 60 * 60 * 1000,
    ).toISOString(),
    reports: [],
    sources: [],
    skills: [],
    mvpProposals: [],
  };
}

export async function loadProjectStrategistState(
  workspaceId = "server-default",
): Promise<ProjectStrategistState> {
  const state = await readCronJsonFile(
    PROJECT_STRATEGIST_STATE_FILE,
    defaultProjectStrategistState(workspaceId),
  );
  state.workspaceId = workspaceId;
  if (!Array.isArray(state.reports)) state.reports = [];
  if (!Array.isArray(state.sources)) state.sources = [];
  if (!Array.isArray(state.skills)) state.skills = [];
  if (!Array.isArray(state.mvpProposals)) state.mvpProposals = [];
  state.latestUserGoal ??= null;
  state.lastRunAt ??= null;
  state.nextDailyReviewAt ??= null;
  state.nextWeeklyReviewAt ??= null;
  return state;
}

export async function saveProjectStrategistState(
  state: ProjectStrategistState,
): Promise<void> {
  await writeCronJsonFile(PROJECT_STRATEGIST_STATE_FILE, state);
}

function upsertByKey<T, K>(
  list: T[],
  next: T,
  keySelector: (item: T) => K,
): T[] {
  const key = keySelector(next);
  return [next, ...list.filter((item) => keySelector(item) !== key)];
}

export function mergeStrategistSources(
  existing: StrategistExternalSource[],
  incoming: StrategistExternalSource[],
): StrategistExternalSource[] {
  let merged = [...existing];
  for (const source of incoming) {
    merged = upsertByKey(merged, source, (item) => item.sourceId);
  }
  return merged.slice(0, PROJECT_STRATEGIST_MAX_SOURCES);
}

export function mergeSkillCards(
  existing: SkillCard[],
  incoming: SkillCard[],
): SkillCard[] {
  let merged = [...existing];
  for (const skill of incoming) {
    merged = upsertByKey(merged, skill, (item) => item.skillId);
  }
  return merged.slice(0, PROJECT_STRATEGIST_MAX_SKILLS);
}

export function mergeMvpProposals(
  existing: MVPProposal[],
  incoming: MVPProposal[],
): MVPProposal[] {
  let merged = [...existing];
  for (const mvp of incoming) {
    merged = upsertByKey(merged, mvp, (item) => item.mvpId);
  }
  return merged.slice(0, PROJECT_STRATEGIST_MAX_MVPS);
}

export function updateSkillStatus(
  skills: SkillCard[],
  skillId: string,
  status: SkillCardStatus,
  reason: string | null,
): SkillCard[] {
  return skills.map((skill) => {
    if (skill.skillId !== skillId) return skill;
    const previous = skill.status;
    return {
      ...skill,
      status,
      updatedAt: new Date().toISOString(),
      statusHistory: [
        ...(skill.statusHistory ?? []),
        {
          from: previous,
          to: status,
          at: new Date().toISOString(),
          reason,
        },
      ],
    };
  });
}

export function updateMvpStatus(
  mvps: MVPProposal[],
  mvpId: string,
  status: MVPStatus,
): MVPProposal[] {
  return mvps.map((mvp) =>
    mvp.mvpId === mvpId
      ? { ...mvp, status, updatedAt: new Date().toISOString() }
      : mvp,
  );
}

export function appendStrategistReport(
  reports: ProjectStrategistReport[],
  report: ProjectStrategistReport,
): ProjectStrategistReport[] {
  return [report, ...reports.filter((r) => r.reportId !== report.reportId)].slice(
    0,
    PROJECT_STRATEGIST_MAX_REPORTS,
  );
}

export function buildProjectStrategistStatusSnapshot(
  state: ProjectStrategistState,
): ProjectStrategistStatusSnapshot {
  const latestReport = state.reports[0] ?? null;
  return {
    state,
    latestReport,
    acceptedMVPs: state.mvpProposals.filter((m) => m.status === "ACCEPTED"),
    rejectedMVPs: state.mvpProposals.filter((m) => m.status === "REJECTED"),
    implementedMVPs: state.mvpProposals.filter(
      (m) => m.status === "IMPLEMENTED",
    ),
  };
}
