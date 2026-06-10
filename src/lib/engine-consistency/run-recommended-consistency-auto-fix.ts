import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import { getBinanceStatus, getPositions } from "@/lib/exchange/binance/binance-futures-testnet";
import { loadBinanceConfig } from "@/lib/exchange/binance/binance-config";
import { reconcileBinancePositions } from "@/lib/exchange/binance/binance-position-monitor";
import { loadServerBinanceTestnetJournal } from "@/lib/exchange/binance/binance-testnet-journal-server";
import { loadServerAnalysisJournal } from "@/lib/journal/journal-server-store";
import { readMissionSnapshotCache } from "@/lib/mission-flow/snapshot-cache";
import {
  buildClosedTradesFromJournal,
} from "@/lib/testnet-monitor/build-testnet-monitor-snapshot";
import { loadLearningRecordsServer } from "@/lib/testnet-monitor/learning-records-server";
import { loadMonitorJournalEvents } from "@/lib/testnet-monitor/monitor-journal-server";
import { applyConsistencyAutoFix } from "./apply-consistency-auto-fix";
import type { ApplyConsistencyAutoFixResult } from "./apply-consistency-auto-fix";
import { buildEngineConsistencyFromTestnet } from "./build-engine-consistency-from-testnet";
import type {
  ConsistencyAutoFixId,
  ConsistencyStatus,
  EngineConsistencySnapshot,
} from "./types";

const LAST_RUN_FILE = "engine-consistency-auto-fix-last.json";
const BLOCKED_COOLDOWN_MS = 5 * 60_000;
const WARNING_COOLDOWN_MS = 15 * 60_000;

const SAFE_AUTO_FIX_ACTIONS = new Set<ConsistencyAutoFixId>([
  "journal_reconcile",
  "journal_backfill",
  "decision_log_backfill",
  "monitor_event_backfill",
  "learning_sync",
  "mission_snapshot_refresh",
]);

interface LastAutoFixRecord {
  fingerprint: string;
  appliedAt: string;
  applied: ConsistencyAutoFixId[];
  consistencyStatus: ConsistencyStatus;
}

export interface RunRecommendedConsistencyAutoFixResult {
  skipped: boolean;
  skipReason: "none_needed" | "cooldown" | "no_actions" | null;
  fingerprint: string | null;
  result: ApplyConsistencyAutoFixResult | null;
  appliedCount: number;
}

function resolveCooldownMs(status: ConsistencyStatus): number {
  if (status === "BLOCKED") return BLOCKED_COOLDOWN_MS;
  return WARNING_COOLDOWN_MS;
}

function buildActionFingerprint(actions: ConsistencyAutoFixId[]): string {
  return [...actions].sort().join(",");
}

function filterSafeActions(
  snapshot: EngineConsistencySnapshot,
): ConsistencyAutoFixId[] {
  return snapshot.autoFixActions.filter((action) => SAFE_AUTO_FIX_ACTIONS.has(action));
}

async function loadLastAutoFixRecord(): Promise<LastAutoFixRecord | null> {
  const parsed = await readCronJsonFile<LastAutoFixRecord | null>(LAST_RUN_FILE, null);
  return parsed && typeof parsed === "object" && parsed.fingerprint ? parsed : null;
}

export function shouldSkipConsistencyAutoFixCooldown(input: {
  snapshot: EngineConsistencySnapshot;
  fingerprint: string;
  lastRun: LastAutoFixRecord | null;
  nowMs?: number;
}): boolean {
  const last = input.lastRun;
  if (!last || last.fingerprint !== input.fingerprint) return false;
  const age = (input.nowMs ?? Date.now()) - Date.parse(last.appliedAt);
  return age < resolveCooldownMs(input.snapshot.consistencyStatus);
}

/** Applies recommended safe auto-fixes when consistency reports them — no manual click. */
export async function runRecommendedConsistencyAutoFixIfNeeded(
  snapshot: EngineConsistencySnapshot,
  options?: { force?: boolean },
): Promise<RunRecommendedConsistencyAutoFixResult> {
  const actions = filterSafeActions(snapshot);
  if (!snapshot.autoFixAvailable || actions.length === 0) {
    return {
      skipped: true,
      skipReason: "no_actions",
      fingerprint: null,
      result: null,
      appliedCount: 0,
    };
  }

  const fingerprint = buildActionFingerprint(actions);
  const lastRun = await loadLastAutoFixRecord();
  if (
    !options?.force &&
    shouldSkipConsistencyAutoFixCooldown({ snapshot, fingerprint, lastRun })
  ) {
    return {
      skipped: true,
      skipReason: "cooldown",
      fingerprint,
      result: null,
      appliedCount: 0,
    };
  }

  const result = await applyConsistencyAutoFix(actions);
  await writeCronJsonFile(LAST_RUN_FILE, {
    fingerprint,
    appliedAt: new Date().toISOString(),
    applied: result.applied,
    consistencyStatus: snapshot.consistencyStatus,
  });

  return {
    skipped: false,
    skipReason: null,
    fingerprint,
    result,
    appliedCount: result.applied.length,
  };
}

/** Server entry — builds consistency snapshot then runs safe auto-fix if needed. */
export async function runRecommendedConsistencyAutoFixFromAutomation(
  options?: { force?: boolean },
): Promise<RunRecommendedConsistencyAutoFixResult & { snapshot: EngineConsistencySnapshot }> {
  const snapshot = await loadServerEngineConsistencySnapshot();
  const outcome = await runRecommendedConsistencyAutoFixIfNeeded(snapshot, options);
  const nextSnapshot =
    outcome.appliedCount > 0
      ? await loadServerEngineConsistencySnapshot()
      : snapshot;
  return { ...outcome, snapshot: nextSnapshot };
}

export async function loadServerEngineConsistencySnapshot(): Promise<EngineConsistencySnapshot> {
  const config = loadBinanceConfig();
  const status = await getBinanceStatus().catch(() => null);
  const connected = Boolean(status?.connected);
  const [positions, journal, decisions, learningRecords, monitorEvents] =
    await Promise.all([
      getPositions().catch(() => []),
      loadServerBinanceTestnetJournal().catch(() => []),
      loadServerAnalysisJournal().catch(() => []),
      loadLearningRecordsServer().catch(() => []),
      loadMonitorJournalEvents().catch(() => []),
    ]);
  const closedTrades = buildClosedTradesFromJournal(journal);
  const mismatches = reconcileBinancePositions({ positions, journal }).mismatches;
  const closedNetPnl = closedTrades.reduce((sum, trade) => sum + trade.netPnl, 0);
  const dashboardNetPnl =
    readMissionSnapshotCache()?.snapshot.netPnl ?? closedNetPnl;
  void config;

  return buildEngineConsistencyFromTestnet({
    connected,
    positions,
    journal,
    positionMismatches: mismatches,
    closedTrades,
    learningRecords,
    monitorEvents,
    decisions,
    dashboardNetPnl,
  });
}
