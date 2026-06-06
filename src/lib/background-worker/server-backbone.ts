import { getCronDataDir } from "@/lib/cron/cron-config";
import { buildRecordFromCycle } from "@/lib/data-backbone/build-record";
import { evaluateBackboneHealth } from "@/lib/data-backbone/health";
import type { DeskBackboneHealth, DeskBackboneRecord } from "@/lib/data-backbone/types";
import { WORKER_BACKBONE_FILE } from "./config";
import type { WorkerRunInput } from "./types";
import type { AutopilotRunResult } from "@/lib/autopilot/types";
import fs from "fs/promises";
import path from "path";

function backbonePath(): string {
  return path.join(getCronDataDir(), WORKER_BACKBONE_FILE);
}

export async function loadServerBackboneRecord(): Promise<DeskBackboneRecord | null> {
  try {
    const raw = await fs.readFile(backbonePath(), "utf8");
    return JSON.parse(raw) as DeskBackboneRecord;
  } catch {
    return null;
  }
}

export async function writeServerBackboneRecord(
  record: DeskBackboneRecord,
): Promise<void> {
  const filePath = backbonePath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(record, null, 2), "utf8");
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
