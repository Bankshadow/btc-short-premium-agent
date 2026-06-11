import type { JournalEvent } from "./journal-types";

export interface TradeChainContext {
  tradeId: string;
  runId?: string;
  decisionLogId?: string;
  previewId?: string;
}

const RUN_SCOPED_EVENTS = new Set([
  "ANALYSIS_STARTED",
  "VERDICT_CREATED",
  "RULE_ENGINE_EVALUATED",
  "AGENT_CONSENSUS_CREATED",
]);

const PREVIEW_SCOPED_EVENTS = new Set(["PREVIEW_CREATED", "EXECUTION_REVIEWED"]);

export function resolveTradeChain(
  tradeId: string,
  events: JournalEvent[],
): TradeChainContext | null {
  const anchor =
    events.find((e) => e.type === "ORDER_EXECUTED" && e.tradeId === tradeId) ??
    events.find((e) => e.type === "POSITION_OPENED" && e.tradeId === tradeId) ??
    events.find((e) => e.type === "POSITION_CLOSED" && e.tradeId === tradeId);

  if (!anchor) return null;

  const orderPayload = (anchor.payload ?? {}) as { previewId?: string };
  return {
    tradeId,
    runId: anchor.runId,
    decisionLogId: anchor.decisionLogId,
    previewId: anchor.previewId ?? orderPayload.previewId,
  };
}

export function eventMatchesTradeChain(
  type: string,
  chain: TradeChainContext,
  event: JournalEvent,
): boolean {
  if (event.type !== type) return false;
  if (event.tradeId === chain.tradeId) return true;
  if (chain.previewId && PREVIEW_SCOPED_EVENTS.has(type) && event.previewId === chain.previewId) {
    return true;
  }
  if (chain.runId && RUN_SCOPED_EVENTS.has(type) && event.runId === chain.runId) {
    return true;
  }
  return false;
}

export function hasTradeChainEvent(
  type: string,
  tradeId: string,
  events: JournalEvent[],
): boolean {
  const chain = resolveTradeChain(tradeId, events);
  if (!chain) return false;
  if (type === "LEARNING_RECORD_CREATED") {
    return events.some(
      (e) =>
        e.tradeId === tradeId &&
        (e.type === "LEARNING_RECORD_CREATED" || e.type === "LEARNING_CREATED"),
    );
  }
  return events.some((e) => eventMatchesTradeChain(type, chain, e));
}
