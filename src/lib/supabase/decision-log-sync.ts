import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import {
  getSupabaseAdmin,
  isSupabaseConfigured,
  SupabaseConfigError,
} from "./client";

export class SupabaseJournalSyncError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseJournalSyncError";
  }
}

function rowFromEntry(entry: DecisionLogEntry) {
  return {
    client_id: entry.id,
    logged_at: entry.timestamp,
    btc_price: entry.btcPrice,
    market_regime: entry.marketRegime,
    final_verdict: entry.finalVerdict,
    risk_veto: entry.riskVeto,
    top_reasons: entry.topReasons,
    action_plan: entry.actionPlan,
    outcome_status: entry.outcomeStatus,
    paper_pnl: entry.paperPnl,
    reflection: entry.reflection,
    resolution: entry.resolution ?? null,
    replay_snapshot: entry.replaySnapshot ?? null,
    agent_outputs: entry.agentOutputs,
    updated_at: new Date().toISOString(),
  };
}

function entryFromRow(row: Record<string, unknown>): DecisionLogEntry {
  return {
    id: String(row.client_id ?? row.id),
    timestamp: String(row.logged_at ?? new Date().toISOString()),
    btcPrice: Number(row.btc_price ?? 0),
    marketRegime: String(row.market_regime ?? "Unknown"),
    agentOutputs: Array.isArray(row.agent_outputs)
      ? (row.agent_outputs as DecisionLogEntry["agentOutputs"])
      : [],
    finalVerdict: String(row.final_verdict ?? "WAIT") as DecisionLogEntry["finalVerdict"],
    riskVeto: Boolean(row.risk_veto),
    topReasons: Array.isArray(row.top_reasons)
      ? (row.top_reasons as string[])
      : [],
    actionPlan: String(row.action_plan ?? ""),
    outcomeStatus: String(row.outcome_status ?? "PENDING") as DecisionLogEntry["outcomeStatus"],
    paperPnl: row.paper_pnl != null ? Number(row.paper_pnl) : null,
    reflection:
      row.reflection && typeof row.reflection === "object"
        ? (row.reflection as DecisionLogEntry["reflection"])
        : null,
    resolution:
      row.resolution && typeof row.resolution === "object"
        ? (row.resolution as DecisionLogEntry["resolution"])
        : undefined,
    replaySnapshot:
      row.replay_snapshot && typeof row.replay_snapshot === "object"
        ? (row.replay_snapshot as DecisionLogEntry["replaySnapshot"])
        : null,
  };
}

export async function upsertDecisionLogToSupabase(
  entries: DecisionLogEntry[],
): Promise<number> {
  if (!isSupabaseConfigured()) {
    throw new SupabaseConfigError("Supabase not configured.");
  }
  if (entries.length === 0) return 0;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("decision_log_entries")
    .upsert(entries.map(rowFromEntry), { onConflict: "client_id" });

  if (error) throw new SupabaseJournalSyncError(error.message);
  return entries.length;
}

export async function fetchDecisionLogFromSupabase(): Promise<DecisionLogEntry[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("decision_log_entries")
    .select("*")
    .order("logged_at", { ascending: false })
    .limit(100);

  if (error) throw new SupabaseJournalSyncError(error.message);
  if (!data) return [];

  return data.map((row) => entryFromRow(row as Record<string, unknown>));
}
