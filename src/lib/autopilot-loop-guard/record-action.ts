import type { RecordLoopGuardActionInput } from "./types";
import { appendLoopGuardRecord } from "./guard-store";

export async function recordLoopGuardAction(
  input: RecordLoopGuardActionInput,
  workspaceId = "server-default",
) {
  const record = {
    id: `lg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    actionType: input.actionType,
    actionKey: input.actionKey,
    success: input.success,
    failed: input.failed ?? !input.success,
    apiErrorKey: input.apiErrorKey ?? null,
    tradeCandidateKey: input.tradeCandidateKey ?? null,
    previewFingerprint: input.previewFingerprint ?? null,
    previewId: input.previewId ?? null,
    marketContextHash: input.marketContextHash ?? null,
    timestamp: new Date().toISOString(),
    runId: input.runId ?? null,
    summary: input.summary ?? null,
  };
  return appendLoopGuardRecord(record, workspaceId);
}
