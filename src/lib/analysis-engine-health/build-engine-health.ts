import { fetchLiveMarket } from "@/lib/bybit/market";
import { probeJournalWritable } from "@/lib/cron/ensure-journal-dir";
import { getBinanceStatus } from "@/lib/exchange/binance/binance-futures-testnet";
import { loadCentralAnalysisBundle } from "@/lib/analysis-engine/analysis-orchestrator";
import { loadServerAnalysisJournal } from "@/lib/journal/journal-server-store";
import { filterProductionEntries, filterProductionOrders } from "@/lib/journal/production-filter";
import { listWarehouseRows } from "@/lib/db/repositories/warehouse-repository";
import { buildStrategyRegistry } from "@/lib/strategy-registry/build-strategy-registry";
import { buildGovernancePayloadForAnalyze } from "@/lib/governance/build-governance-payload";
import { loadGovernanceState } from "@/lib/governance/governance-state";
import { evaluateKillSwitch } from "@/lib/validation/kill-switch";
import { loadLearningRecordsServer } from "@/lib/testnet-monitor/learning-records-server";
import { loadMonitorJournalEvents } from "@/lib/testnet-monitor/monitor-journal-server";
import { buildMissionFlowServerSnapshot } from "@/lib/mission-flow/build-server-snapshot";
import { buildTestnetMonitorSnapshot } from "@/lib/testnet-monitor";
import { REALTIME_RISK_THRESHOLDS } from "@/lib/real-time-risk/config";
import { validateAllRegisteredMvps } from "@/lib/no-orphan-mvp/validate-mvp-integration";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { EngineHealthCheck, EngineHealthSnapshot } from "./types";
import {
  ANALYSIS_ENGINE_HEALTH_LABEL,
  ANALYSIS_ENGINE_HEALTH_MVP,
} from "./types";
import {
  resolveEngineHealthCapabilities,
  resolveEngineHealthSummary,
  sortEngineHealthChecks,
} from "./resolve-engine-health";

const MISSION_STALE_MS = 30 * 60 * 1000;
const REPORTS_STALE_MS = 7 * 24 * 60 * 60 * 1000;

function ageMinutes(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  return ms / 60_000;
}

function check(
  partial: Omit<EngineHealthCheck, "detail"> & { detail?: string | null },
): EngineHealthCheck {
  return {
    detail: null,
    ...partial,
  };
}

