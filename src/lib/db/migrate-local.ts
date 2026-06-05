import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { LiveTradeJournalEntry } from "@/lib/live-pilot/types";
import type { GovernanceAuditEntry, DeskIncident } from "@/lib/governance/governance-types";
import type { PersistedStrategyRegistry } from "@/lib/strategy-registry/strategy-registry-store";
import type { UnifiedPortfolioSnapshot } from "@/lib/portfolio/unified-types";
import { resolveWarehouseBackend } from "./client";
import type { AnalyzeApiResponse } from "@/lib/types/market";
import {
  writeThroughAnalyzeResult,
  writeThroughCommandCenterStatus,
  writeThroughDecisionLogs,
  writeThroughGovernanceAudit,
  writeThroughIncidents,
  writeThroughLearningReports,
  writeThroughLiveTrades,
  writeThroughPaperTrades,
  writeThroughPortfolioSnapshot,
  writeThroughStrategyRegistry,
} from "./write-through";
import type { CommandCenterReport } from "@/lib/command-center/types";
import type { LocalMigrationPayload, MigrationResult } from "./types";

export async function migrateLocalStorageToWarehouse(
  payload: LocalMigrationPayload & {
    analyzePayload?: { data: AnalyzeApiResponse; entryId: string };
  },
): Promise<MigrationResult> {
  const errors: string[] = [];
  const tables: MigrationResult["tables"] = {};

  if (payload.analyzePayload) {
    const entry = (payload.decisionLogs as DecisionLogEntry[] | undefined)?.find(
      (e) => e.id === payload.analyzePayload!.entryId,
    );
    if (entry) {
      const r = await writeThroughAnalyzeResult(payload.analyzePayload.data, entry);
      tables.decision_logs = (tables.decision_logs ?? 0) + r.written;
      tables.market_snapshots = 1;
      if (!r.ok) errors.push(...r.errors);
    }
  }

  if (payload.decisionLogs?.length) {
    const r = await writeThroughDecisionLogs(
      payload.decisionLogs as DecisionLogEntry[],
    );
    tables.decision_logs = (tables.decision_logs ?? 0) + r.written;
    if (!r.ok) errors.push(...r.errors);
  }

  if (payload.paperTrades?.length) {
    const r = await writeThroughPaperTrades(payload.paperTrades as PaperOrder[]);
    tables.paper_trades = r.written;
    if (!r.ok) errors.push(...r.errors);
  }

  if (payload.liveTrades?.length) {
    const r = await writeThroughLiveTrades(
      payload.liveTrades as LiveTradeJournalEntry[],
    );
    tables.live_trades = r.written;
    if (!r.ok) errors.push(...r.errors);
  }

  if (payload.governanceAudit?.length) {
    const r = await writeThroughGovernanceAudit(
      payload.governanceAudit as GovernanceAuditEntry[],
    );
    tables.governance_audit_logs = r.written;
    if (!r.ok) errors.push(...r.errors);
  }

  if (payload.incidents?.length) {
    const r = await writeThroughIncidents(payload.incidents as DeskIncident[]);
    tables.incidents = r.written;
    if (!r.ok) errors.push(...r.errors);
  }

  if (payload.strategyRegistry) {
    const r = await writeThroughStrategyRegistry(
      payload.strategyRegistry as PersistedStrategyRegistry,
    );
    tables.strategy_versions = r.written;
    if (!r.ok) errors.push(...r.errors);
  }

  if (payload.portfolioSnapshot) {
    const r = await writeThroughPortfolioSnapshot(
      payload.portfolioSnapshot as UnifiedPortfolioSnapshot,
    );
    tables.portfolio_snapshots = r.written;
    if (!r.ok) errors.push(...r.errors);
  }

  if (payload.learningReports?.length) {
    const r = await writeThroughLearningReports(
      payload.learningReports as Record<string, unknown>[],
    );
    tables.learning_reports = r.written;
    if (!r.ok) errors.push(...r.errors);
  }

  if (payload.commandCenterStatus) {
    const r = await writeThroughCommandCenterStatus(
      payload.commandCenterStatus as CommandCenterReport,
    );
    tables.command_center_status = r.written;
    if (!r.ok) errors.push(...r.errors);
  }

  return {
    migratedAt: new Date().toISOString(),
    backend: resolveWarehouseBackend(),
    tables,
    errors,
    localStoragePreserved: true,
  };
}
