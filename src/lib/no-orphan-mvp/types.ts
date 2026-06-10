/** No Orphan MVP Rule — every feature must connect to the trading system. */

export const NO_ORPHAN_MVP_RULE_LABEL = "No Orphan MVP Rule";

export type MvpCheckKind =
  | "route_or_api"
  | "data_source"
  | "write_path"
  | "dashboard_visibility"
  | "reports_visibility"
  | "journal_event"
  | "risk_permission_check"
  | "decision_log_linkage"
  | "single_source_of_truth";

export interface MvpIntegrationCheck {
  kind: MvpCheckKind;
  label: string;
  /** Paths relative to repo root (btc-short-premium-agent/). At least one must exist. */
  paths: string[];
  /** When set, at least one existing path must contain this substring. */
  mustContain?: string;
  required: boolean;
}

export interface MvpIntegrationContract {
  mvpId: number;
  name: string;
  /** Trade-affecting MVPs require risk/permission checks. */
  tradeAffecting: boolean;
  missionSnapshotField?: string;
  testnetSnapshotField?: string;
  journalEventType?: string;
  checks: MvpIntegrationCheck[];
}

export interface MvpCheckResult {
  kind: MvpCheckKind;
  label: string;
  passed: boolean;
  detail: string;
  required: boolean;
}

export interface MvpValidationResult {
  mvpId: number;
  name: string;
  passed: boolean;
  orphanRisk: boolean;
  checks: MvpCheckResult[];
  failures: string[];
}

export interface NoOrphanMvpReport {
  rule: typeof NO_ORPHAN_MVP_RULE_LABEL;
  validatedAt: string;
  allPassed: boolean;
  orphanMvps: number[];
  results: MvpValidationResult[];
}

export interface PropagationCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface PropagationReport {
  scenario: string;
  passed: boolean;
  checks: PropagationCheck[];
  failures: string[];
}

/** Human-readable checklist for new MVP development. */
export const NO_ORPHAN_MVP_CHECKLIST: readonly string[] = [
  "Route or API — expose data via /api/* or app route",
  "Data source — read from journal, testnet snapshot, or mission snapshot (not hardcoded UI state)",
  "Write path — persist scores/events/recommendations to journal or cron store",
  "Dashboard visibility — badge or panel on Goal Dashboard or AI Status",
  "Reports visibility — section on /reports or testnet monitor",
  "Journal event — recordMonitorEvent with typed eventType when state changes",
  "Risk/permission check — if trade-affecting, gate through risk manager or unified testnet gate",
  "decisionLogId linkage — closed trades and decisions linked by decisionLogId",
  "Single source of truth — mission/testnet snapshot field, not duplicate parallel stores",
] as const;
