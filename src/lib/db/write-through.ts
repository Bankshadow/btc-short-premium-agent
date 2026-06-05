import type { AnalyzeApiResponse } from "@/lib/types/market";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { LiveTradeJournalEntry } from "@/lib/live-pilot/types";
import type { GovernanceAuditEntry, DeskIncident } from "@/lib/governance/governance-types";
import type { PersistedStrategyRegistry } from "@/lib/strategy-registry/strategy-registry-store";
import type { UnifiedPortfolioSnapshot } from "@/lib/portfolio/unified-types";
import type { CommandCenterReport } from "@/lib/command-center/types";
import type { RealTimeRiskEvent } from "@/lib/real-time-risk/types";
import { upsertWarehouseRows } from "./repositories/warehouse-repository";
import { recordWriteResult } from "./write-health";
import type { WarehouseRow, WriteResult } from "./types";

async function commit(results: WriteResult[]): Promise<{
  ok: boolean;
  written: number;
  errors: string[];
}> {
  let written = 0;
  const errors: string[] = [];
  for (const r of results) {
    await recordWriteResult(r);
    if (r.ok) written += r.written;
    else if (r.error) errors.push(`${r.table}: ${r.error}`);
  }
  return { ok: errors.length === 0, written, errors };
}

export async function writeThroughDecisionLogs(
  entries: DecisionLogEntry[],
): Promise<{ ok: boolean; written: number; errors: string[] }> {
  const rows: WarehouseRow[] = entries.map((e) => ({
    client_id: e.id,
    recorded_at: e.timestamp,
    payload: e as unknown as Record<string, unknown>,
  }));
  const agentRows: WarehouseRow[] = entries.flatMap((e) =>
    e.agentOutputs.map((a, idx) => ({
      client_id: `${e.id}:${a.agentName}:${idx}`,
      decision_log_id: e.id,
      agent_name: a.agentName,
      recorded_at: e.timestamp,
      payload: a as unknown as Record<string, unknown>,
    })),
  );
  return commit([
    await upsertWarehouseRows("decision_logs", rows),
    await upsertWarehouseRows("agent_outputs", agentRows),
  ]);
}

export async function writeThroughAnalyzeResult(
  data: AnalyzeApiResponse,
  entry: DecisionLogEntry,
): Promise<{ ok: boolean; written: number; errors: string[] }> {
  const snapshotId = `market-${entry.id}`;
  const marketRow: WarehouseRow = {
    client_id: snapshotId,
    recorded_at: entry.timestamp,
    payload: {
      decisionLogId: entry.id,
      market: data.step1_marketSnapshot,
      verdict: data.step5_verdict,
      dataTrust: data.dataTrust ?? null,
    },
  };
  const logResult = await writeThroughDecisionLogs([entry]);
  const marketResult = await upsertWarehouseRows("market_snapshots", [marketRow]);
  await recordWriteResult(marketResult);
  return {
    ok: logResult.ok && marketResult.ok,
    written: logResult.written + (marketResult.written ?? 0),
    errors: [...logResult.errors, ...(marketResult.error ? [marketResult.error] : [])],
  };
}

export async function writeThroughPaperTrades(
  orders: PaperOrder[],
): Promise<{ ok: boolean; written: number; errors: string[] }> {
  const rows: WarehouseRow[] = orders.map((o) => ({
    client_id: o.id,
    recorded_at: o.openedAt ?? new Date().toISOString(),
    status: o.status,
    payload: o as unknown as Record<string, unknown>,
  }));
  return commit([await upsertWarehouseRows("paper_trades", rows)]);
}

export async function writeThroughLiveTrades(
  trades: LiveTradeJournalEntry[],
): Promise<{ ok: boolean; written: number; errors: string[] }> {
  const rows: WarehouseRow[] = trades.map((t) => ({
    client_id: t.liveTradeId,
    recorded_at: t.createdAt,
    status: t.status,
    payload: t as unknown as Record<string, unknown>,
  }));
  const orderRows: WarehouseRow[] = trades
    .filter((t) => t.exchangeOrderId)
    .map((t) => ({
      client_id: `order-${t.exchangeOrderId}`,
      live_trade_id: t.liveTradeId,
      recorded_at: t.executedAt ?? t.createdAt,
      payload: {
        exchangeOrderId: t.exchangeOrderId,
        symbol: t.symbol,
        side: t.side,
        status: t.status,
      },
    }));
  const eventRows: WarehouseRow[] = trades.map((t) => ({
    client_id: `evt-${t.liveTradeId}-${t.status}`,
    event_type: `live_trade_${t.status.toLowerCase()}`,
    recorded_at: t.executedAt ?? t.createdAt,
    payload: t as unknown as Record<string, unknown>,
  }));
  return commit([
    await upsertWarehouseRows("live_trades", rows),
    await upsertWarehouseRows("live_orders", orderRows),
    await upsertWarehouseRows("execution_events", eventRows),
  ]);
}

