export type CloseSide = "BUY" | "SELL";
export type CloseEnvironment = "TESTNET";
export type CloseOrderType = "MARKET";
export type ClosePreviewStatus = "ACTIVE" | "EXPIRED" | "CANCELLED" | "BLOCKED";

export const CLOSE_PREVIEW_TTL_MS = 15 * 60 * 1000;

export interface ClosePreview {
  closePreviewId: string;
  tradeId: string;
  positionId: string;
  runId: string;
  decisionLogId: string;
  symbol: string;
  sideToClose: CloseSide;
  qty: string;
  orderType: CloseOrderType;
  reduceOnly: boolean;
  environment: CloseEnvironment;
  expiresAt: string;
  createdAt: string;
  status: ClosePreviewStatus;
  blocked: boolean;
  blockReasons: string[];
  requiresDoubleConfirm: true;
}

export interface CreateClosePreviewInput {
  tradeId: string;
}

export interface CreateClosePreviewResult {
  ok: boolean;
  preview: ClosePreview | null;
  blockReasons: string[];
  eventType: "CLOSE_PREVIEW_CREATED" | "CLOSE_PREVIEW_BLOCKED";
  message: string;
}

export function resolveClosePreviewStatus(
  preview: Pick<ClosePreview, "blocked" | "expiresAt" | "status">,
  now = Date.now(),
): ClosePreviewStatus {
  if (preview.status === "CANCELLED") return "CANCELLED";
  if (preview.blocked) return "BLOCKED";
  if (Date.parse(preview.expiresAt) < now) return "EXPIRED";
  return "ACTIVE";
}

export function withClosePreviewStatus(
  preview: Omit<ClosePreview, "status"> & { status?: ClosePreviewStatus },
  now = Date.now(),
): ClosePreview {
  const resolved = resolveClosePreviewStatus(
    {
      blocked: preview.blocked,
      expiresAt: preview.expiresAt,
      status: preview.status ?? "ACTIVE",
    },
    now,
  );
  return { ...preview, status: resolved };
}

export function checkClosePreviewExpiry(
  preview: ClosePreview,
  now = Date.now(),
): { expired: boolean; preview: ClosePreview } {
  const withStatus = withClosePreviewStatus(preview, now);
  return {
    expired: withStatus.status === "EXPIRED",
    preview: withStatus,
  };
}

export function latestClosePreviewZeroState() {
  return {
    preview: null as ClosePreview | null,
    message: "No close preview yet.",
    sprint: "mvp-5b",
  };
}
