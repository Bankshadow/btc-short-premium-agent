import { isBinanceTestnetAutoExecuteEnabled } from "@/lib/exchange/binance/binance-config";
import { readCronJsonFile } from "@/lib/cron/cron-config";
import type { BinanceOrderPreview } from "@/lib/exchange/binance/binance-types";
import {
  detectMonitorIssues,
  resolveMonitorHealth,
  resolvePrimaryMonitorIssueMessage,
} from "./detect-monitor-issues";
import {
  markIssuesRecovered,
  runMonitorAutoRecovery,
} from "./auto-recover-monitor";
import { loadMonitorHeartbeat, patchMonitorHeartbeat } from "./heartbeat-store";
import type {
  MonitorReliabilityBuildInput,
  MonitorReliabilitySnapshot,
} from "./types";
import {
  MONITOR_RELIABILITY_LABEL,
  MONITOR_RELIABILITY_MVP,
} from "./types";

const PREVIEW_CACHE_FILE = "binance-preview-cache.json";

async function loadPreviewCache(): Promise<Record<string, BinanceOrderPreview>> {
  const parsed = await readCronJsonFile<Record<string, BinanceOrderPreview>>(
    PREVIEW_CACHE_FILE,
    {},
  );
  return parsed && typeof parsed === "object" ? parsed : {};
}

export async function buildMonitorReliabilitySnapshot(
  input: MonitorReliabilityBuildInput,
): Promise<MonitorReliabilitySnapshot> {
  const autoExecuteEnabled =
    input.autoExecuteEnabled ?? isBinanceTestnetAutoExecuteEnabled();
  let journal = input.journal;
  let recoveredCount = 0;
  let incidentsCreated = 0;
  let recoveryAction: string | null = null;

  if (input.autoRecover && input.connected) {
    const recovery = await runMonitorAutoRecovery({
      journal,
      positions: input.positions,
    });
    journal = recovery.journal;
    recoveredCount = recovery.recovered.length;
    incidentsCreated = recovery.incidentsCreated;
    recoveryAction = recovery.recoveryAction;
    await patchMonitorHeartbeat({
      lastJournalWriteAt: new Date().toISOString(),
      lastRecoveryAt: new Date().toISOString(),
    });
  }

  const heartbeat = await loadMonitorHeartbeat();
  const previewCache = await loadPreviewCache();
  let issues = detectMonitorIssues({
    journal,
    positions: input.positions,
    connected: input.connected,
    autoExecuteEnabled,
    heartbeat,
    previewCache,
    currentRunId: input.runId ?? null,
  });

  if (input.autoRecover && recoveredCount > 0) {
    issues = markIssuesRecovered(issues, recoveryAction?.split(" · ") ?? []);
  }

  const positionStateUncertain = issues.some(
    (i) =>
      !i.recovered &&
      (i.kind === "position_state_uncertain" ||
        i.kind === "exchange_closed_not_journaled" ||
        i.kind === "duplicate_close_attempt"),
  );

  const unresolved = issues.filter((i) => !i.recovered);
  const health = resolveMonitorHealth(unresolved, positionStateUncertain);
  const blocksNewEntries = positionStateUncertain;

  const currentIssue =
    resolvePrimaryMonitorIssueMessage(unresolved) ??
    (health === "OK" ? null : "Monitor state needs attention.");

  return {
    mvp: MONITOR_RELIABILITY_MVP,
    label: MONITOR_RELIABILITY_LABEL,
    health,
    currentIssue,
    recoveryAction,
    blocksNewEntries,
    positionStateUncertain,
    heartbeat,
    issues,
    recoveredCount,
    incidentsCreated,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export async function recordMonitorCycleHeartbeat(input: {
  runId?: string | null;
  positionRefreshAt?: string;
  closeCheckAt?: string;
  journalWriteAt?: string;
}): Promise<void> {
  const now = new Date().toISOString();
  await patchMonitorHeartbeat({
    lastMonitorRunAt: now,
    lastRunId: input.runId ?? null,
    lastPositionRefreshAt: input.positionRefreshAt ?? now,
    lastCloseCheckAt: input.closeCheckAt ?? now,
    lastJournalWriteAt: input.journalWriteAt ?? undefined,
  });
}
