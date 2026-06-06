import { loadLedgerAnalyticsInput } from "@/lib/ledger/analytics";
import { loadOperatorActionQueue } from "@/lib/operator-action-queue/queue-store";
import { loadLastAutopilotRun } from "@/lib/autopilot/settings-store";
import {
  filterProductionEntries,
  filterProductionOrders,
} from "@/lib/journal/production-filter";
import { readLocalBackbone } from "./adapters/local-storage";
import { readMemoryBackbone } from "./adapters/in-memory";
import { migrateLegacyToBackbone } from "./adapters/migration";
import type { UnifiedLedgerSnapshot } from "@/lib/ledger/types";
import type { DeskBackboneRecord } from "./types";

/** Canonical read — all pages should use this for consistent numbers. */
export function loadDeskBackbone(): DeskBackboneRecord {
  const cached = readLocalBackbone() ?? readMemoryBackbone();
  if (cached && cached.version >= 1) {
    return cached;
  }
  return migrateLegacyToBackbone();
}

/** Raw legacy inputs for builders that still need full objects — sourced from unified ledger. */
export function loadDeskBackboneInputs(): {
  record: DeskBackboneRecord;
  entries: ReturnType<typeof loadLedgerAnalyticsInput>["entries"];
  orders: ReturnType<typeof loadLedgerAnalyticsInput>["orders"];
  productionEntries: ReturnType<typeof filterProductionEntries>;
  productionOrders: ReturnType<typeof filterProductionOrders>;
  perpPositions: ReturnType<typeof loadLedgerAnalyticsInput>["perpPositions"];
  livePilotJournal: ReturnType<typeof loadLedgerAnalyticsInput>["livePilotJournal"];
  optionsTestnetJournal: ReturnType<typeof loadLedgerAnalyticsInput>["optionsTestnetJournal"];
  ledger: UnifiedLedgerSnapshot;
  riskProfile: ReturnType<typeof loadLedgerAnalyticsInput>["riskProfile"];
  actions: ReturnType<typeof loadOperatorActionQueue>;
  autopilotResult: ReturnType<typeof loadLastAutopilotRun>;
} {
  const record = loadDeskBackbone();
  const analytics = loadLedgerAnalyticsInput();
  const { entries, orders } = analytics;
  return {
    record,
    entries,
    orders,
    productionEntries: filterProductionEntries(entries),
    productionOrders: filterProductionOrders(orders),
    perpPositions: analytics.perpPositions,
    livePilotJournal: analytics.livePilotJournal,
    optionsTestnetJournal: analytics.optionsTestnetJournal,
    ledger: analytics.ledger,
    riskProfile: analytics.riskProfile,
    actions: loadOperatorActionQueue(),
    autopilotResult: loadLastAutopilotRun(),
  };
}

export function refreshDeskBackboneFromLegacy(): DeskBackboneRecord {
  return migrateLegacyToBackbone();
}
