import { getEvents } from "@/lib/journal/journal-query";
import type { JournalEvent } from "@/lib/journal/journal-types";
import {
  type OrderPreview,
  resolvePreviewStatus,
} from "./preview-types";

function previewFromCreatedEvent(evt: JournalEvent): OrderPreview | null {
  if (evt.type !== "PREVIEW_CREATED" || !evt.previewId) return null;
  const p = evt.payload as Partial<OrderPreview>;
  const preview: OrderPreview = {
    previewId: evt.previewId,
    runId: evt.runId ?? p.runId ?? "",
    decisionLogId: evt.decisionLogId ?? p.decisionLogId ?? "",
    symbol: String(p.symbol ?? "BTCUSDT"),
    side: (p.side as OrderPreview["side"]) ?? "SELL",
    notionalUsd: Number(p.notionalUsd ?? 50),
    estimatedQty: String(p.estimatedQty ?? "0.001"),
    orderType: "MARKET",
    environment: "TESTNET",
    status: (p.status as OrderPreview["status"]) ?? "ACTIVE",
    expiresAt: String(p.expiresAt ?? new Date().toISOString()),
    createdAt: String(p.createdAt ?? evt.timestamp),
    blocked: false,
    blockReasons: [],
    requiresDoubleConfirm: true,
  };
  return {
    ...preview,
    status: resolvePreviewStatus(preview),
  };
}

export async function loadPreviewEvents(): Promise<JournalEvent[]> {
  const events = await getEvents();
  return events.filter(
    (e) => e.type === "PREVIEW_CREATED" || e.type === "PREVIEW_BLOCKED",
  );
}

export async function getAllPreviews(): Promise<OrderPreview[]> {
  const events = await getEvents();
  return events
    .filter((e) => e.type === "PREVIEW_CREATED")
    .map(previewFromCreatedEvent)
    .filter((p): p is OrderPreview => p != null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getPreviewById(previewId: string): Promise<OrderPreview | null> {
  const events = await getEvents();
  const evt = events.find(
    (e) => e.type === "PREVIEW_CREATED" && e.previewId === previewId,
  );
  return evt ? previewFromCreatedEvent(evt) : null;
}

export async function getLatestPreview(): Promise<OrderPreview | null> {
  const previews = await getAllPreviews();
  return previews[0] ?? null;
}

export async function getLatestActivePreview(): Promise<OrderPreview | null> {
  const previews = await getAllPreviews();
  for (const preview of previews) {
    const status = resolvePreviewStatus(preview);
    if (status === "ACTIVE") {
      return { ...preview, status };
    }
  }
  return null;
}

export async function countPreviews(): Promise<number> {
  const events = await getEvents();
  return events.filter((e) => e.type === "PREVIEW_CREATED").length;
}

export async function countPreviewBlockedEvents(): Promise<number> {
  const events = await getEvents();
  return events.filter((e) => e.type === "PREVIEW_BLOCKED").length;
}

export function latestPreviewZeroState() {
  return {
    preview: null as OrderPreview | null,
    previewCount: 0,
    latestPreviewStatus: null as string | null,
    message: "No active preview — run Start AI with TRADE verdict or POST /api/execution/preview.",
  };
}
