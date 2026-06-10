import { isTestnetPrimaryAutomation } from "@/lib/automation-control-plane/primary-mode";
import type {
  AnomalyFinding,
  AnomalyIncident,
  AnomalyIncidentStatus,
  AnomalySeverity,
  AnomalyType,
} from "./types";

/** Testnet-primary: advisory only — never escalate to CRITICAL. */
const TESTNET_ADVISORY_ONLY_TYPES = new Set<AnomalyType>([
  "alert_delivery_failed",
  "micro_live_readiness_blocked",
  "risk_budget_governance",
  "strategy_health_governance",
  "execution_quality_degraded",
  "automation_job_failed",
  "unexpected_open_position",
  "order_executed_no_ledger_entry",
]);

/** Never pause mission controller on testnet-primary (live stays locked). */
const NON_MISSION_PAUSING_TYPES = new Set<AnomalyType>([
  ...TESTNET_ADVISORY_ONLY_TYPES,
]);

/** Never block testnet execute/monitor on testnet-primary. */
const NON_TRADE_BLOCKING_TYPES = new Set<AnomalyType>([
  ...TESTNET_ADVISORY_ONLY_TYPES,
]);

/** Managed by central detect cycle — auto-resolve when fingerprint absent. */
export const DETECT_MANAGED_ANOMALY_TYPES = new Set<AnomalyType>([
  "exchange_disconnected",
  "order_executed_no_ledger_entry",
  "ledger_entry_no_exchange_order",
  "position_size_mismatch",
  "duplicate_order",
  "stale_market_data",
  "pnl_calculation_mismatch",
  "alert_delivery_failed",
  "automation_job_failed",
  "testnet_live_flag_mismatch",
  "unexpected_open_position",
  "close_reduce_only_failed",
  "execution_quality_degraded",
]);

/** Managed by operational reconcile — auto-resolve when runtime clears. */
export const OPERATIONAL_ANOMALY_TYPES = new Set<AnomalyType>([
  "monitor_reliability_degraded",
  "micro_live_readiness_blocked",
]);

export function isIncidentOpen(status: AnomalyIncidentStatus): boolean {
  return status === "OPEN" || status === "INVESTIGATING";
}

function isTestnetPrimary(): boolean {
  return isTestnetPrimaryAutomation();
}

/** Normalize severity at ingest — single place for testnet advisory cap. */
export function normalizeAnomalySeverity(
  anomalyType: AnomalyType,
  severity: AnomalySeverity,
): AnomalySeverity {
  if (isTestnetPrimary() && TESTNET_ADVISORY_ONLY_TYPES.has(anomalyType)) {
    return severity === "INFO" ? "INFO" : "WARNING";
  }
  return severity;
}

export function normalizeAnomalyFinding(finding: AnomalyFinding): AnomalyFinding {
  return {
    ...finding,
    severity: normalizeAnomalySeverity(finding.anomalyType, finding.severity),
  };
}

export function normalizeAnomalyIncident(incident: AnomalyIncident): AnomalyIncident {
  return {
    ...incident,
    severity: normalizeAnomalySeverity(incident.anomalyType, incident.severity),
  };
}

export function normalizeAnomalyIncidents(
  incidents: AnomalyIncident[],
): AnomalyIncident[] {
  return incidents.map(normalizeAnomalyIncident);
}

export function isTradeBlockingCriticalIncident(incident: AnomalyIncident): boolean {
  if (!isIncidentOpen(incident.status)) return false;
  if (incident.severity !== "CRITICAL") return false;
  if (isTestnetPrimary() && NON_TRADE_BLOCKING_TYPES.has(incident.anomalyType)) {
    return false;
  }
  return true;
}

export function isMissionPausingCriticalIncident(incident: AnomalyIncident): boolean {
  if (!isTradeBlockingCriticalIncident(incident)) return false;
  if (isTestnetPrimary() && NON_MISSION_PAUSING_TYPES.has(incident.anomalyType)) {
    return false;
  }
  return true;
}

export function filterTradeBlockingCriticalIncidents(
  incidents: AnomalyIncident[],
): AnomalyIncident[] {
  return incidents.filter(isTradeBlockingCriticalIncident);
}

/** @deprecated Use filterTradeBlockingCriticalIncidents */
export function filterBlockingCriticalIncidents(
  incidents: AnomalyIncident[],
): AnomalyIncident[] {
  return filterTradeBlockingCriticalIncidents(incidents);
}

export function findMissionPausingCriticalIncident(
  incidents: AnomalyIncident[],
): AnomalyIncident | undefined {
  return incidents.find(isMissionPausingCriticalIncident);
}

export function hasMissionPausingCriticalIncident(
  incidents: AnomalyIncident[],
): boolean {
  return incidents.some(isMissionPausingCriticalIncident);
}

export function hasTradeBlockingCriticalIncident(
  incidents: AnomalyIncident[],
): boolean {
  return incidents.some(isTradeBlockingCriticalIncident);
}

export interface OperationalIncidentReconcileInput {
  monitorHealthy: boolean;
  monitorMismatches: string[];
  readinessStatus: string;
}

/** Returns true when an open auto-created incident should be system-resolved. */
export function shouldAutoResolveOperationalIncident(
  incident: AnomalyIncident,
  input: OperationalIncidentReconcileInput,
): boolean {
  if (!incident.autoCreated || !isIncidentOpen(incident.status)) return false;

  switch (incident.anomalyType) {
    case "monitor_reliability_degraded":
      return input.monitorHealthy && input.monitorMismatches.length === 0;
    case "micro_live_readiness_blocked":
      return input.readinessStatus !== "BLOCKED";
    default:
      return false;
  }
}

export function shouldAutoResolveDetectIncident(
  incident: AnomalyIncident,
  activeFingerprints: Set<string>,
): boolean {
  if (!incident.autoCreated || !isIncidentOpen(incident.status)) return false;
  if (!DETECT_MANAGED_ANOMALY_TYPES.has(incident.anomalyType)) return false;
  return !activeFingerprints.has(incident.fingerprint);
}

export function buildAutoResolvePatch(
  incident: AnomalyIncident,
  note: string,
): AnomalyIncident {
  const now = new Date().toISOString();
  return {
    ...normalizeAnomalyIncident(incident),
    status: "RESOLVED",
    resolvedAt: now,
    resolvedBy: "SYSTEM",
    resolutionNote: note,
    updatedAt: now,
  };
}
