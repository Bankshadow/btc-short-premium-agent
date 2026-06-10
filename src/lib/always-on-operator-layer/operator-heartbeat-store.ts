import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import type { OperatorLayerHeartbeat } from "./types";

const STORE_FILE = "operator-layer-heartbeat.json";

function emptyHeartbeat(): OperatorLayerHeartbeat {
  return {
    lastTickAt: null,
    lastSuccessfulTickAt: null,
    tickCount: 0,
    lastMarketRefreshAt: null,
    lastPositionRefreshAt: null,
    lastPnlUpdateAt: null,
    lastRiskCheckAt: null,
    lastDailyReportAt: null,
    lastTelegramNotifyAt: null,
    lastAlertFingerprint: null,
    updatedAt: new Date().toISOString(),
  };
}

export async function loadOperatorLayerHeartbeat(): Promise<OperatorLayerHeartbeat> {
  const parsed = await readCronJsonFile<OperatorLayerHeartbeat>(STORE_FILE, emptyHeartbeat());
  return parsed && typeof parsed === "object" ? { ...emptyHeartbeat(), ...parsed } : emptyHeartbeat();
}

export async function patchOperatorLayerHeartbeat(
  patch: Partial<OperatorLayerHeartbeat>,
): Promise<OperatorLayerHeartbeat> {
  const current = await loadOperatorLayerHeartbeat();
  const next: OperatorLayerHeartbeat = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await writeCronJsonFile(STORE_FILE, next);
  return next;
}
