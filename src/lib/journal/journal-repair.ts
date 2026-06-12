import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import type { JournalEvent } from "@/lib/journal/journal-types";
import { recalculateEvidenceProgress } from "@/lib/evidence/evidence-progress";
import { listClosedTradeIds } from "@/lib/evidence/evidence-validator";
import { calculatePnlForTrade } from "@/lib/pnl/calculate-pnl";
import { refreshOpenPositions } from "@/lib/positions/position-monitor";
import { hasPnlRealized } from "@/lib/pnl/pnl-store";
import { resolveTradeChain } from "./trade-chain";

export interface JournalRepairTradeResult {
  tradeId: string;
  closeReviewedBackfill: "skipped" | "applied" | "failed";
  pnlRepair: "skipped" | "applied" | "failed" | "already_realized";
  postTradeLoop: "skipped" | "applied" | "failed";
  message?: string;
}

export interface JournalRepairReport {
  ok: boolean;
  dryRun: boolean;
  closedTradeCount: number;
  trades: JournalRepairTradeResult[];
  positionRefresh: { ok: boolean; message: string };
  evidence: { valid: number; required: number; rejected: number } | null;
  repairedAt: string;
}

function timestampBefore(iso: string, ms = 1000): string {
  return new Date(Date.parse(iso) - ms).toISOString();
}

function isReconciliationClose(events: JournalEvent[], tradeId: string): boolean {
  const closeEvt = events.find((e) => e.type === "POSITION_CLOSED" && e.tradeId === tradeId);
  const payload = (closeEvt?.payload ?? {}) as { source?: string };
  return payload.source === "RECONCILIATION_BACKFILL";
}

async function backfillCloseReviewed(
  tradeId: string,
  events: JournalEvent[],
  dryRun: boolean,
): Promise<"skipped" | "applied" | "failed"> {
  const hasReview = events.some((e) => e.type === "CLOSE_REVIEWED" && e.tradeId === tradeId);
  if (hasReview) return "skipped";

  const closeOrder = events.find(
    (e) => e.type === "CLOSE_ORDER_EXECUTED" && e.tradeId === tradeId,
  );
  if (!closeOrder) return "skipped";

  if (dryRun) return "applied";

  try {
    const chain = resolveTradeChain(tradeId, events);
    await appendEvent({
      type: "CLOSE_REVIEWED",
      environment: "testnet",
      timestamp: timestampBefore(closeOrder.timestamp),
      runId: chain?.runId,
      decisionLogId: chain?.decisionLogId,
      tradeId,
      previewId: chain?.previewId,
      payload: {
        source: "JOURNAL_REPAIR",
        reason: "Backfill CLOSE_REVIEWED before reconciliation close.",
        closeOrderId: (closeOrder.payload as { orderId?: string }).orderId ?? null,
      },
    });
    return "applied";
  } catch {
    return "failed";
  }
}

async function repairTradePnl(
  tradeId: string,
  dryRun: boolean,
): Promise<{ status: JournalRepairTradeResult["pnlRepair"]; message?: string }> {
  if (await hasPnlRealized(tradeId)) {
    return { status: "already_realized" };
  }

  if (dryRun) {
    return { status: "applied", message: "Would run calculatePnlForTrade (zero-fill or priced)." };
  }

  try {
    const result = await calculatePnlForTrade(tradeId);
    if (result.ok) {
      return { status: "applied", message: result.message };
    }
    if (result.status === "PNL_PENDING_DATA") {
      return { status: "applied", message: result.message };
    }
    return { status: "failed", message: result.message };
  } catch (err) {
    return {
      status: "failed",
      message: err instanceof Error ? err.message : "PnL repair failed",
    };
  }
}

async function runPostTradeForTrade(
  tradeId: string,
  dryRun: boolean,
): Promise<"skipped" | "applied" | "failed"> {
  if (!(await hasPnlRealized(tradeId))) return "skipped";
  if (dryRun) return "applied";

  try {
    const { runPostTradeLoop } = await import("@/lib/loops/post-trade-loop");
    await runPostTradeLoop(tradeId);
    return "applied";
  } catch {
    return "failed";
  }
}

export async function runJournalRepair(input?: {
  dryRun?: boolean;
  tradeIds?: string[];
}): Promise<JournalRepairReport> {
  const dryRun = input?.dryRun ?? false;
  const repairedAt = new Date().toISOString();
  let events = await getEvents();
  const closedIds = input?.tradeIds?.length ? input.tradeIds : listClosedTradeIds(events);
  const trades: JournalRepairTradeResult[] = [];

  for (const tradeId of closedIds) {
    events = await getEvents();
    const closeReviewedBackfill = await backfillCloseReviewed(tradeId, events, dryRun);
    const pnl = await repairTradePnl(tradeId, dryRun);
    const postTradeLoop = await runPostTradeForTrade(tradeId, dryRun);

    trades.push({
      tradeId,
      closeReviewedBackfill,
      pnlRepair: pnl.status,
      postTradeLoop,
      message: [
        isReconciliationClose(events, tradeId) ? "reconciliation_backfill" : null,
        pnl.message,
      ]
        .filter(Boolean)
        .join(" — "),
    });
  }

  let positionRefresh = { ok: true, message: "skipped — no dry-run position refresh" };
  if (!dryRun) {
    try {
      const refreshed = await refreshOpenPositions();
      positionRefresh = {
        ok: refreshed.ok,
        message: refreshed.message ?? "positions refreshed",
      };
    } catch (err) {
      positionRefresh = {
        ok: false,
        message: err instanceof Error ? err.message : "position refresh failed",
      };
    }
  } else {
    positionRefresh = { ok: true, message: "dry-run — would refresh open positions" };
  }

  let evidence: JournalRepairReport["evidence"] = null;
  if (!dryRun) {
    const progress = await recalculateEvidenceProgress();
    evidence = {
      valid: progress.valid,
      required: progress.required,
      rejected: progress.rejected,
    };
  }

  if (!dryRun) {
    await appendEvent({
      type: "OPERATOR_ACTION_RECORDED",
      environment: "testnet",
      payload: {
        action: "JOURNAL_REPAIR",
        repairedAt,
        closedTradeCount: closedIds.length,
        trades,
        positionRefresh,
        evidence,
      },
    });
  }

  const failed = trades.some(
    (t) =>
      t.closeReviewedBackfill === "failed" ||
      t.pnlRepair === "failed" ||
      t.postTradeLoop === "failed",
  );

  return {
    ok: !failed && positionRefresh.ok,
    dryRun,
    closedTradeCount: closedIds.length,
    trades,
    positionRefresh,
    evidence,
    repairedAt,
  };
}
