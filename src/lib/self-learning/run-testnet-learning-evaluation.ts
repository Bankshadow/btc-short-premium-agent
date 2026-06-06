import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { TestnetLearningRecord } from "@/lib/testnet-monitor/types";
import { evaluateClosedTrade } from "./evaluate-entry";
import { appendServerEvaluationResult, loadServerEvaluationResults } from "./evaluation-server-store";
import type { TradeEvaluationResult } from "./types";

function enrichEntryForEvaluation(
  entry: DecisionLogEntry,
  record: TestnetLearningRecord,
): DecisionLogEntry {
  const win = record.result === "WIN";
  return {
    ...entry,
    outcomeStatus: "RESOLVED",
    paperPnl: record.netPnl,
    resolution: {
      btcPriceAfter: 0,
      tradeWouldWin: win ? true : record.result === "LOSS" ? false : null,
      notes: `Testnet learning eval · ${record.symbol}`,
      resolvedAt: record.updatedAt,
    },
  };
}

export async function runTestnetLearningEvaluation(input: {
  records: TestnetLearningRecord[];
  entries: DecisionLogEntry[];
  limit?: number;
}): Promise<{
  evaluated: number;
  skipped: number;
  topAgent: string | null;
  results: TradeEvaluationResult[];
}> {
  const learned = input.records.filter(
    (r) => r.status === "LEARNED" && r.includeInLearning && r.decisionLogId,
  );
  const entryById = new Map(input.entries.map((e) => [e.id, e]));
  const existing = await loadServerEvaluationResults();
  const evaluatedIds = new Set(
    existing.filter((r) => r.source === "testnet_close").map((r) => r.decisionLogId),
  );

  const results: TradeEvaluationResult[] = [];
  let skipped = 0;

  for (const record of learned.slice(0, input.limit ?? 20)) {
    if (!record.decisionLogId || evaluatedIds.has(record.decisionLogId)) {
      skipped += 1;
      continue;
    }
    const entry = entryById.get(record.decisionLogId);
    if (!entry) {
      skipped += 1;
      continue;
    }
    const enriched = enrichEntryForEvaluation(entry, record);
    const result = evaluateClosedTrade({
      entry: enriched,
      source: "testnet_close",
      pnlOverride: record.netPnl,
    });
    if (!result) {
      skipped += 1;
      continue;
    }
    await appendServerEvaluationResult(result);
    results.push(result);
    evaluatedIds.add(record.decisionLogId);
  }

  const all = await loadServerEvaluationResults();
  const agentHits = new Map<string, number>();
  for (const r of all) {
    for (const a of r.agentEvaluations) {
      if (a.helpingScore >= 0.5) {
        agentHits.set(a.agentName, (agentHits.get(a.agentName) ?? 0) + 1);
      }
    }
  }
  const topAgent =
    [...agentHits.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  return {
    evaluated: results.length,
    skipped,
    topAgent,
    results,
  };
}