export async function buildAnalysisEngineHealthSnapshot(): Promise<EngineHealthSnapshot> {
  const generatedAt = new Date().toISOString();
  const checks: EngineHealthCheck[] = [];

  const [
    marketResult,
    binanceStatus,
    journalProbe,
    entriesRaw,
    paperRows,
    monitorJournal,
    learningRecords,
    missionResult,
    monitorSnapshot,
    centralBundle,
    orphanReport,
  ] = await Promise.all([
    fetchLiveMarket().then((m) => ({ ok: true as const, market: m })).catch((err) => ({
      ok: false as const,
      error: err instanceof Error ? err.message : "Market fetch failed",
    })),
    getBinanceStatus().catch(() => null),
    probeJournalWritable(),
    loadServerAnalysisJournal().catch(() => []),
    listWarehouseRows("paper_trades", 500).catch(() => [] as PaperOrder[]),
    loadMonitorJournalEvents().catch(() => []),
    loadLearningRecordsServer().catch(() => []),
    buildMissionFlowServerSnapshot({ fresh: true }).catch(() => null),
    buildTestnetMonitorSnapshot().catch(() => null),
    loadCentralAnalysisBundle(),
    Promise.resolve(validateAllRegisteredMvps()),
  ]);

  const entries = filterProductionEntries(entriesRaw);
  const orders = filterProductionOrders(
    Array.isArray(paperRows) ? (paperRows as PaperOrder[]) : [],
  );
  const mission = missionResult?.snapshot ?? null;
  const monitorReliability = monitorSnapshot?.monitorReliability ?? mission?.monitorReliability ?? null;
  const { state, latest } = centralBundle;
  const latestDecision = entries[0] ?? null;

  // market data fresh
  if (!marketResult.ok) {
    checks.push(
      check({
        id: "market_data_fresh",
        label: "Market data fresh",
        status: "BLOCKED",
        message: `Market data unavailable — ${marketResult.error}`,
        lastUpdatedAt: null,
        affectsAnalyze: true,
        affectsTrade: true,
        affectsLearn: false,
      }),
    );
  } else {
    const ts = marketResult.market.btc.timestamp;
    const ageMin = ageMinutes(ts);
    const staleLimit = REALTIME_RISK_THRESHOLDS.staleMarketDataMinutes;
    const stale = ageMin != null && ageMin > staleLimit;
    checks.push(
      check({
        id: "market_data_fresh",
        label: "Market data fresh",
        status: stale ? "WARNING" : "OK",
        message: stale
          ? `BTC snapshot is ${Math.round(ageMin!)}m old (limit ${staleLimit}m).`
          : `BTC spot $${marketResult.market.btc.spotPrice.toLocaleString()} · data current.`,
        lastUpdatedAt: ts,
        detail: stale ? "Stale market data can skew committee and risk gates." : null,
        affectsAnalyze: stale,
        affectsTrade: stale,
        affectsLearn: false,
      }),
    );
  }

  // binance testnet connected
  const connected = Boolean(binanceStatus?.connected);
  const configured = Boolean(binanceStatus?.configured);
  checks.push(
    check({
      id: "binance_testnet_connected",
      label: "Binance testnet connected",
      status: connected ? "OK" : configured ? "WARNING" : "WARNING",
      message: connected
        ? "Testnet API connected — execution previews available."
        : configured
          ? `Testnet configured but disconnected${binanceStatus?.error ? `: ${binanceStatus.error}` : "."}`
          : "Testnet not configured — paper-only analysis.",
      lastUpdatedAt: generatedAt,
      detail: connected ? null : "Trades and testnet learning require a live testnet connection.",
      affectsAnalyze: false,
      affectsTrade: !connected,
      affectsLearn: !connected,
    }),
  );

  // position monitor healthy
  if (!monitorReliability) {
    checks.push(
      check({
        id: "position_monitor_healthy",
        label: "Position monitor healthy",
        status: "WARNING",
        message: "Monitor reliability snapshot unavailable.",
        lastUpdatedAt: null,
        affectsAnalyze: false,
        affectsTrade: true,
        affectsLearn: false,
      }),
    );
  } else {
    const monitorStatus =
      monitorReliability.health === "BLOCKED"
        ? "BLOCKED"
        : monitorReliability.health === "WARNING"
          ? "WARNING"
          : "OK";
    checks.push(
      check({
        id: "position_monitor_healthy",
        label: "Position monitor healthy",
        status: monitorStatus,
        message:
          monitorReliability.currentIssue ??
          (monitorStatus === "OK"
            ? "Monitor heartbeat healthy."
            : `${monitorReliability.issues.length} monitor issue(s).`),
        lastUpdatedAt: monitorReliability.lastUpdatedAt,
        detail: monitorReliability.recoveryAction,
        affectsAnalyze: monitorReliability.blocksNewEntries,
        affectsTrade: monitorReliability.blocksNewEntries || monitorReliability.positionStateUncertain,
        affectsLearn: false,
      }),
    );
  }

  // decision log writable
  if (!journalProbe.ok) {
    checks.push(
      check({
        id: "decision_log_writable",
        label: "Decision log writable",
        status: "BLOCKED",
        message: journalProbe.error ?? "Journal storage not writable.",
        lastUpdatedAt: null,
        detail: journalProbe.path,
        affectsAnalyze: true,
        affectsTrade: true,
        affectsLearn: true,
      }),
    );
  } else {
    checks.push(
      check({
        id: "decision_log_writable",
        label: "Decision log writable",
        status: "OK",
        message: `${entries.length} decision log entries · storage writable.`,
        lastUpdatedAt: latestDecision?.timestamp ?? null,
        detail: journalProbe.path,
        affectsAnalyze: false,
        affectsTrade: false,
        affectsLearn: false,
      }),
    );
  }

  // journal writable (monitor journal)
  const lastJournalEvent = monitorJournal[0] ?? null;
  if (!journalProbe.ok) {
    checks.push(
      check({
        id: "journal_writable",
        label: "Journal writable",
        status: "BLOCKED",
        message: "Monitor journal storage not writable.",
        lastUpdatedAt: lastJournalEvent?.timestamp ?? null,
        affectsAnalyze: true,
        affectsTrade: true,
        affectsLearn: true,
      }),
    );
  } else if (monitorJournal.length === 0) {
    checks.push(
      check({
        id: "journal_writable",
        label: "Journal writable",
        status: "WARNING",
        message: "Monitor journal empty — no trade lifecycle events yet.",
        lastUpdatedAt: null,
        detail: journalProbe.path,
        affectsAnalyze: false,
        affectsTrade: false,
        affectsLearn: false,
      }),
    );
  } else {
    checks.push(
      check({
        id: "journal_writable",
        label: "Journal writable",
        status: "OK",
        message: `${monitorJournal.length} monitor journal events · storage writable.`,
        lastUpdatedAt: lastJournalEvent?.timestamp ?? null,
        detail: journalProbe.path,
        affectsAnalyze: false,
        affectsTrade: false,
        affectsLearn: false,
      }),
    );
  }

  // mission snapshot updating
  const missionAgeMin = ageMinutes(mission?.lastUpdatedAt);
  const missionStale = missionAgeMin != null && missionAgeMin * 60_000 > MISSION_STALE_MS;
  checks.push(
    check({
      id: "mission_snapshot_updating",
      label: "Mission snapshot updating",
      status: !mission
        ? "BLOCKED"
        : missionStale
          ? "WARNING"
          : "OK",
      message: !mission
        ? "Mission snapshot failed to build."
        : missionStale
          ? `Last mission update ${Math.round(missionAgeMin!)}m ago.`
          : `Mission ${mission.progressPct}% · snapshot fresh.`,
      lastUpdatedAt: mission?.lastUpdatedAt ?? null,
      affectsAnalyze: !mission,
      affectsTrade: !mission,
      affectsLearn: !mission,
    }),
  );

  // strategy registry readable
  try {
    const registry = buildStrategyRegistry({ entries, orders, riskProfile: "balanced" });
    checks.push(
      check({
        id: "strategy_registry_readable",
        label: "Strategy registry readable",
        status: "OK",
        message: `${registry.strategies.length} strategies loaded for analyze payload.`,
        lastUpdatedAt: generatedAt,
        affectsAnalyze: false,
        affectsTrade: false,
        affectsLearn: false,
      }),
    );
  } catch (error) {
    checks.push(
      check({
        id: "strategy_registry_readable",
        label: "Strategy registry readable",
        status: "BLOCKED",
        message: error instanceof Error ? error.message : "Strategy registry failed.",
        lastUpdatedAt: null,
        affectsAnalyze: true,
        affectsTrade: false,
        affectsLearn: false,
      }),
    );
  }

  // governance readable
  try {
    const governanceState = loadGovernanceState();
    const governancePayload = buildGovernancePayloadForAnalyze({
      entries,
      orders,
      riskProfile: "balanced",
    });
    const paused = governanceState.pauseAnalysis || governancePayload.pauseAnalysis;
    checks.push(
      check({
        id: "governance_readable",
        label: "Governance readable",
        status: paused ? "WARNING" : "OK",
        message: paused
          ? "Governance pause active — analysis may be constrained."
          : governancePayload.safeMode
            ? "Safe mode on — advisory constraints apply."
            : "Governance state readable · no pause.",
        lastUpdatedAt: generatedAt,
        detail: governancePayload.hardRules?.locked
          ? governancePayload.hardRules.messages.join("; ")
          : null,
        affectsAnalyze: paused || Boolean(governancePayload.hardRules?.locked),
        affectsTrade: Boolean(governancePayload.hardRules?.locked),
        affectsLearn: false,
      }),
    );
  } catch (error) {
    checks.push(
      check({
        id: "governance_readable",
        label: "Governance readable",
        status: "BLOCKED",
        message: error instanceof Error ? error.message : "Governance load failed.",
        lastUpdatedAt: null,
        affectsAnalyze: true,
        affectsTrade: true,
        affectsLearn: false,
      }),
    );
  }

  // kill switch readable
  try {
    const kill = evaluateKillSwitch({ entries, orders, riskProfile: "balanced" });
    checks.push(
      check({
        id: "kill_switch_readable",
        label: "Kill switch readable",
        status: kill.tradingPaused ? "BLOCKED" : "OK",
        message: kill.tradingPaused
          ? kill.messages[0] ?? "Kill switch active — trading paused."
          : "Kill switch readable · not triggered.",
        lastUpdatedAt: generatedAt,
        detail: kill.tradingPaused ? kill.messages.join("; ") : null,
        affectsAnalyze: kill.tradingPaused,
        affectsTrade: kill.tradingPaused,
        affectsLearn: false,
      }),
    );
  } catch (error) {
    checks.push(
      check({
        id: "kill_switch_readable",
        label: "Kill switch readable",
        status: "BLOCKED",
        message: error instanceof Error ? error.message : "Kill switch evaluation failed.",
        lastUpdatedAt: null,
        affectsAnalyze: true,
        affectsTrade: true,
        affectsLearn: false,
      }),
    );
  }

  // learning queue writable
  if (!journalProbe.ok) {
    checks.push(
      check({
        id: "learning_queue_writable",
        label: "Learning queue writable",
        status: "BLOCKED",
        message: "Learning records storage not writable.",
        lastUpdatedAt: null,
        affectsAnalyze: false,
        affectsTrade: false,
        affectsLearn: true,
      }),
    );
  } else {
    const pending = learningRecords.filter(
      (r) => r.status === "PENDING_REVIEW" || r.status === "REFLECTION_READY",
    ).length;
    checks.push(
      check({
        id: "learning_queue_writable",
        label: "Learning queue writable",
        status: "OK",
        message: `${learningRecords.length} learning records · ${pending} pending review.`,
        lastUpdatedAt: learningRecords[0]?.createdAt ?? null,
        detail: journalProbe.path,
        affectsAnalyze: false,
        affectsTrade: false,
        affectsLearn: false,
      }),
    );
  }

  // reports updating
  const reportAt = state.latestResultAt ?? latest?.generatedAt ?? null;
  const reportAgeMin = ageMinutes(reportAt);
  const reportsStale = reportAgeMin != null && reportAgeMin * 60_000 > REPORTS_STALE_MS;
  checks.push(
    check({
      id: "reports_updating",
      label: "Reports updating",
      status: !reportAt ? "WARNING" : reportsStale ? "WARNING" : "OK",
      message: !reportAt
        ? "No central analysis run yet — run Start AI on Dashboard."
        : reportsStale
          ? `Last analysis ${Math.round(reportAgeMin! / 60)}h ago.`
          : `Latest analysis ${new Date(reportAt).toLocaleString()}.`,
      lastUpdatedAt: reportAt,
      affectsAnalyze: false,
      affectsTrade: false,
      affectsLearn: false,
    }),
  );

  // no orphan records
  const orphanCount = orphanReport.orphanMvps.length;
  checks.push(
    check({
      id: "no_orphan_records",
      label: "No orphan records",
      status: orphanReport.allPassed ? "OK" : "WARNING",
      message: orphanReport.allPassed
        ? `All ${orphanReport.results.length} registered MVPs wired.`
        : `${orphanCount} MVP(s) fail no-orphan wiring checks.`,
      lastUpdatedAt: orphanReport.validatedAt,
      detail: orphanReport.allPassed
        ? null
        : orphanReport.results
            .filter((r) => !r.passed)
            .slice(0, 3)
            .map((r) => `MVP ${r.mvpId}: ${r.failures[0] ?? "wiring gap"}`)
            .join(" · "),
      affectsAnalyze: false,
      affectsTrade: false,
      affectsLearn: false,
    }),
  );

  // no duplicate source of truth
  const journalHeadId = latestDecision?.id ?? null;
  const stateDecisionId = state.latestDecisionLogId;
  const missionDecisionId = mission?.latestDecisionLogId ?? null;
  const mismatches: string[] = [];
  if (stateDecisionId && journalHeadId && stateDecisionId !== journalHeadId) {
    mismatches.push("central state vs decision log head");
  }
  if (missionDecisionId && journalHeadId && missionDecisionId !== journalHeadId) {
    mismatches.push("mission snapshot vs decision log head");
  }
  if (state.latestRunId && latest?.runId && state.latestRunId !== latest.runId) {
    mismatches.push("central state vs latest result runId");
  }
  checks.push(
    check({
      id: "no_duplicate_source_of_truth",
      label: "No duplicate source of truth",
      status: mismatches.length > 0 ? "WARNING" : "OK",
      message:
        mismatches.length > 0
          ? `Source drift: ${mismatches.join(", ")}.`
          : "Central engine, mission snapshot, and decision log aligned.",
      lastUpdatedAt: state.lastUpdatedAt,
      detail:
        mismatches.length > 0
          ? `state=${stateDecisionId ?? "—"} · journal=${journalHeadId ?? "—"} · mission=${missionDecisionId ?? "—"}`
          : null,
      affectsAnalyze: mismatches.length > 0,
      affectsTrade: mismatches.length > 0,
      affectsLearn: mismatches.length > 0,
    }),
  );

  const sorted = sortEngineHealthChecks(checks);
  const { summary, summaryLabel } = resolveEngineHealthSummary(sorted);

  return {
    mvp: ANALYSIS_ENGINE_HEALTH_MVP,
    label: ANALYSIS_ENGINE_HEALTH_LABEL,
    summary,
    summaryLabel,
    generatedAt,
    checks: sorted,
    capabilities: resolveEngineHealthCapabilities(sorted),
  };
}
