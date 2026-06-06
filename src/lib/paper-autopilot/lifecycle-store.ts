import { PAPER_LIFECYCLE_STORAGE_KEY } from "./config";
import type {
  PaperAutopilotBook,
  PaperLifecycleRecord,
  PaperLifecycleStatus,
} from "./types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";

function newLifecycleId(): string {
  return `pl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function loadPaperLifecycleRecords(): PaperLifecycleRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PAPER_LIFECYCLE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PaperLifecycleRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistPaperLifecycleRecords(
  records: PaperLifecycleRecord[],
): PaperLifecycleRecord[] {
  if (typeof window !== "undefined") {
    localStorage.setItem(PAPER_LIFECYCLE_STORAGE_KEY, JSON.stringify(records));
  }
  return records;
}

function bookFromOrder(order: PaperOrder): PaperAutopilotBook {
  if (order.isDemoData) return "DEMO";
  if (order.paperMode === "RELAXED_PAPER") return "PAPER_SHADOW";
  return "PAPER_STRICT";
}

function appendEvent(
  record: PaperLifecycleRecord,
  status: PaperLifecycleStatus,
  note: string,
): PaperLifecycleRecord {
  const at = new Date().toISOString();
  return {
    ...record,
    status,
    updatedAt: at,
    events: [...record.events, { at, status, note }],
  };
}

export function findLifecycleByTradeId(
  tradeId: string,
): PaperLifecycleRecord | null {
  return loadPaperLifecycleRecords().find((r) => r.tradeId === tradeId) ?? null;
}

export function findLifecycleByDecisionLogId(
  decisionLogId: string,
): PaperLifecycleRecord | null {
  return (
    loadPaperLifecycleRecords().find((r) => r.decisionLogId === decisionLogId) ??
    null
  );
}

export function createLifecycleForOrder(order: PaperOrder): PaperLifecycleRecord {
  const existing = findLifecycleByTradeId(order.id);
  if (existing) return existing;

  const at = new Date().toISOString();
  const record: PaperLifecycleRecord = {
    lifecycleId: newLifecycleId(),
    tradeId: order.id,
    decisionLogId: order.decisionLogId,
    book: bookFromOrder(order),
    status: "CREATED",
    events: [{ at, status: "CREATED", note: `Autopilot created ${bookFromOrder(order)} trade.` }],
    closeRecommendation: null,
    monitorNotes: [],
    markBtcPrice: order.lastMarkBtcPrice,
    unrealizedPnlPct: order.unrealizedPnlPct,
    realizedPnlPct: null,
    createdAt: at,
    updatedAt: at,
    closedAt: null,
    resolvedAt: null,
    outcomeLabel: null,
    rMultiple: null,
    resolutionNotes: null,
  };

  const openRecord = appendEvent(
    { ...record, status: "OPEN" },
    "OPEN",
    `${order.instrument} @ BTC ${order.entryBtcPrice}`,
  );

  const records = [...loadPaperLifecycleRecords(), openRecord];
  persistPaperLifecycleRecords(records);
  return openRecord;
}

export function updateLifecycle(
  lifecycleId: string,
  updater: (record: PaperLifecycleRecord) => PaperLifecycleRecord,
): PaperLifecycleRecord | null {
  const records = loadPaperLifecycleRecords();
  let updated: PaperLifecycleRecord | null = null;
  const next = records.map((r) => {
    if (r.lifecycleId !== lifecycleId) return r;
    updated = updater(r);
    return updated;
  });
  if (!updated) return null;
  persistPaperLifecycleRecords(next);
  return updated;
}

export function transitionLifecycle(
  lifecycleId: string,
  status: PaperLifecycleStatus,
  note: string,
  patch?: Partial<PaperLifecycleRecord>,
): PaperLifecycleRecord | null {
  return updateLifecycle(lifecycleId, (r) => {
    const at = new Date().toISOString();
    const next: PaperLifecycleRecord = {
      ...r,
      ...patch,
      status,
      updatedAt: at,
      events: [...r.events, { at, status, note }],
    };
    if (status === "CLOSED" && !next.closedAt) next.closedAt = at;
    if (status === "RESOLVED" && !next.resolvedAt) next.resolvedAt = at;
    return next;
  });
}

export function syncLifecycleFromOrder(order: PaperOrder): PaperLifecycleRecord {
  const existing = findLifecycleByTradeId(order.id);
  if (!existing) return createLifecycleForOrder(order);

  if (order.status === "CLOSED" && existing.status !== "RESOLVED") {
    const targetStatus =
      existing.status === "CLOSE_RECOMMENDED" ? "CLOSED" : "CLOSED";
    return (
      transitionLifecycle(existing.lifecycleId, targetStatus, "Paper order closed.", {
        realizedPnlPct: order.realizedPnlPct,
        markBtcPrice: order.exitBtcPrice ?? order.lastMarkBtcPrice,
        unrealizedPnlPct: null,
        closedAt: order.closedAt ?? new Date().toISOString(),
      }) ?? existing
    );
  }

  if (order.status === "OPEN" && existing.status === "OPEN") {
    return (
      updateLifecycle(existing.lifecycleId, (r) => ({
        ...r,
        status: "MONITORING",
        markBtcPrice: order.lastMarkBtcPrice,
        unrealizedPnlPct: order.unrealizedPnlPct,
        updatedAt: new Date().toISOString(),
        events:
          r.status === "MONITORING"
            ? r.events
            : [
                ...r.events,
                {
                  at: new Date().toISOString(),
                  status: "MONITORING" as const,
                  note: "Mark-to-market monitoring active.",
                },
              ],
      })) ?? existing
    );
  }

  return existing;
}
