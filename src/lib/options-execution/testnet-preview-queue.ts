import type { OptionsOrderPreview } from "./types";

export const OPTIONS_TESTNET_PREVIEW_QUEUE_KEY =
  "btc-desk:options-testnet-preview-queue";

export interface OptionsTestnetQueueItem {
  queueId: string;
  preview: OptionsOrderPreview;
  queuedAt: string;
  label: string;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadOptionsTestnetPreviewQueue(): OptionsTestnetQueueItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(OPTIONS_TESTNET_PREVIEW_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as OptionsTestnetQueueItem[]) : [];
  } catch {
    return [];
  }
}

export function saveOptionsTestnetPreviewQueue(
  items: OptionsTestnetQueueItem[],
): void {
  if (!isBrowser()) return;
  localStorage.setItem(
    OPTIONS_TESTNET_PREVIEW_QUEUE_KEY,
    JSON.stringify(items.slice(0, 50)),
  );
}

export function enqueueOptionsTestnetPreview(
  preview: OptionsOrderPreview,
  label?: string,
): OptionsTestnetQueueItem[] {
  const item: OptionsTestnetQueueItem = {
    queueId: `opt-q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    preview,
    queuedAt: new Date().toISOString(),
    label:
      label ??
      `${preview.ticket?.optionsInstrument.symbol ?? "preview"} · ${preview.previewId.slice(-8)}`,
  };
  const next = [item, ...loadOptionsTestnetPreviewQueue()];
  saveOptionsTestnetPreviewQueue(next);
  return next;
}

export function removeOptionsTestnetQueueItem(queueId: string): OptionsTestnetQueueItem[] {
  const next = loadOptionsTestnetPreviewQueue().filter((i) => i.queueId !== queueId);
  saveOptionsTestnetPreviewQueue(next);
  return next;
}
