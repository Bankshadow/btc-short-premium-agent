import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import { buildCapitalReport } from "@/lib/capital/build-capital-report";
import { loadCapitalSettings } from "@/lib/capital/capital-settings";
import { MISSION_GOAL_USD, MISSION_DEFAULT_START_USD } from "@/lib/capital/capital-mission-config";
import { buildValidationReport } from "@/lib/validation/build-validation-report";
import { buildAgentScoreboard } from "@/lib/journal/agent-scoreboard";
import { buildDeskPortfolioSnapshot } from "@/lib/portfolio/milestones";
import { buildUnifiedPortfolioSnapshot } from "@/lib/portfolio/build-unified-portfolio";
import type { PerpPaperPosition } from "@/lib/multi-asset/types";
import type { UnifiedPortfolioSnapshot } from "@/lib/portfolio/unified-types";
import { evaluateHardRuleLocks } from "@/lib/governance/hard-rule-lock";
import type { StrategyAdaptationProposal } from "@/lib/strategy-adaptation/types";
import type { DeskIncident } from "@/lib/governance/governance-types";
import type { StrategySkill } from "@/lib/strategy-registry/strategy-registry-types";
import { buildMemoryGraph } from "@/lib/memory-graph/build-graph";
import { getRelevantMemory } from "@/lib/memory-graph/get-relevant-memory";
import type { RelevantMemoryResult } from "@/lib/memory-graph/types";
import type { CouncilRunRequest, CouncilSessionResult } from "./types";

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
  unifiedPortfolio: UnifiedPortfolioSnapshot;
  hardRulesLocked: ReturnType<typeof evaluateHardRuleLocks>;
  adaptationProposals: StrategyAdaptationProposal[];
  relevantMemory: RelevantMemoryResult;
  memoryGraphNodeCount: number;
}

export function buildCouncilContext(input: {
  request: CouncilRunRequest;
  entries: DecisionLogEntry[];
  orders: PaperOrder[];
  perpPositions?: PerpPaperPosition[];
  riskProfile: DeskRiskProfile;
  adaptationProposals?: StrategyAdaptationProposal[];
  incidents?: DeskIncident[];
  councilSessions?: CouncilSessionResult[];
  registryStrategies?: StrategySkill[];
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

  const graphSnapshot = buildMemoryGraph({
    entries: input.entries,
    orders: input.orders,
    incidents: input.incidents ?? [],
    councilSessions: input.councilSessions ?? [],
    adaptationProposals: input.adaptationProposals ?? [],
    registryStrategies: input.registryStrategies ?? [],
  });

  const relevantMemory = getRelevantMemory(graphSnapshot, {
    marketRegime: input.entries[0]?.marketRegime,
    riskProfile: input.riskProfile,
    limit: 6,
  });

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
    unifiedPortfolio: buildUnifiedPortfolioSnapshot({
      entries: input.entries,
      orders: input.orders,
      perpPositions: input.perpPositions ?? [],
      riskProfile: input.riskProfile,
    }),
    hardRulesLocked: evaluateHardRuleLocks({
      entries: input.entries,
      orders: input.orders,
      riskProfile: input.riskProfile,
    }),
    adaptationProposals: input.adaptationProposals ?? [],
    relevantMemory,
    memoryGraphNodeCount: graphSnapshot.nodeCount,
  };
}
