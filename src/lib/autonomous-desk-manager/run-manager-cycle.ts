import { runDeskAutomation } from "@/lib/automation/run-desk-automation";
import { buildMemoryGraph } from "@/lib/memory-graph/build-graph";
import { runBatchEvaluation } from "@/lib/self-learning/run-evaluation";
import { buildLearningEvaluationReport } from "@/lib/self-learning/build-learning-report";
import { runRuleDiscovery } from "@/lib/rule-discovery/run-discovery";
import { runAdaptationAnalysis } from "@/lib/strategy-adaptation/run-adaptation-analysis";
import { buildExperimentLabReport } from "@/lib/strategy-experiments/build-report";
import { buildStrategyRegistry } from "@/lib/strategy-registry/build-strategy-registry";
import { evaluateHardRuleLocks } from "@/lib/governance/hard-rule-lock";
import { DEFAULT_GOVERNANCE_STATE } from "@/lib/governance/governance-state";
import { buildOperatorBriefing } from "./build-briefing";
import { buildActionQueue } from "./build-action-queue";
import { buildLearningSummary } from "./build-learning-summary";
import { buildRiskSummary } from "./build-risk-summary";
import { checkSafetyGates } from "./check-safety-gates";
import type {
  AutomationTimelineEntry,
  DeskManagerCycleType,
  DeskManagerInput,
  DeskManagerRunResult,
} from "./types";
import { DESK_MANAGER_SAFETY_NOTICE } from "./types";

async function timedStep<T>(
  step: string,
  fn: () => Promise<T> | T,
  timeline: AutomationTimelineEntry[],
  skip = false,
): Promise<T | null> {
  if (skip) {
    timeline.push({ step, status: "skipped", durationMs: 0, detail: "Not in cycle scope" });
    return null;
  }
  const start = Date.now();
  try {
    const result = await fn();
    timeline.push({
      step,
      status: "ok",
      durationMs: Date.now() - start,
      detail: "Completed",
    });
    return result;
  } catch (error) {
    timeline.push({
      step,
      status: "error",
      durationMs: Date.now() - start,
      detail: error instanceof Error ? error.message : "Step failed",
    });
    return null;
  }
}

function findNewlyResolvedTradeIds(
  entries: DeskManagerInput["entries"],
  lastRunAt: string | null | undefined,
): string[] {
  const cutoff = lastRunAt ? new Date(lastRunAt).getTime() : 0;
  return (entries ?? [])
    .filter((e) => e.outcomeStatus === "RESOLVED")
    .filter((e) => {
      const resolvedAt =
        e.resolution?.resolvedAt ?? e.timestamp;
      return new Date(resolvedAt).getTime() > cutoff;
    })
    .map((e) => e.id);
}

