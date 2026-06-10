import type { JournalEvent } from "@/lib/journal/journal-types";

export interface JournalChainWarning {
  code: string;
  message: string;
  severity: "WARNING" | "BLOCK";
}

export function validateJournalChain(events: JournalEvent[]): JournalChainWarning[] {
  const warnings: JournalChainWarning[] = [];

  const executed = new Set(
    events.filter((e) => e.type === "ORDER_EXECUTED").map((e) => e.previewId).filter(Boolean),
  );
  for (const evt of events.filter((e) => e.type === "EXECUTION_REVIEWED")) {
    const previewId = evt.previewId;
    if (previewId && !executed.has(previewId)) {
      const laterExecuted = events.some(
        (e) => e.type === "ORDER_EXECUTED" && e.previewId === previewId && e.timestamp >= evt.timestamp,
      );
      if (!laterExecuted) continue;
    }
  }

  for (const closed of events.filter((e) => e.type === "POSITION_CLOSED")) {
    const tradeId = closed.tradeId;
    if (!tradeId) {
      warnings.push({
        code: "POSITION_CLOSED_MISSING_TRADE_ID",
        message: "POSITION_CLOSED event missing tradeId.",
        severity: "WARNING",
      });
      continue;
    }
    const hasOrder = events.some(
      (e) => e.type === "ORDER_EXECUTED" && e.tradeId === tradeId && e.timestamp <= closed.timestamp,
    );
    if (!hasOrder) {
      warnings.push({
        code: "POSITION_CLOSED_WITHOUT_ORDER",
        message: `POSITION_CLOSED for ${tradeId} without prior ORDER_EXECUTED.`,
        severity: "WARNING",
      });
    }
  }

  for (const pnl of events.filter((e) => e.type === "PNL_REALIZED")) {
    const tradeId = pnl.tradeId;
    if (!tradeId) continue;
    const hasClosed = events.some(
      (e) => e.type === "POSITION_CLOSED" && e.tradeId === tradeId && e.timestamp <= pnl.timestamp,
    );
    if (!hasClosed) {
      warnings.push({
        code: "PNL_WITHOUT_POSITION_CLOSED",
        message: `PNL_REALIZED for ${tradeId} without POSITION_CLOSED.`,
        severity: "WARNING",
      });
    }
  }

  for (const learning of events.filter((e) => e.type === "LEARNING_RECORD_CREATED")) {
    const tradeId = learning.tradeId ?? (learning.payload as { tradeId?: string }).tradeId;
    if (!tradeId) continue;
    const hasPnl = events.some((e) => e.type === "PNL_REALIZED" && e.tradeId === tradeId);
    if (!hasPnl) {
      warnings.push({
        code: "LEARNING_WITHOUT_PNL",
        message: `Learning record for ${tradeId} without PNL_REALIZED.`,
        severity: "WARNING",
      });
    }
  }

  return warnings;
}
