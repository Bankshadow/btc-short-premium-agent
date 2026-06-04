import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import { buildCapitalReport } from "@/lib/capital/build-capital-report";
import { loadCapitalSettings } from "@/lib/capital/capital-settings";
import { MISSION_GOAL_USD, MISSION_DEFAULT_START_USD } from "@/lib/capital/capital-mission-config";
import { buildValidationReport } from "@/lib/validation/build-validation-report";
import { buildAgentScoreboard } from "@/lib/journal/agent-scoreboard";
import { buildDeskPortfolioSnapshot } from "@/lib/portfolio/milestones";
import { evaluateHardRuleLocks } from "@/lib/governance/hard-rule-lock";
import type { CouncilRunRequest } from "./types";

export interface CouncilSessionContext {
  topic: string;
  entries: DecisionLogEntry[];
  orders: PaperOrder[];
  riskProfile: DeskRiskProfile;
  startingCapitalUsd: number;
  goalCapitalUsd: number;
  currentEquityUsd: number;
  capitalReport: ReturnType<typeof buildCapitalReport>;
  validation: ReturnType<typeof buildValidationReport>;
  scoreboard: ReturnType<typeof buildAgentScoreboard>;
  portfolio: ReturnType<typeof buildDeskPortfolioSnapshot>;
  hardRulesLocked: ReturnType<typeof evaluateHardRuleLocks>;
}

export function buildCouncilContext(input: {
  request: CouncilRunRequest;
  entries: DecisionLogEntry[];
  orders: PaperOrder[];
  riskProfile: DeskRiskProfile;
}): CouncilSessionContext {
  const settings = loadCapitalSettings();
  const startingCapitalUsd =
    input.request.startingCapital ?? settings.missionStartUsd ?? MISSION_DEFAULT_START_USD;
  const goalCapitalUsd = input.request.goalCapital ?? MISSION_GOAL_USD;

  const capitalReport = buildCapitalReport({
    entries: input.entries,
    orders: input.orders,
    riskProfile: input.riskProfile,
    settings: { ...settings, missionStartUsd: startingCapitalUsd },
  });

  const currentEquityUsd =
    input.request.currentEquity ?? capitalReport.stage.equityUsd;

  return {
    topic:
      input.request.topic?.trim() ||
      "Accelerate $1k→$20k mission with controlled risk — paper-first improvements only",
    entries: input.entries,
    orders: input.orders,
    riskProfile: input.riskProfile,
    startingCapitalUsd,
    goalCapitalUsd,
    currentEquityUsd,
    capitalReport,
    validation: buildValidationReport({
      entries: input.entries,
      orders: input.orders,
      riskProfile: input.riskProfile,
    }),
    scoreboard: buildAgentScoreboard(input.entries),
    portfolio: buildDeskPortfolioSnapshot(input.entries, input.orders),
    hardRulesLocked: evaluateHardRuleLocks({
      entries: input.entries,
      orders: input.orders,
      riskProfile: input.riskProfile,
    }),
  };
}
