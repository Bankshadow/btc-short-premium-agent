import type { TestnetLearningRecord } from "@/lib/testnet-monitor/types";
import type { RecurringMistake } from "./types";

function pushMistake(
  out: RecurringMistake[],
  mistake: RecurringMistake,
): void {
  if (out.some((m) => m.kind === mistake.kind && m.message === mistake.message)) {
    return;
  }
  out.push(mistake);
}

export function detectRecurringMistakes(
  records: TestnetLearningRecord[],
): RecurringMistake[] {
  const mistakes: RecurringMistake[] = [];
  const sorted = [...records].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const missingDecision = sorted.filter((r) => !r.decisionLogId);
  if (missingDecision.length > 0) {
    pushMistake(mistakes, {
      kind: "missing_decision_link",
      severity: "WARNING",
      message: `${missingDecision.length} closed trade(s) missing decisionLogId — learning linkage incomplete.`,
      symbol: null,
      count: missingDecision.length,
    });
  }

  const bySymbol = new Map<string, TestnetLearningRecord[]>();
  for (const record of sorted) {
    const list = bySymbol.get(record.symbol) ?? [];
    list.push(record);
    bySymbol.set(record.symbol, list);
  }

  for (const [symbol, rows] of bySymbol) {
    let streak = 0;
    for (const row of rows) {
      if (row.result === "LOSS") {
        streak += 1;
        if (streak >= 2) {
          pushMistake(mistakes, {
            kind: "loss_streak",
            severity: "WARNING",
            message: `${streak} consecutive losses on ${symbol}.`,
            symbol,
            count: streak,
          });
        }
      } else {
        streak = 0;
      }
    }
  }

  const closeReasonCounts = new Map<string, number>();
  for (const record of sorted) {
    const reason = record.closeReason?.trim();
    if (!reason) continue;
    closeReasonCounts.set(reason, (closeReasonCounts.get(reason) ?? 0) + 1);
  }
  for (const [reason, count] of closeReasonCounts) {
    if (count >= 3) {
      pushMistake(mistakes, {
        kind: "repeated_close_reason",
        severity: "WARNING",
        message: `Close reason repeated ${count}×: ${reason}`,
        symbol: null,
        count,
      });
    }
    if (/stop loss/i.test(reason) && count >= 2) {
      pushMistake(mistakes, {
        kind: "stop_loss_pattern",
        severity: "WARNING",
        message: `Stop loss exits ${count}× — review entry timing or sizing.`,
        symbol: null,
        count,
      });
    }
  }

  const byStrategy = new Map<string, { losses: number; net: number }>();
  for (const record of sorted) {
    const tag = record.strategyTag ?? record.strategy ?? "UNSPECIFIED";
    const row = byStrategy.get(tag) ?? { losses: 0, net: 0 };
    if (record.result === "LOSS") row.losses += 1;
    row.net += record.netPnl;
    byStrategy.set(tag, row);
  }
  for (const [tag, row] of byStrategy) {
    if (row.losses >= 3 && row.net < 0) {
      pushMistake(mistakes, {
        kind: "strategy_underperform",
        severity: "CRITICAL",
        message: `Strategy ${tag}: ${row.losses} losses, net ${row.net.toFixed(2)} — needs review before adjustment.`,
        symbol: null,
        count: row.losses,
      });
    }
  }

  return mistakes.sort((a, b) => {
    const sev = { CRITICAL: 0, WARNING: 1 };
    return sev[a.severity] - sev[b.severity];
  });
}
