import { appendEvent, getEvents } from "@/lib/journal/journal-query";
import { newReplaySessionId } from "@/lib/journal/journal-types";
import type { ReplaySessionSummary, ReplayStep, SessionReplay } from "@/lib/briefing/briefing-types";

const LIFECYCLE_ORDER = [
  "ANALYSIS_STARTED",
  "VERDICT_CREATED",
  "PREVIEW_CREATED",
  "EXECUTION_REVIEWED",
  "ORDER_EXECUTED",
  "POSITION_OPENED",
  "POSITION_MONITORED",
  "CLOSE_ORDER_EXECUTED",
  "POSITION_CLOSED",
  "PNL_REALIZED",
  "LEARNING_RECORD_CREATED",
] as const;

function summarizeEvent(type: string, payload: Record<string, unknown>): string {
  if (type === "VERDICT_CREATED") return `Verdict: ${payload.verdict}`;
  if (type === "PNL_REALIZED") return `PnL: $${payload.netPnl} (${payload.result})`;
  if (type === "ORDER_EXECUTED") return `Order ${payload.side} ${payload.symbol}`;
  return type.replace(/_/g, " ").toLowerCase();
}

function phaseForType(type: string): string {
  if (type.startsWith("ANALYSIS") || type === "VERDICT_CREATED") return "analysis";
  if (type.includes("PREVIEW")) return "preview";
  if (type.includes("EXECUTION_REVIEW") || type.includes("EXECUTE")) return "safety";
  if (type === "ORDER_EXECUTED" || type === "POSITION_OPENED") return "execution";
  if (type.includes("MONITOR") || type.includes("RECONCILIATION")) return "monitor";
  if (type.includes("CLOSE")) return "close";
  if (type.includes("PNL") || type.includes("RESULT")) return "pnl";
  if (type.includes("LEARNING")) return "learning";
  return "other";
}

export function buildReplayForTrade(tradeId: string, events: Awaited<ReturnType<typeof getEvents>>): ReplayStep[] {
  const related = events.filter(
    (e) => e.tradeId === tradeId || (e.type === "VERDICT_CREATED" && events.some((o) => o.tradeId === tradeId && o.decisionLogId === e.decisionLogId)),
  );

  const orderEvt = events.find((e) => e.type === "ORDER_EXECUTED" && e.tradeId === tradeId);
  const runEvents = orderEvt?.runId
    ? events.filter((e) => e.runId === orderEvt.runId)
    : related;

  const steps: ReplayStep[] = [];
  for (const type of LIFECYCLE_ORDER) {
    const evt = runEvents.find((e) => e.type === type);
    if (!evt) continue;
    steps.push({
      phase: phaseForType(type),
      eventType: type,
      timestamp: evt.timestamp,
      summary: summarizeEvent(type, evt.payload),
    });
  }
  return steps;
}

export async function createSessionReplay(tradeId?: string): Promise<SessionReplay> {
  const events = await getEvents();
  const sessionId = newReplaySessionId();

  let targetTradeId = tradeId ?? null;
  if (!targetTradeId) {
    const closed = events.filter((e) => e.type === "POSITION_CLOSED" && e.tradeId);
    targetTradeId = closed.sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0]?.tradeId ?? null;
  }

  const steps = targetTradeId ? buildReplayForTrade(targetTradeId, events) : [];
  const orderEvt = targetTradeId
    ? events.find((e) => e.type === "ORDER_EXECUTED" && e.tradeId === targetTradeId)
    : null;

  const replay: SessionReplay = {
    sessionId,
    tradeId: targetTradeId,
    runId: orderEvt?.runId ?? null,
    createdAt: new Date().toISOString(),
    steps,
    liveLocked: true,
  };

  await appendEvent({
    type: "SESSION_REPLAY_CREATED",
    environment: "testnet",
    tradeId: targetTradeId ?? undefined,
    runId: replay.runId ?? undefined,
    payload: { ...replay },
  });

  return replay;
}

export async function listReplaySessions(): Promise<ReplaySessionSummary[]> {
  const events = await getEvents();
  return events
    .filter((e) => e.type === "SESSION_REPLAY_CREATED")
    .map((e) => {
      const p = e.payload as unknown as SessionReplay;
      return {
        sessionId: p.sessionId,
        tradeId: p.tradeId,
        runId: p.runId,
        createdAt: p.createdAt,
        stepCount: p.steps?.length ?? 0,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getReplaySession(sessionId: string): Promise<SessionReplay | null> {
  const events = await getEvents();
  const evt = events.find(
    (e) => e.type === "SESSION_REPLAY_CREATED" && (e.payload as unknown as SessionReplay).sessionId === sessionId,
  );
  if (!evt) return null;
  return evt.payload as unknown as SessionReplay;
}
