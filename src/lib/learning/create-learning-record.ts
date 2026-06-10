import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { newLearningId } from "@/lib/journal/journal-types";
import { getPnlRecordByTradeId, hasPnlRealized } from "@/lib/pnl/pnl-store";
import { buildTradeReflection, findVerdictForTrade } from "./trade-reflection";
import { hasLearningRecord } from "./learning-store";
import type { CreateLearningResult, LearningRecord } from "./learning-types";

export async function createLearningRecord(input: {
  tradeId: string;
}): Promise<CreateLearningResult> {
  if (!input.tradeId) {
    return { ok: false, record: null, message: "tradeId is required." };
  }

  if (await hasLearningRecord(input.tradeId)) {
    return { ok: true, alreadyExists: true, record: null, message: "Learning record already exists." };
  }

  const events = await getEvents();
  const closed = events.find((e) => e.type === "POSITION_CLOSED" && e.tradeId === input.tradeId);
  if (!closed) {
    return { ok: false, record: null, message: "Closed trade required for learning." };
  }

  if (!(await hasPnlRealized(input.tradeId))) {
    return { ok: false, record: null, message: "Realized PnL required for learning." };
  }

  const pnl = await getPnlRecordByTradeId(input.tradeId);
  if (!pnl) {
    return { ok: false, record: null, message: "PnL record not found." };
  }

  const decisionLogId = closed.decisionLogId ?? pnl.decisionLogId;
  const runId = closed.runId ?? pnl.runId;
  if (!decisionLogId) {
    return { ok: false, record: null, message: "decisionLogId is required for learning." };
  }

  await appendEvent({
    type: "LEARNING_STARTED",
    environment: "testnet",
    runId: runId ?? undefined,
    decisionLogId,
    tradeId: input.tradeId,
    payload: { tradeId: input.tradeId },
  });

  const verdictCtx = findVerdictForTrade(input.tradeId, events);
  const reflection = buildTradeReflection({
    pnl,
    verdict: verdictCtx.verdict,
    verdictReasons: verdictCtx.reasons,
  });

  const record: LearningRecord = {
    learningId: newLearningId(),
    tradeId: input.tradeId,
    runId: runId ?? "",
    decisionLogId,
    symbol: pnl.symbol,
    tradeResult: pnl.result,
    realizedPnl: pnl.netPnl,
    createdAt: new Date().toISOString(),
    ...reflection,
  };

  await appendEvent({
    type: "LEARNING_RECORD_CREATED",
    environment: "testnet",
    runId: runId ?? undefined,
    decisionLogId,
    tradeId: input.tradeId,
    payload: { ...record },
  });

  await appendEvent({
    type: "LEARNING_CREATED",
    environment: "testnet",
    runId: runId ?? undefined,
    decisionLogId,
    tradeId: input.tradeId,
    payload: { learningId: record.learningId, tradeId: input.tradeId },
  });

  await appendEvent({
    type: "TRADE_REFLECTION_COMPLETED",
    environment: "testnet",
    runId: runId ?? undefined,
    decisionLogId,
    tradeId: input.tradeId,
    payload: { learningId: record.learningId, tradeResult: record.tradeResult },
  });

  return { ok: true, record, message: "Learning record created." };
}
