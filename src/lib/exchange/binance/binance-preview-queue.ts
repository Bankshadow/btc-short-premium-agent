import type { BinanceOrderPreview } from "./binance-types";

export const BINANCE_TESTNET_PREVIEW_QUEUE_KEY =
  "btc-desk:binance-testnet-preview-queue";

export interface BinanceTestnetQueueItem {
  queueId: string;
  preview: BinanceOrderPreview;
  queuedAt: string;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function loadBinanceTestnetPreviewQueue(): BinanceTestnetQueueItem[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(BINANCE_TESTNET_PREVIEW_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as BinanceTestnetQueueItem[]) : [];
  } catch {
    return [];
  }
}

export function saveBinanceTestnetPreviewQueue(
  items: BinanceTestnetQueueItem[],
): void {
  if (!isBrowser()) return;
  localStorage.setItem(
    BINANCE_TESTNET_PREVIEW_QUEUE_KEY,
    JSON.stringify(items.slice(0, 50)),
  );
}

export function enqueueBinanceTestnetPreview(
  preview: BinanceOrderPreview,
): BinanceTestnetQueueItem {
  const item: BinanceTestnetQueueItem = {
    queueId: `bn-q-${Date.now()}`,
    preview,
    queuedAt: new Date().toISOString(),
  };
  const next = [item, ...loadBinanceTestnetPreviewQueue()];
  saveBinanceTestnetPreviewQueue(next);
  return item;
}

export function removeBinanceTestnetQueueItem(queueId: string): void {
  saveBinanceTestnetPreviewQueue(
    loadBinanceTestnetPreviewQueue().filter((q) => q.queueId !== queueId),
  );
}
