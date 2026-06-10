export type PreviewSide = "BUY" | "SELL";
export type PreviewOrderType = "MARKET";
export type PreviewEnvironment = "TESTNET";
export type PreviewStatus = "ACTIVE" | "EXPIRED" | "CANCELLED" | "BLOCKED";

export const PREVIEW_TTL_MS = 15 * 60 * 1000;
export const DEFAULT_PREVIEW_SYMBOL = "BTCUSDT";
export const DEFAULT_PREVIEW_SIDE: PreviewSide = "SELL";
export const DEFAULT_PREVIEW_NOTIONAL_USD = 50;
export const DEFAULT_PREVIEW_ORDER_TYPE: PreviewOrderType = "MARKET";
export const MOCK_BTC_MARK_PRICE = 50_000;

export interface OrderPreview {
  previewId: string;
  runId: string;
  decisionLogId: string;
  symbol: string;
  side: PreviewSide;
  notionalUsd: number;
  estimatedQty: string;
  orderType: PreviewOrderType;
  environment: PreviewEnvironment;
  status: PreviewStatus;
  expiresAt: string;
  createdAt: string;
  blocked: boolean;
  blockReasons: string[];
  requiresDoubleConfirm: true;
}

export interface CreatePreviewInput {
  runId: string;
  decisionLogId: string;
  symbol?: string;
  side?: PreviewSide;
  notionalUsd?: number;
  environment?: PreviewEnvironment;
}

export interface CreatePreviewResult {
  ok: boolean;
  preview: OrderPreview | null;
  blockReasons: string[];
  eventType: "PREVIEW_CREATED" | "PREVIEW_BLOCKED";
}

export function newPreviewId(): string {
  return `prev-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function estimatePreviewQty(symbol: string, notionalUsd: number): string {
  const price =
    symbol.toUpperCase() === "BTCUSDT"
      ? MOCK_BTC_MARK_PRICE
      : symbol.toUpperCase() === "ETHUSDT"
        ? 3_000
        : 100;
  const raw = notionalUsd / price;
  const qty = Math.max(0.001, Math.floor(raw * 1000) / 1000);
  return qty.toFixed(3);
}

export function resolvePreviewStatus(
  preview: Pick<OrderPreview, "status" | "expiresAt">,
  now = Date.now(),
): PreviewStatus {
  if (preview.status === "CANCELLED" || preview.status === "BLOCKED") {
    return preview.status;
  }
  if (Date.parse(preview.expiresAt) < now) return "EXPIRED";
  return preview.status;
}
