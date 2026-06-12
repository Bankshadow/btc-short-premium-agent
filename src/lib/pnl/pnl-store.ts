import { getEvents } from "@/lib/journal/journal-query";
import type { JournalEvent } from "@/lib/journal/journal-types";
import type { RealizedPnlRecord } from "./pnl-types";
import { buySellToPositionSide } from "./pnl-calculator";

function recordFromEvent(evt: JournalEvent): RealizedPnlRecord | null {
  if (evt.type !== "PNL_REALIZED" || !evt.tradeId) return null;
  const p = evt.payload as Partial<RealizedPnlRecord & { side?: string }>;
  if (p.entryPrice == null || p.exitPrice == null || p.netPnl == null) return null;
  const rawSide = p.side;
  const side: RealizedPnlRecord["side"] =
    rawSide === "LONG" || rawSide === "SHORT"
      ? rawSide
      : buySellToPositionSide(rawSide === "BUY" || rawSide === "SELL" ? rawSide : "SELL");
  return {
    tradeId: evt.tradeId,
    positionId: evt.positionId ?? (p.positionId as string | null) ?? null,
    runId: evt.runId ?? null,
    decisionLogId: evt.decisionLogId ?? null,
    symbol: String(p.symbol ?? ""),
    side,
    qty: String(p.qty ?? "0"),
    entryPrice: Number(p.entryPrice),
    exitPrice: Number(p.exitPrice),
    grossPnl: Number(p.grossPnl ?? 0),
    entryFee: Number(p.entryFee ?? 0),
    exitFee: Number(p.exitFee ?? 0),
    feeEstimate: Number(p.feeEstimate ?? p.entryFee ?? 0),
    netPnl: Number(p.netPnl),
    pnlPct: Number(p.pnlPct ?? 0),
    result: (p.result as RealizedPnlRecord["result"]) ?? "BREAKEVEN",
    calculatedAt: String(p.calculatedAt ?? evt.timestamp),
    status: "REALIZED",
    environment: (p.environment as RealizedPnlRecord["environment"]) ?? "TESTNET",
  };
}

export async function getAllPnlRecords(): Promise<RealizedPnlRecord[]> {
  const events = await getEvents();
  return events
    .filter((e) => e.type === "PNL_REALIZED")
    .map(recordFromEvent)
    .filter((r): r is RealizedPnlRecord => r != null)
    .sort((a, b) => b.calculatedAt.localeCompare(a.calculatedAt));
}

export async function getPnlRecordByTradeId(tradeId: string): Promise<RealizedPnlRecord | null> {
  const records = await getAllPnlRecords();
  return records.find((r) => r.tradeId === tradeId) ?? null;
}

export async function hasPnlRealized(tradeId: string): Promise<boolean> {
  const events = await getEvents();
  return events.some((e) => e.type === "PNL_REALIZED" && e.tradeId === tradeId);
}

export function buildPnlSummary(records: RealizedPnlRecord[]) {
  const wins = records.filter((r) => r.result === "WIN").length;
  const losses = records.filter((r) => r.result === "LOSS").length;
  const breakeven = records.filter((r) => r.result === "BREAKEVEN").length;
  const totalNet = records.reduce((s, r) => s + r.netPnl, 0);
  const avgPnl = records.length > 0 ? totalNet / records.length : 0;
  const best = records.length > 0 ? records.reduce((a, b) => (a.netPnl >= b.netPnl ? a : b)) : null;
  const worst = records.length > 0 ? records.reduce((a, b) => (a.netPnl <= b.netPnl ? a : b)) : null;
  return {
    count: records.length,
    wins,
    losses,
    breakeven,
    totalNetPnl: Number(totalNet.toFixed(4)),
    averagePnl: Number(avgPnl.toFixed(4)),
    bestTrade: best,
    worstTrade: worst,
  };
}
