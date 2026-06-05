import { loadCronAnalysisInput } from "@/lib/cron/cron-config";
import { runAnalyzeRequest } from "@/lib/decision/run-analyze";
import { runMultiAssetScan } from "@/lib/multi-asset/multi-asset-scanner";
import { runCouncilSession } from "@/lib/council/run-council-session";
import { buildRegretMetrics } from "@/lib/regret/regret-tracker";
import { runCapitalRiskSimulator } from "@/lib/simulation/capital-risk-simulator";
import {
  defaultCapitalRiskInput,
} from "@/lib/simulation/milestone-projection";
import {
  deriveEquityFromLog,
  deriveTradingStatsFromLog,
} from "@/lib/simulation/derive-stats";
import { runScenarioDrill } from "@/lib/war-room/scenario-drill-engine";
import { buildCapitalReport } from "@/lib/capital/build-capital-report";
import { buildValidationReport } from "@/lib/validation/build-validation-report";
import { checkTradeFrequency } from "@/lib/frequency/trade-frequency-governor";
import { buildExchangeStatus } from "@/lib/exchange/build-exchange-status";
import { buildOperatorBehaviorAnalytics } from "@/lib/operator/operator-behavior-analytics";
import { buildOperatorDisciplineReport } from "@/lib/operator/operator-discipline-score";
import type {
  AutomationModuleId,
  DeskAutomationInput,
  DeskAutomationResult,
  ModuleRunMeta,
} from "./automation-types";
import {
  buildAutomationSummary,
  deriveAutomationActions,
} from "./derive-automation-actions";

const ALL_MODULES: AutomationModuleId[] = [
  "analyze",
  "assets",
  "council",
  "mortem",
  "simulation",
  "war_room",
  "capital",
  "validation",
  "frequency",
  "exchange",
  "operator",
];

async function runModule<T>(
  fn: () => Promise<T> | T,
): Promise<{ data: T | null; meta: ModuleRunMeta }> {
  const start = Date.now();
  try {
    const data = await fn();
    return { data, meta: { ok: true, durationMs: Date.now() - start } };
  } catch (error) {
    return {
      data: null,
      meta: {
        ok: false,
        durationMs: Date.now() - start,
        error: error instanceof Error ? error.message : "Module failed",
      },
    };
  }
}

function pickWarScenario(priceChange24h: number | null): "btc_dump_8pct" | "funding_flip_negative" | "bybit_api_stale" {
  if (priceChange24h !== null && priceChange24h < -5) return "btc_dump_8pct";
  return "funding_flip_negative";
}

/**
 * Runs the full desk automation cycle across all ops modules.
 * Designed for AI/cron orchestration — returns actionable items, not just static UI data.
 */
