import crypto from "crypto";
import type { OrderPreviewResult } from "./types";

const TTL_MS = 5 * 60 * 1000;

function confirmSecret(): string | null {
  return (
    process.env.CRON_SECRET?.trim() ||
    process.env.BYBIT_API_SECRET?.trim() ||
    null
  );
}

function buildConfirmPayload(preview: OrderPreviewResult): string {
  return JSON.stringify({
    symbol: preview.symbol,
    side: preview.side,
    qty: preview.estQty,
    category: preview.category,
    notional: preview.estNotionalUsd,
  });
}

export function attachExecuteConfirmToken(
  preview: OrderPreviewResult,
): OrderPreviewResult {
  const secret = confirmSecret();
  if (!secret || !preview.valid) {
    return {
      ...preview,
      executeConfirmToken: null,
      executeConfirmExpiresAt: null,
    };
  }

  const executeConfirmExpiresAt = new Date(Date.now() + TTL_MS).toISOString();
  const executeConfirmToken = crypto
    .createHmac("sha256", secret)
    .update(`${buildConfirmPayload(preview)}|${executeConfirmExpiresAt}`)
    .digest("hex")
    .slice(0, 40);

  return { ...preview, executeConfirmToken, executeConfirmExpiresAt };
}

export function verifyExecuteConfirmToken(input: {
  preview: OrderPreviewResult;
  token: string;
  expiresAt: string;
}): boolean {
  const secret = confirmSecret();
  if (!secret) return false;
  if (Date.now() > Date.parse(input.expiresAt)) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${buildConfirmPayload(input.preview)}|${input.expiresAt}`)
    .digest("hex")
    .slice(0, 40);

  return expected === input.token;
}