export async function writeThroughGovernanceAudit(
  entries: GovernanceAuditEntry[],
): Promise<{ ok: boolean; written: number; errors: string[] }> {
  const rows: WarehouseRow[] = entries.map((e) => ({
    client_id: e.id,
    recorded_at: e.timestamp,
    payload: e as unknown as Record<string, unknown>,
  }));
  return commit([await upsertWarehouseRows("governance_audit_logs", rows)]);
}

export async function writeThroughIncidents(
  incidents: DeskIncident[],
): Promise<{ ok: boolean; written: number; errors: string[] }> {
  const rows: WarehouseRow[] = incidents.map((i) => ({
    client_id: i.id,
    recorded_at: i.createdAt,
    severity: i.severity,
    status: i.status,
    payload: i as unknown as Record<string, unknown>,
  }));
  return commit([await upsertWarehouseRows("incidents", rows)]);
}

export async function writeThroughStrategyRegistry(
  registry: PersistedStrategyRegistry,
): Promise<{ ok: boolean; written: number; errors: string[] }> {
  const rows: WarehouseRow[] = [];
  for (const [strategyId, history] of Object.entries(registry.versionHistory ?? {})) {
    for (const v of history ?? []) {
      rows.push({
        client_id: `${strategyId}:${v.version}:${v.changedAt}`,
        strategy_id: strategyId,
        recorded_at: v.changedAt,
        payload: { ...v, override: registry.overrides[strategyId as keyof typeof registry.overrides] },
      });
    }
  }
  if (rows.length === 0) {
    return { ok: true, written: 0, errors: [] };
  }
  return commit([await upsertWarehouseRows("strategy_versions", rows)]);
}

export async function writeThroughPortfolioSnapshot(
  snapshot: UnifiedPortfolioSnapshot,
): Promise<{ ok: boolean; written: number; errors: string[] }> {
  const row: WarehouseRow = {
    client_id: `portfolio-${snapshot.generatedAt}`,
    recorded_at: snapshot.generatedAt,
    payload: snapshot as unknown as Record<string, unknown>,
  };
  return commit([await upsertWarehouseRows("portfolio_snapshots", [row])]);
}

export async function writeThroughCommandCenterStatus(
  report: CommandCenterReport,
): Promise<{ ok: boolean; written: number; errors: string[] }> {
  const row: WarehouseRow = {
    client_id: `cc-${report.generatedAt}`,
    recorded_at: report.generatedAt,
    status: report.status,
    payload: report as unknown as Record<string, unknown>,
  };
  const riskRow: WarehouseRow = {
    client_id: `risk-cc-${report.generatedAt}`,
    event_type: "command_center_status",
    recorded_at: report.generatedAt,
    payload: {
      status: report.status,
      blockers: report.blockers,
      cautions: report.cautions,
    },
  };
  return commit([
    await upsertWarehouseRows("command_center_status", [row]),
    await upsertWarehouseRows("risk_events", [riskRow]),
  ]);
}

export async function writeThroughRiskEvent(
  event: RealTimeRiskEvent,
): Promise<{ ok: boolean; written: number; errors: string[] }> {
  const row: WarehouseRow = {
    client_id: event.eventId,
    event_type: event.eventType,
    recorded_at: event.recordedAt,
    severity: event.severity,
    payload: event as unknown as Record<string, unknown>,
  };
  return commit([await upsertWarehouseRows("risk_events", [row])]);
}

export async function writeThroughLearningReports(
  reports: Record<string, unknown>[],
): Promise<{ ok: boolean; written: number; errors: string[] }> {
  const rows: WarehouseRow[] = reports.map((r, idx) => ({
    client_id: String(r.id ?? `learning-${Date.now()}-${idx}`),
    recorded_at: String(r.generatedAt ?? r.evaluatedAt ?? new Date().toISOString()),
    payload: r,
  }));
  return commit([await upsertWarehouseRows("learning_reports", rows)]);
}