export async function runDeskAutomation(
  input: DeskAutomationInput = {},
): Promise<DeskAutomationResult> {
  const entries = input.entries ?? [];
  const orders = input.orders ?? [];
  const riskProfile = input.riskProfile ?? "balanced";
  const modules = input.modules?.length ? input.modules : ALL_MODULES;
  const runId = `auto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const meta: Partial<Record<AutomationModuleId, ModuleRunMeta>> = {};

  let analyze = null;
  if (modules.includes("analyze")) {
    const r = await runModule(async () => {
      const cronInput = await loadCronAnalysisInput();
      return runAnalyzeRequest(cronInput);
    });
    analyze = r.data;
    meta.analyze = r.meta;
  }

  let assets = null;
  if (modules.includes("assets")) {
    const r = await runModule(() => runMultiAssetScan());
    assets = r.data;
    meta.assets = r.meta;
  }

  const equity =
    input.currentEquity ?? deriveEquityFromLog(entries, orders);

  let council = null;
  if (modules.includes("council")) {
    const r = await runModule(() =>
      Promise.resolve(
        runCouncilSession({
          request: {
            topic: input.topic ?? "Automation cycle — improve pace to $20k",
            currentEquity: equity,
            startingCapital: 1_000,
            goalCapital: 20_000,
          },
          entries,
          orders,
          riskProfile,
        }),
      ),
    );
    council = r.data;
    meta.council = r.meta;
  }

  let mortem = null;
  if (modules.includes("mortem")) {
    const r = await runModule(() => Promise.resolve(buildRegretMetrics(entries)));
    mortem = r.data;
    meta.mortem = r.meta;
  }

  let simulation = null;
  if (modules.includes("simulation")) {
    const r = await runModule(() => {
      const stats = deriveTradingStatsFromLog(entries);
      const simInput = defaultCapitalRiskInput({
        currentEquity: equity,
        winRate: stats.winRate,
        averageWinR: stats.averageWinR,
        averageLossR: stats.averageLossR,
      });
      const capitalRisk = runCapitalRiskSimulator(simInput);
      const aggressiveBlocked =
        capitalRisk.probabilityRuin > 20 ||
        capitalRisk.expectedMaxDrawdown > simInput.maxDrawdownPct ||
        stats.avgR <= 0;
      return {
        probabilityRuin: capitalRisk.probabilityRuin,
        aggressiveModeSafe: !aggressiveBlocked,
        recommendedRiskPct: capitalRisk.recommendedRiskPct,
      };
    });
    simulation = r.data;
    meta.simulation = r.meta;
  }

  let warRoom = null;
  if (modules.includes("war_room")) {
    const r = await runModule(() => {
      const change = analyze?.step1_marketSnapshot?.priceChange24hPct ?? null;
      const scenarioId = pickWarScenario(change);
      const drill = runScenarioDrill({ scenarioId, entries });
      return {
        scenarioId,
        recommendedAction: drill.enableSafeMode
          ? `Safe mode: ${drill.emergencyAction}`
          : drill.emergencyAction,
      };
    });
    warRoom = r.data;
    meta.war_room = r.meta;
  }

  let capital = null;
  if (modules.includes("capital")) {
    const r = await runModule(() =>
      Promise.resolve(
        buildCapitalReport({
          entries,
          orders,
          riskProfile,
          latestAnalysis: analyze,
        }),
      ),
    );
    capital = r.data;
    meta.capital = r.meta;
  }

  let validation = null;
  if (modules.includes("validation")) {
    const r = await runModule(() =>
      Promise.resolve(
        buildValidationReport({
          entries,
          orders,
          riskProfile,
          latestAnalysis: analyze,
        }),
      ),
    );
    validation = r.data;
    meta.validation = r.meta;
  }

  let frequency = null;
  if (modules.includes("frequency")) {
    const r = await runModule(() =>
      Promise.resolve(
        checkTradeFrequency({
          entries,
          conflict: analyze?.conflictAnalysis ?? null,
        }),
      ),
    );
    frequency = r.data;
    meta.frequency = r.meta;
  }

  let exchange = null;
  if (modules.includes("exchange")) {
    const r = await runModule(() => buildExchangeStatus());
    exchange = r.data;
    meta.exchange = r.meta;
  }

  let operator = null;
  if (modules.includes("operator")) {
    const r = await runModule(() => {
      const analytics = buildOperatorBehaviorAnalytics({
        entries,
        overrideLog: [],
      });
      const report = buildOperatorDisciplineReport(analytics);
      return {
        disciplineScore: report.operatorDisciplineScore,
        grade: report.grade,
      };
    });
    operator = r.data;
    meta.operator = r.meta;
  }

  const partial = {
    runId,
    timestamp: new Date().toISOString(),
    modulesRun: modules,
    meta,
    analyze,
    assets,
    council,
    mortem,
    simulation,
    warRoom,
    capital,
    validation,
    frequency,
    exchange,
    operator,
  };

  const actions = deriveAutomationActions(partial);
  const { summary, aiBrief } = buildAutomationSummary(actions, partial);

  return { ...partial, actions, summary, aiBrief };
}
