import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import type { JournalEvent } from "@/lib/journal/journal-types";
import {
  type ClosePreview,
  latestClosePreviewZeroState,
  resolveClosePreviewStatus,
  withClosePreviewStatus,
} from "./close-preview-types";

function closePreviewFromEvent(evt: JournalEvent): ClosePreview | null {
  if (evt.type !== "CLOSE_PREVIEW_CREATED" || !evt.closePreviewId) return null;
  const p = evt.payload as Partial<ClosePreview>;
  const base = {
    closePreviewId: evt.closePreviewId,
    tradeId: evt.tradeId ?? String(p.tradeId ?? ""),
    positionId: evt.positionId ?? String(p.positionId ?? ""),
    runId: evt.runId ?? String(p.runId ?? ""),
    decisionLogId: evt.decisionLogId ?? String(p.decisionLogId ?? ""),
    symbol: String(p.symbol ?? ""),
    sideToClose: (p.sideToClose as ClosePreview["sideToClose"]) ?? "BUY",
    qty: String(p.qty ?? "0"),
    orderType: "MARKET" as const,
    reduceOnly: p.reduceOnly !== false,
    environment: "TESTNET" as const,
    expiresAt: String(p.expiresAt ?? new Date().toISOString()),
    createdAt: String(p.createdAt ?? evt.timestamp),
    blocked: Boolean(p.blocked),
    blockReasons: Array.isArray(p.blockReasons) ? p.blockReasons.map(String) : [],
    requiresDoubleConfirm: true as const,
    status: (p.status as ClosePreview["status"]) ?? "ACTIVE",
  };
  return withClosePreviewStatus(base);
}

export async function getAllClosePreviews(): Promise<ClosePreview[]> {
  const events = await getEvents();
  return events
    .filter((e) => e.type === "CLOSE_PREVIEW_CREATED")
    .map(closePreviewFromEvent)
    .filter((p): p is ClosePreview => p != null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getClosePreviewById(
  closePreviewId: string,
): Promise<ClosePreview | null> {
  const events = await getEvents();
  const evt = events.find(
    (e) => e.type === "CLOSE_PREVIEW_CREATED" && e.closePreviewId === closePreviewId,
  );
  return evt ? closePreviewFromEvent(evt) : null;
}

export async function getLatestActiveClosePreview(
  tradeId?: string,
): Promise<ClosePreview | null> {
  const previews = await getAllClosePreviews();
  for (const preview of previews) {
    if (tradeId && preview.tradeId !== tradeId) continue;
    if (resolveClosePreviewStatus(preview) === "ACTIVE") return preview;
  }
  return null;
}

export async function getLatestClosePreviewForTrade(
  tradeId: string,
): Promise<ClosePreview | null> {
  const previews = await getAllClosePreviews();
  return previews.find((p) => p.tradeId === tradeId) ?? null;
}

export async function getLatestClosePreviewView(tradeId?: string) {
  const preview = await getLatestActiveClosePreview(tradeId);
  if (!preview) return latestClosePreviewZeroState();
  return { preview, message: "Active close preview.", sprint: "mvp-5b" as const };
}

export async function countClosePreviews(): Promise<number> {
  const events = await getEvents();
  return events.filter((e) => e.type === "CLOSE_PREVIEW_CREATED").length;
}

export async function countClosePreviewBlockedEvents(): Promise<number> {
  const events = await getEvents();
  return events.filter((e) => e.type === "CLOSE_PREVIEW_BLOCKED").length;
}

export async function getLatestCloseReviewSummary(): Promise<{
  allowed: boolean | null;
  reviewedAt: string | null;
  closePreviewId: string | null;
  blockerCodes: string[];
}> {
  const events = await getEvents();
  const latest = events.find((e) => e.type === "CLOSE_REVIEWED");
  if (!latest) {
    return { allowed: null, reviewedAt: null, closePreviewId: null, blockerCodes: [] };
  }
  const payload = latest.payload as {
    allowed?: boolean;
    blockers?: string[];
  };
  return {
    allowed: payload.allowed ?? null,
    reviewedAt: latest.timestamp,
    closePreviewId: latest.closePreviewId ?? null,
    blockerCodes: Array.isArray(payload.blockers) ? payload.blockers.map(String) : [],
  };
}

export async function countCloseOrderExecuted(): Promise<number> {
  const events = await getEvents();
  return events.filter((e) => e.type === "CLOSE_ORDER_EXECUTED").length;
}

export async function countPositionClosed(): Promise<number> {
  const events = await getEvents();
  return events.filter((e) => e.type === "POSITION_CLOSED").length;
}

export async function countPositionMonitored(): Promise<number> {
  const events = await getEvents();
  return events.filter((e) => e.type === "POSITION_MONITORED").length;
}
