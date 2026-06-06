import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { loadPerpPositions } from "@/lib/multi-asset/perp-paper-store";
import { loadDeskSettings } from "@/lib/desk/desk-settings";
import { loadOperatorActionQueue } from "@/lib/operator-action-queue/queue-store";
import { loadLastAutopilotRun } from "@/lib/autopilot/settings-store";
import { writeLocalBackbone } from "./adapters/local-storage";
import { writeMemoryBackbone } from "./adapters/in-memory";
import { syncBackboneToSupabase } from "./adapters/supabase";
import { buildRecordFromCycle } from "./build-record";
import type { DeskBackboneRecord, WriteDeskCycleInput } from "./types";

export type WriteDeskCycleResult = {
  ok: boolean;
  record: DeskBackboneRecord | null;
  error?: string;
  syncOk?: boolean;
};

/** Write unified backbone after each desk / autopilot cycle. */
export async function writeDeskCycle(
  cycle: WriteDeskCycleInput = {},
): Promise<WriteDeskCycleResult> {
  try {
    const record = buildRecordFromCycle(
      {
        entries: loadDecisionLog(),
        orders: loadPaperOrders(),
        perpPositions: loadPerpPositions(),
        riskProfile: loadDeskSettings().riskProfile,
        actions: loadOperatorActionQueue(),
        autopilotResult: cycle.autopilotResult ?? loadLastAutopilotRun(),
        source: cycle.source ?? "localStorage",
      },
      cycle,
    );

    const localOk = writeLocalBackbone(record);
    writeMemoryBackbone(record);

    if (!localOk) {
      const failed = {
        ...record,
        health: {
          ...record.health,
          healthy: false,
          writeBlockers: ["Backbone localStorage write failed"],
          liveModeAllowed: false,
        },
      };
      writeMemoryBackbone(failed);
      return { ok: false, record: failed, error: "Backbone localStorage write failed" };
    }

    let syncOk: boolean | undefined;
    const deskSettings = loadDeskSettings();
    if (deskSettings.syncJournalSupabase) {
      const sync = await syncBackboneToSupabase(record);
      syncOk = sync.ok;
      if (!sync.ok) {
        record.health = {
          ...record.health,
          syncStatus: "FAILED",
          writeBlockers: [
            ...record.health.writeBlockers,
            sync.error ?? "Cloud sync failed",
          ],
          healthy: false,
          liveModeAllowed: false,
        };
        writeLocalBackbone(record);
      } else {
        record.health = { ...record.health, syncStatus: "OK" };
        writeLocalBackbone(record);
      }
    }

    return { ok: record.health.healthy, record, syncOk };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backbone write failed";
    return { ok: false, record: null, error: message };
  }
}
