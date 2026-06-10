import { loadServerAnalysisJournal } from "@/lib/journal/journal-server-store";
import { filterProductionEntries, filterProductionOrders } from "@/lib/journal/production-filter";
import { listWarehouseRows } from "@/lib/db/repositories/warehouse-repository";
import { buildStrategyRegistry, buildRegistryPayloadForAnalyze } from "@/lib/strategy-registry/build-strategy-registry";
import { buildGovernancePayloadForAnalyze } from "@/lib/governance/build-governance-payload";
import { loadGovernanceState } from "@/lib/governance/governance-state";
import { evaluateKillSwitch } from "@/lib/validation/kill-switch";
import { evaluateRealTimeRisk } from "@/lib/real-time-risk/evaluate-realtime-risk";
import { loadIncidents } from "@/lib/governance/incidents-store";
import { getBinanceStatus, getPositions } from "@/lib/exchange/binance/binance-futures-testnet";
import { blockBinanceProductionOrder, isBinanceTestnetAutoExecuteEnabled } from "@/lib/exchange/binance/binance-config";
import { buildTestnetMonitorSnapshot } from "@/lib/testnet-monitor";
import { buildMissionFlowServerSnapshot } from "@/lib/mission-flow/build-server-snapshot";
import { loadMonitorJournalEvents } from "@/lib/testnet-monitor/monitor-journal-server";
import { loadAutomationHistory } from "@/lib/automation-control-plane/state-store";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { AnalysisContext, AnalysisEnvironment } from "./analysis-state";
import { newAnalysisRunId } from "./analysis-events";

export interface BuildAnalysisContextInput {
  runId?: string;
  riskProfile?: DeskRiskProfile;
  orders?: PaperOrder[];
}

export async function buildAnalysisContext(
  input: BuildAnalysisContextInput = {},
): Promise<AnalysisContext> {
  const runId = input.runId ?? newAnalysisRunId("ctx");
  const riskProfile = input.riskProfile ?? "balanced";

  const [
    entriesRaw,
    paperRows,
    binanceStatus,
    monitorSnapshot,
    missionResult,
    journalEvents,
    automationHistory,
    positions,
  ] = await Promise.all([
    loadServerAnalysisJournal().catch(() => []),
    input.orders
      ? Promise.resolve(input.orders)
      : listWarehouseRows("paper_trades", 500).catch(() => [] as PaperOrder[]),
    getBinanceStatus().catch(() => null),
    buildTestnetMonitorSnapshot().catch(() => null),
    buildMissionFlowServerSnapshot().catch(() => null),
    loadMonitorJournalEvents().catch(() => []),
    loadAutomationHistory().catch(() => []),
    getPositions().catch(() => []),
  ]);

  const entries = filterProductionEntries(entriesRaw);
  const orders = filterProductionOrders(
    Array.isArray(paperRows) ? (paperRows as PaperOrder[]) : [],
  );
  const strategySnapshot = buildStrategyRegistry({ entries, orders, riskProfile });
  const strategyRegistry = buildRegistryPayloadForAnalyze(strategySnapshot);
  const governance = buildGovernancePayloadForAnalyze({
    entries,
    orders,
    riskProfile,
  });
  const governanceState = loadGovernanceState();
  const incidents = loadIncidents();

  const killSwitchStatus = evaluateKillSwitch({ entries, orders, riskProfile });
  const riskReport = evaluateRealTimeRisk({
    entries,
    orders,
    governance: governanceState,
    incidents,
  });
  const openIncidents = incidents.filter(
    (i) => i.status === "open" || i.status === "investigating",
  );
  const criticalOpen = openIncidents.some((i) => i.severity === "critical");

  const openPositions = positions
    .filter((p) => Math.abs(Number(p.positionAmt)) > 0)
    .map((p) => `${p.symbol} ${Number(p.positionAmt) > 0 ? "LONG" : "SHORT"}`);

  const latestEntry = entries[0] ?? null;

  const environment: AnalysisEnvironment = binanceStatus?.connected
    ? "TESTNET"
    : "PAPER";

  const liveBlock = blockBinanceProductionOrder();

  const lastSimRun = automationHistory.find((h) => h.status === "SUCCESS");

  const learningRecords = monitorSnapshot?.learningRecords ?? [];

  const baseContext: AnalysisContext = {
    runId,
    environment,
    builtAt: new Date().toISOString(),
    market: {
      spotPrice: latestEntry?.btcPrice ?? null,
      regime: latestEntry?.marketRegime ?? null,
      ivHvRatio: null,
      fundingRate: null,
    },
    positions: openPositions,
    trades: {
      openCount: openPositions.length,
      closedCount: orders.filter((o) => o.status === "CLOSED").length,
    },
    decisionLog: entries.slice(0, 50),
    journal: journalEvents.slice(0, 100),
    strategyRegistry,
    governance,
    validation: {
      killSwitchActive: killSwitchStatus.tradingPaused,
      blockers: riskReport.triggeredLimits,
    },
    killSwitch: {
      active: killSwitchStatus.tradingPaused,
      reason: killSwitchStatus.messages[0] ?? null,
    },
    riskPolicy: {
      profile: riskProfile,
      blockNewTrades: riskReport.blockNewTrades,
      triggeredLimits: riskReport.triggeredLimits,
    },
    learningRecords: learningRecords.slice(0, 50),
    agentScoreboard: {
      totalLearned: learningRecords.filter((r) => r.status === "LEARNED").length,
      topAgent: learningRecords[0]?.sourceAgent ?? null,
    },
    councilState: {
      weightedVerdict: latestEntry?.finalVerdict ?? null,
      confidence: latestEntry?.playbookConfidence ?? latestEntry?.committeeTradeScore ?? null,
      riskVeto: Boolean(latestEntry?.riskVeto ?? governance?.hardRules?.locked),
      agentCount: latestEntry?.agentOutputs?.length ?? 0,
    },
    simulationState: {
      available: automationHistory.length > 0,
      lastRunAt: lastSimRun?.completedAt ?? null,
    },
    incidentState: {
      openCount: openIncidents.length,
      criticalOpen,
      topTitle: openIncidents[0]?.description?.slice(0, 80) ?? null,
    },
    missionSnapshot: missionResult?.snapshot ?? null,
    testnetStatus: {
      connected: Boolean(binanceStatus?.connected),
      configured: Boolean(binanceStatus?.configured),
      autoExecuteEnabled: isBinanceTestnetAutoExecuteEnabled(),
      liveLocked: true,
      blocker: liveBlock ?? binanceStatus?.error ?? null,
    },
    advancedModules: [],
    consistency: null,
    evidenceQuality: null,
  };

  const { attachAdvancedModulesToContext } = await import(
    "@/lib/advanced-modules/attach-to-context"
  );
  const withAdvanced = await attachAdvancedModulesToContext({ context: baseContext });
  const { attachConsistencyToContext } = await import(
    "@/lib/engine-consistency/attach-to-context"
  );
  const withConsistency = await attachConsistencyToContext(withAdvanced);
  const { attachEvidenceQualityToContext } = await import(
    "@/lib/evidence-quality/attach-to-context"
  );
  return attachEvidenceQualityToContext(withConsistency);
}