export async function runDeskManagerCycle(
  input: DeskManagerInput = {},
): Promise<DeskManagerRunResult> {
  const cycleType: DeskManagerCycleType = input.cycleType ?? "operational";
  const runId = `mgr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const timestamp = new Date().toISOString();
  const timeline: AutomationTimelineEntry[] = [];

  const entries = input.entries ?? [];
  const orders = input.orders ?? [];
  const perpPositions = input.perpPositions ?? [];
  const riskProfile = input.riskProfile ?? "balanced";
  const governance = input.governanceState ?? DEFAULT_GOVERNANCE_STATE;

  const hardRules = evaluateHardRuleLocks({
    entries,
    orders,
    riskProfile,
  });

  const gates = checkSafetyGates({ governance, hardRules });
  if (!gates.allowed) {
    const risk = buildRiskSummary({ governance, hardRules });
    const learning = buildLearningSummary({ report: null, newEvaluations: [] });
    const briefing = buildOperatorBriefing({
      automation: null,
      learning,
      risk,
      actions: [],
    });
    return {
      runId,
      cycleType,
      timestamp,
      blocked: true,
      blockReason: gates.blockReason,
      briefing,
      actionQueue: [],
      learningSummary: learning,
      riskSummary: risk,
      timeline,
      automation: null,
      memoryGraphUpdated: false,
      safetyNotice: DESK_MANAGER_SAFETY_NOTICE,
    };
  }

  const runOperational = cycleType === "operational";
  const runLearningModules =
    cycleType === "operational" ||
    cycleType === "daily_learning" ||
    cycleType === "weekly_strategy_review";
  const runStrategyReview =
    cycleType === "weekly_strategy_review" || cycleType === "operational";

  let automation = input.automationResult ?? null;
  if (runOperational && !automation) {
    automation = await timedStep(
      "run_analyze_and_ops_modules",
      () =>
        runDeskAutomation({
          entries,
          orders,
          perpPositions,
          riskProfile,
          topic: "Autonomous desk manager — operational cycle",
        }),
      timeline,
    );
  } else if (automation) {
    timeline.push({
      step: "run_analyze_and_ops_modules",
      status: "skipped",
      durationMs: 0,
      detail: "Reused automation result from chained run",
    });
  } else {
    timeline.push({
      step: "run_analyze_and_ops_modules",
      status: "skipped",
      durationMs: 0,
      detail: "Learning-only cycle",
    });
  }

  const registry = buildStrategyRegistry({ entries, orders, riskProfile });

  const memoryGraph = await timedStep(
    "update_memory_graph",
    () =>
      Promise.resolve(
        buildMemoryGraph({
          entries,
          orders,
          incidents: input.incidents,
          councilSessions: input.councilSessions,
          adaptationProposals: input.storedAdaptationProposals,
          registryStrategies: input.registryStrategies ?? registry.strategies,
        }),
      ),
    timeline,
    !runLearningModules,
  );

  const newTradeIds = findNewlyResolvedTradeIds(entries, input.lastManagerRunAt);
  const newEvaluations =
    (await timedStep(
      "evaluate_closed_trades",
      () =>
        Promise.resolve(
          runBatchEvaluation(
            entries.filter((e) => newTradeIds.includes(e.id)),
            false,
          ),
        ),
      timeline,
      !runLearningModules || newTradeIds.length === 0,
    )) ?? [];

  const allEvaluations = [
    ...newEvaluations,
    ...(input.storedEvaluations ?? []),
  ];
  const learningReport = await timedStep(
    "update_agent_performance",
    () =>
      Promise.resolve(
        buildLearningEvaluationReport({
          entries,
          storedResults: allEvaluations,
        }),
      ),
    timeline,
    !runLearningModules,
  );

  const ruleDiscovery = await timedStep(
    "discover_new_rules",
    () =>
      Promise.resolve(
        runRuleDiscovery(
          {
            entries,
            orders,
            perpPositions,
            riskProfile,
            evaluations: allEvaluations,
            memoryGraph: memoryGraph ?? undefined,
            registryStrategies: registry.strategies,
          },
          input.storedRuleProposals ?? [],
          false,
        ),
      ),
    timeline,
    !runLearningModules,
  );

  const experiments = await timedStep(
    "check_active_experiments",
    () =>
      Promise.resolve(
        buildExperimentLabReport(input.experiments ?? [], []),
      ),
    timeline,
    !runLearningModules,
  );

  const adaptation = await timedStep(
    "generate_strategy_proposals",
    () =>
      Promise.resolve(
        runAdaptationAnalysis({
          entries,
          orders,
          perpPositions,
          riskProfile,
          registry,
        }),
      ),
    timeline,
    !runStrategyReview,
  );

  await timedStep(
    "check_risk_governance",
    () => Promise.resolve(buildRiskSummary({ governance, hardRules, automation })),
    timeline,
  );

  const risk = buildRiskSummary({ governance, hardRules, automation });
  const learningSummary = buildLearningSummary({
    report: learningReport,
    newEvaluations,
  });

  const experimentNotes = [
    `${experiments?.activeExperiments.length ?? 0} active experiment(s)`,
    `${experiments?.promotionCandidates.length ?? 0} promotion candidate(s)`,
  ];

  const actionQueue = buildActionQueue({
    runId,
    cycleType,
    automation,
    learning: learningReport,
    ruleDiscovery: ruleDiscovery ?? undefined,
    adaptation: adaptation ?? undefined,
    experiments: experiments ?? undefined,
    risk,
    newTradeIds,
  });

  const briefing = buildOperatorBriefing({
    automation,
    learning: learningSummary,
    risk,
    actions: actionQueue,
    experimentNotes,
  });

  timeline.push({
    step: "create_operator_briefing",
    status: "ok",
    durationMs: 0,
    detail: briefing.headline,
  });
  timeline.push({
    step: "create_action_queue",
    status: "ok",
    durationMs: 0,
    detail: `${actionQueue.filter((a) => a.status === "PENDING").length} pending action(s)`,
  });

  return {
    runId,
    cycleType,
    timestamp,
    blocked: false,
    briefing,
    actionQueue,
    learningSummary,
    riskSummary: risk,
    timeline,
    automation,
    memoryGraphUpdated: memoryGraph != null,
    safetyNotice: DESK_MANAGER_SAFETY_NOTICE,
    clientMustPersist: {
      evaluations: newEvaluations.length > 0 ? newEvaluations : undefined,
      ruleProposals: ruleDiscovery?.proposals,
      adaptationProposals: adaptation?.proposals,
      memoryGraph: memoryGraph ?? undefined,
    },
  };
}
