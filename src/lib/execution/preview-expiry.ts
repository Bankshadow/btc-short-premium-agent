import type { OrderPreview } from "./preview-types";
import { resolvePreviewStatus } from "./preview-types";

export function checkPreviewExpiry(
  preview: OrderPreview,
  now = Date.now(),
): { expired: boolean; preview: OrderPreview } {
  const status = resolvePreviewStatus(preview, now);
  return {
    expired: status === "EXPIRED",
    preview: { ...preview, status },
  };
}
