import { loadDecisionLog } from "@/lib/journal/decision-log";
import { loadPaperOrders } from "@/lib/paper/paper-orders";
import { loadPerpPositions } from "@/lib/multi-asset/perp-paper-store";
import { loadDeskSettings } from "@/lib/desk/desk-settings";
import { loadOperatorActionQueue } from "@/lib/operator-action-queue/queue-store";
import { loadLastAutopilotRun } from "@/lib/autopilot/settings-store";
import { buildDeskBackboneRecord } from "../build-record";

/** Progressive migration: legacy localStorage → unified backbone record. */
export function migrateLegacyToBackbone() {
  return buildDeskBackboneRecord({
    entries: loadDecisionLog(),
    orders: loadPaperOrders(),
    perpPositions: loadPerpPositions(),
    riskProfile: loadDeskSettings().riskProfile,
    actions: loadOperatorActionQueue(),
    autopilotResult: loadLastAutopilotRun(),
    source: "localStorage",
    writeOk: true,
  });
}
