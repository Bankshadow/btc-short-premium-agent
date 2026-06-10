import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import type { MonitorHeartbeat } from "./types";

const HEARTBEAT_FILE = "binance-monitor-heartbeat.json";

export function emptyMonitorHeartbeat(): MonitorHeartbeat {
  return {
    lastMonitorRunAt: null,
    lastPositionRefreshAt: null,
    lastCloseCheckAt: null,
    lastJournalWriteAt: null,
    lastRecoveryAt: null,
    lastRunId: null,
    updatedAt: new Date().toISOString(),
  };
}

export async function loadMonitorHeartbeat(): Promise<MonitorHeartbeat> {
  const parsed = await readCronJsonFile<MonitorHeartbeat>(HEARTBEAT_FILE, emptyMonitorHeartbeat());
  return parsed && typeof parsed === "object" ? { ...emptyMonitorHeartbeat(), ...parsed } : emptyMonitorHeartbeat();
}

export async function patchMonitorHeartbeat(
  patch: Partial<MonitorHeartbeat>,
): Promise<MonitorHeartbeat> {
  const current = await loadMonitorHeartbeat();
  const next: MonitorHeartbeat = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await writeCronJsonFile(HEARTBEAT_FILE, next);
  return next;
}
