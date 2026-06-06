import type { ProjectStrategistSafety } from "./types";

export const PROJECT_STRATEGIST_STATE_FILE = "project-strategist-state.json";
export const PROJECT_STRATEGIST_MAX_REPORTS = 90;
export const PROJECT_STRATEGIST_MAX_SOURCES = 120;
export const PROJECT_STRATEGIST_MAX_SKILLS = 200;
export const PROJECT_STRATEGIST_MAX_MVPS = 200;

export const PROJECT_STRATEGIST_DAILY_REVIEW_HOURS = 24;
export const PROJECT_STRATEGIST_WEEKLY_REVIEW_HOURS = 24 * 7;

export const PROJECT_STRATEGIST_SAFETY: ProjectStrategistSafety = {
  cannotTrade: true,
  cannotChangeLiveSettings: true,
  cannotAutoMergeCode: true,
  cannotApproveOwnSkillUpdates: true,
  cannotApplyExternalPromptDirectly: true,
  cannotEnableLiveTrading: true,
  cannotDeleteModules: true,
};

export const PROJECT_STRATEGIST_SAFETY_NOTICE =
  "Strategist is analysis-only: no trading, no live setting changes, no auto-merge, no self-approval.";
