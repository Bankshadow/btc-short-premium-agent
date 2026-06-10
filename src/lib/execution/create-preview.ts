import { appendEvent } from "@/lib/journal/journal-query";
import { isOperatorBlocked } from "@/lib/operator/operator-actions";
import { evaluatePreviewCreationGate } from "@/lib/risk/risk-gate";
import {
  DEFAULT_PREVIEW_NOTIONAL_USD,
  DEFAULT_PREVIEW_ORDER_TYPE,
  DEFAULT_PREVIEW_SIDE,
  DEFAULT_PREVIEW_SYMBOL,
  estimatePreviewQty,
  newPreviewId,
  PREVIEW_TTL_MS,
  type CreatePreviewInput,
  type CreatePreviewResult,
  type OrderPreview,
} from "./preview-types";

export async function createTestnetPreview(
  input: CreatePreviewInput,
): Promise<CreatePreviewResult> {
  const symbol = (input.symbol ?? DEFAULT_PREVIEW_SYMBOL).toUpperCase();
  const side = input.side ?? DEFAULT_PREVIEW_SIDE;
  const notionalUsd = input.notionalUsd ?? DEFAULT_PREVIEW_NOTIONAL_USD;
  const environment = input.environment ?? "TESTNET";

  const operatorBlock = await isOperatorBlocked();
  const gate = evaluatePreviewCreationGate({
    runId: input.runId,
    decisionLogId: input.decisionLogId,
    symbol,
    side,
    notionalUsd,
    environment,
  });

  const blockReasons = [...gate.blockReasons];
  if (operatorBlock.blocked) {
    blockReasons.push(operatorBlock.reason ?? "Operator blocked.");
  }

  if (!gate.allowed || operatorBlock.blocked) {
    await appendEvent({
      type: "PREVIEW_BLOCKED",
      environment: "testnet",
      runId: input.runId,
      decisionLogId: input.decisionLogId,
      payload: {
        symbol,
        side,
        notionalUsd,
        blockReasons,
        environment,
      },
    });

    return {
      ok: false,
      preview: null,
      blockReasons,
      eventType: "PREVIEW_BLOCKED",
    };
  }

  const now = new Date();
  const previewId = newPreviewId();
  const preview: OrderPreview = {
    previewId,
    runId: input.runId,
    decisionLogId: input.decisionLogId,
    symbol,
    side,
    notionalUsd,
    estimatedQty: estimatePreviewQty(symbol, notionalUsd),
    orderType: DEFAULT_PREVIEW_ORDER_TYPE,
    environment: "TESTNET",
    status: "ACTIVE",
    expiresAt: new Date(now.getTime() + PREVIEW_TTL_MS).toISOString(),
    createdAt: now.toISOString(),
    blocked: false,
    blockReasons: [],
    requiresDoubleConfirm: true,
  };

  await appendEvent({
    type: "PREVIEW_CREATED",
    environment: "testnet",
    runId: input.runId,
    decisionLogId: input.decisionLogId,
    previewId,
    payload: preview as unknown as Record<string, unknown>,
  });

  return {
    ok: true,
    preview,
    blockReasons: [],
    eventType: "PREVIEW_CREATED",
  };
}
