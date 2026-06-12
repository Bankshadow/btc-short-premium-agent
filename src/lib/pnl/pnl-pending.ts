import type { JournalEvent } from "@/lib/journal/journal-types";
import { buildPnlInputFromEvents, resolveTradeIdFromPosition } from "./pnl-engine";
import { validatePnlInput } from "./pnl-calculator";
import type { PendingPnlTrade, PnlPendingDataReason } from "./pnl-types";

function latestPendingReasons(
  tradeId: string,
  events: JournalEvent[],
): { reasons: PnlPendingDataReason[]; message: string; lastPendingAt: string | null } {
  const pendingEvents = events
    .filter((e) => e.type === "PNL_PENDING_DATA" && e.tradeId === tradeId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const latest = pendingEvents[0];
  if (!latest) {
    return { reasons: [], message: "", lastPendingAt: null };
  }
  const payload = latest.payload as { reasons?: PnlPendingDataReason[]; message?: string };
  return {
    reasons: payload.reasons ?? [],
    message: String(payload.message ?? ""),
    lastPendingAt: latest.timestamp,
  };
}

export function listPendingPnlTrades(events: JournalEvent[]): PendingPnlTrade[] {
  const realizedIds = new Set(
    events.filter((e) => e.type === "PNL_REALIZED").map((e) => e.tradeId).filter(Boolean),
  );

  const pending: PendingPnlTrade[] = [];

  for (const closedEvt of events.filter((e) => e.type === "POSITION_CLOSED")) {
    const tradeId = closedEvt.tradeId;
    if (!tradeId || realizedIds.has(tradeId)) continue;

    const input = buildPnlInputFromEvents(tradeId, events);
    const validation = input
      ? validatePnlInput(input)
      : { valid: false, reasons: ["MISSING_CLOSE_EVENT"] as PnlPendingDataReason[], warnings: [] };
    const stored = latestPendingReasons(tradeId, events);
    const reasons =
      stored.reasons.length > 0 ? stored.reasons : validation.reasons;
    const message =
      stored.message ||
      (validation.valid
        ? "PnL pending — fill data present but PNL_REALIZED not recorded."
        : reasons.length > 0
          ? `PnL pending — missing fill data (${reasons.join(", ")}).`
          : "PnL pending — missing fill data.");

    pending.push({
      tradeId,
      positionId: input?.positionId ?? closedEvt.positionId ?? null,
      symbol: input?.symbol ?? String((closedEvt.payload as { symbol?: string }).symbol ?? ""),
      side: input?.side ?? null,
      qty: input?.qty ?? null,
      entryPrice: input?.entryPrice ?? null,
      exitPrice: input?.exitPrice ?? null,
      closedAt: input?.closedAt ?? closedEvt.timestamp,
      reasons,
      message,
      lastPendingAt: stored.lastPendingAt,
    });
  }

  return pending.sort((a, b) => (b.closedAt ?? "").localeCompare(a.closedAt ?? ""));
}

export function resolveTradeId(input: {
  tradeId?: string;
  positionId?: string;
  events: JournalEvent[];
}): string | null {
  if (input.tradeId?.trim()) return input.tradeId.trim();
  if (input.positionId?.trim()) {
    return resolveTradeIdFromPosition(input.positionId.trim(), input.events);
  }
  return null;
}
