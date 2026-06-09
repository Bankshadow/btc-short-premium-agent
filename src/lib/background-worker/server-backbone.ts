import { readCronJsonFile, writeCronJsonFile } from "@/lib/cron/cron-config";
import { buildRecordFromCycle } from "@/lib/data-backbone/build-record";
import type { DeskBackboneHealth, DeskBackboneRecord } from "@/lib/data-backbone/types";
import { WORKER_BACKBONE_FILE } from "./config";
import type { WorkerRunInput } from "./types";
import type { AutopilotRunResult } from "@/lib/autopilot/types";

export async function loadServerBackboneRecord(): Promise<DeskBackboneRecord | null> {
  return readCronJsonFile(WORKER_BACKBONE_FILE, null);
}

export async function writeServerBackboneRecord(
  record: DeskBackboneRecord,
): Promise<void> {
  await writeCronJsonFile(WORKER_BACKBONE_FILE, record);
}

export function buildServerBackboneFromInput(input: {
  entries: WorkerRunInput["entries"];
  orders: WorkerRunInput["orders"];
  perpPositions: WorkerRunInput["perpPositions"];
  riskProfile: WorkerRunInput["riskProfile"];
  autopilotResult: AutopilotRunResult | null;
}): DeskBackboneRecord {
  return buildRecordFromCycle(
    {
      entries: input.entries ?? [],
      orders: input.orders ?? [],
      perpPositions: input.perpPositions ?? [],
      riskProfile: input.riskProfile ?? "balanced",
      actions: input.autopilotResult?.actionsCreated ?? [],
      autopilotResult: input.autopilotResult,
      source: "hybrid",
    },
    { source: "hybrid" },
  );
}

export async function evaluateServerBackboneHealth(): Promise<{
  healthy: boolean;
  health: DeskBackboneHealth | null;
  record: DeskBackboneRecord | null;
}> {
  const record = await loadServerBackboneRecord();
  if (!record) {
    return {
      healthy: false,
      health: null,
      record: null,
    };
  }
  return {
    healthy: record.health.healthy,
    health: record.health,
    record,
  };
}

export function isBackboneBlockingRun(health: DeskBackboneHealth | null): boolean {
  if (!health) return false;
  return !health.healthy && health.writeBlockers.length > 0;
}
