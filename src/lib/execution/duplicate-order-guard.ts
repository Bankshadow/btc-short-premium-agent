import type { JournalEvent } from "@/lib/journal/journal-types";
import type { OrderPreview } from "./preview-types";
import { checkPreviewExpiry } from "./preview-expiry";

export interface DuplicateCheckResult {
  duplicate: boolean;
  code: string | null;
  message: string | null;
}

export function detectDuplicateOrder(input: {
  events: JournalEvent[];
  preview: OrderPreview;
}): DuplicateCheckResult {
  const { events, preview } = input;

  const executedForPreview = events.some(
    (e) =>
      e.type === "ORDER_EXECUTED" &&
      (e.previewId === preview.previewId ||
        String((e.payload as { previewId?: string }).previewId ?? "") === preview.previewId),
  );
  if (executedForPreview) {
    return {
      duplicate: true,
      code: "DUPLICATE_ORDER_DETECTED",
      message: "ORDER_EXECUTED already exists for this previewId.",
    };
  }

  const executedForDecision = events.some(
    (e) =>
      e.type === "ORDER_EXECUTED" &&
      e.decisionLogId === preview.decisionLogId &&
      preview.decisionLogId,
  );
  if (executedForDecision) {
    return {
      duplicate: true,
      code: "DUPLICATE_ORDER_DETECTED",
      message: "ORDER_EXECUTED already exists for this decisionLogId.",
    };
  }

  const duplicateBlocked = events.some(
    (e) =>
      e.type === "DUPLICATE_ORDER_BLOCKED" &&
      e.previewId === preview.previewId &&
      e.decisionLogId === preview.decisionLogId,
  );
  if (duplicateBlocked) {
    return {
      duplicate: true,
      code: "DUPLICATE_ORDER_DETECTED",
      message: "Duplicate order already blocked for this preview.",
    };
  }

  const { expired } = checkPreviewExpiry(preview);
  if (expired) {
    return { duplicate: false, code: null, message: null };
  }

  const matchingActive = events.filter((e) => {
    if (e.type !== "PREVIEW_CREATED" || e.previewId === preview.previewId) return false;
    const p = e.payload as Partial<OrderPreview>;
    return (
      e.decisionLogId === preview.decisionLogId &&
      String(p.symbol ?? "").toUpperCase() === preview.symbol.toUpperCase() &&
      p.side === preview.side &&
      Number(p.notionalUsd ?? 0) === preview.notionalUsd
    );
  });

  if (matchingActive.length > 0) {
    return {
      duplicate: true,
      code: "DUPLICATE_ORDER_DETECTED",
      message:
        "Active preview with same symbol, side, notional, and decisionLogId already exists.",
    };
  }

  return { duplicate: false, code: null, message: null };
}
