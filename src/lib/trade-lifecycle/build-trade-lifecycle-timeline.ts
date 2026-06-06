import type {
  BinanceOrderPreview,
  BinanceTestnetJournalEntry,
} from "@/lib/exchange/binance/binance-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { LedgerEntry, LedgerSourceType, UnifiedLedgerSnapshot } from "@/lib/ledger/types";
import type {
  TestnetLearningRecord,
  TestnetMonitorJournalEvent,
  TestnetMonitorSnapshot,
} from "@/lib/testnet-monitor/types";
import type {
  TradeLifecycleTimelineView,
  TradeTimelineActor,
  TradeTimelineEvent,
  TradeTimelineLinkedIds,
  TradeTimelineRiskStatus,
  TradeTimelineStage,
} from "./types";

const STAGE_ORDER: TradeTimelineStage[] = [
  "AI_SIGNAL_CREATED",
  "DECISION_LOGGED",
  "ORDER_PREVIEW_CREATED",
  "RISK_CHECK_PASSED",
  "HUMAN_CONFIRMED",
  "ORDER_EXECUTED",
  "POSITION_OPENED",
  "MONITORING_STARTED",
  "CLOSE_RECOMMENDED",
  "POSITION_CLOSED",
  "PNL_REALIZED",
  "REFLECTION_GENERATED",
  "LEARNING_COMPLETED",
];

function stageIndex(stage: TradeTimelineStage): number {
  return STAGE_ORDER.indexOf(stage);
}

function actorFromSource(sourceType: LedgerSourceType): TradeTimelineActor {
  if (sourceType === "AI") return "AI";
  if (sourceType === "USER") return "USER";
  if (sourceType === "EXCHANGE") return "EXCHANGE";
  return "SYSTEM";
}

function createLinkedIds(
  patch: Partial<TradeTimelineLinkedIds>,
): TradeTimelineLinkedIds {
  return {
    tradeId: patch.tradeId ?? null,
    decisionLogId: patch.decisionLogId ?? null,
    previewId: patch.previewId ?? null,
    orderId: patch.orderId ?? null,
    positionId: patch.positionId ?? null,
    closedTradeId: patch.closedTradeId ?? null,
    learningRecordId: patch.learningRecordId ?? null,
  };
}

function newEventId(stage: TradeTimelineStage, timestamp: string, suffix: string): string {
  return `evt-${stage}-${timestamp}-${suffix}`;
}

function inferError(payload: Record<string, unknown>): string | null {
  const directError = payload.error;
  if (typeof directError === "string" && directError.trim()) return directError;
  const blockReasons = payload.blockReasons;
  if (Array.isArray(blockReasons)) {
    const first = blockReasons.find((r) => typeof r === "string" && r.trim());
    if (typeof first === "string") return first;
  }
  return null;
}

function inferRiskStatus(payload: Record<string, unknown>): TradeTimelineRiskStatus {
  if (payload.riskVeto === true) return "BLOCKED";
  if (Array.isArray(payload.blockReasons) && payload.blockReasons.length > 0) {
    return "BLOCKED";
  }
  const checks = payload.riskChecks;
  if (Array.isArray(checks) && checks.length > 0) {
    const hasFail = checks.some(
      (c) =>
        !!c &&
        typeof c === "object" &&
        ("status" in c
          ? (c as { status?: unknown }).status === "FAIL"
          : (c as { blocking?: unknown }).blocking === true),
    );
    return hasFail ? "BLOCKED" : "PASSED";
  }
  return "UNKNOWN";
}

function decisionFromEntries(entries: LedgerEntry[]): DecisionLogEntry | null {
  for (const entry of entries) {
    const payload = entry.payload as Record<string, unknown>;
    const decision = payload.decision;
    if (decision && typeof decision === "object") {
      return decision as DecisionLogEntry;
    }
  }
  return null;
}

function binanceFromEntries(
  entries: LedgerEntry[],
  journal: BinanceTestnetJournalEntry[],
  tradeId: string,
  decisionLogId: string | null,
): BinanceTestnetJournalEntry | null {
  for (const entry of entries) {
    const payload = entry.payload as Record<string, unknown>;
    const bn = payload.binanceTestnet;
    if (bn && typeof bn === "object") return bn as BinanceTestnetJournalEntry;
  }
  return (
    journal.find((j) => j.binanceTestnetTradeId === tradeId) ??
    (decisionLogId
      ? journal.find((j) => j.decisionLogId === decisionLogId)
      : undefined) ??
    null
  );
}

function learningFromSnapshot(
  snapshot: TestnetMonitorSnapshot | null,
  ids: {
    tradeId: string;
    decisionLogId: string | null;
    orderId: string | null;
    positionId: string | null;
  },
): TestnetLearningRecord | null {
  if (!snapshot) return null;
  return (
    snapshot.learningRecords.find(
      (r) =>
        r.closedTradeId === ids.tradeId ||
        (ids.decisionLogId != null && r.decisionLogId === ids.decisionLogId) ||
        (ids.orderId != null && r.orderId === ids.orderId) ||
        (ids.positionId != null && r.positionId === ids.positionId),
    ) ?? null
  );
}

function timelineForLookup(
  ledger: UnifiedLedgerSnapshot,
  lookupId: string,
): { tradeId: string; entries: LedgerEntry[] } | null {
  const exact = ledger.tradeTimelines.find((t) => t.tradeId === lookupId);
  if (exact) return { tradeId: exact.tradeId, entries: exact.events };

  const byDecision = ledger.tradeTimelines.find((t) => t.decisionId === lookupId);
  if (byDecision) return { tradeId: byDecision.tradeId, entries: byDecision.events };

  const byOrder = ledger.tradeTimelines.find((t) =>
    t.events.some((e) => e.linkedOrderId === lookupId),
  );
  if (byOrder) return { tradeId: byOrder.tradeId, entries: byOrder.events };

  return null;
}

function eventFromLedgerStage(input: {
  stage: TradeTimelineStage;
  entry: LedgerEntry;
  summary: string;
  payload: Record<string, unknown>;
  linked: TradeTimelineLinkedIds;
  riskStatus?: TradeTimelineRiskStatus;
  error?: string | null;
}): TradeTimelineEvent {
  return {
    eventId: newEventId(
      input.stage,
      input.entry.timestamp,
      input.entry.ledgerEntryId.slice(-6),
    ),
    stage: input.stage,
    timestamp: input.entry.timestamp,
    actor: actorFromSource(input.entry.sourceType),
    summary: input.summary,
    payload: input.payload,
    linkedIds: input.linked,
    riskStatus: input.riskStatus ?? inferRiskStatus(input.payload),
    error: input.error ?? inferError(input.payload),
  };
}

function monitorEventsForTrade(
  monitorEvents: TestnetMonitorJournalEvent[],
  linked: TradeTimelineLinkedIds,
  symbol: string | null,
): TradeTimelineEvent[] {
  const relevant = monitorEvents.filter((event) => {
    if (linked.orderId && event.orderId === linked.orderId) return true;
    if (linked.positionId && event.positionId === linked.positionId) return true;
    if (linked.decisionLogId && event.decisionLogId === linked.decisionLogId) return true;
    if (symbol && event.symbol === symbol) return true;
    return false;
  });

  const out: TradeTimelineEvent[] = [];
  for (const event of relevant) {
    if (event.eventType === "CLOSE_REQUESTED") {
      out.push({
        eventId: `evt-monitor-${event.journalId}`,
        stage: "CLOSE_RECOMMENDED",
        timestamp: event.timestamp,
        actor: "SYSTEM",
        summary: "Close recommendation/request recorded by TESTNET monitor.",
        payload: event.payload,
        linkedIds: linked,
        riskStatus: "CAUTION",
        error: null,
      });
    } else if (event.eventType === "ERROR") {
      const err =
        typeof event.payload.error === "string" ? event.payload.error : "Monitor error";
      out.push({
        eventId: `evt-monitor-${event.journalId}`,
        stage: "ORDER_EXECUTED",
        timestamp: event.timestamp,
        actor: "SYSTEM",
        summary: "Execution flow reported an error.",
        payload: event.payload,
        linkedIds: linked,
        riskStatus: "BLOCKED",
        error: err,
      });
    }
  }
  return out;
}

function dedupeEvents(events: TradeTimelineEvent[]): TradeTimelineEvent[] {
  const seen = new Set<string>();
  const out: TradeTimelineEvent[] = [];
  for (const event of events) {
    const key = [
      event.stage,
      event.timestamp,
      event.actor,
      event.summary,
      event.linkedIds.tradeId,
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(event);
  }
  return out;
}

function sortEvents(events: TradeTimelineEvent[]): TradeTimelineEvent[] {
  return [...events].sort((a, b) => {
    const ts = Date.parse(a.timestamp) - Date.parse(b.timestamp);
    if (ts !== 0) return ts;
    return stageIndex(a.stage) - stageIndex(b.stage);
  });
}

export function buildTradeLifecycleTimeline(input: {
  lookupId: string;
  ledger: UnifiedLedgerSnapshot;
  testnetSnapshot?: TestnetMonitorSnapshot | null;
  binanceJournal?: BinanceTestnetJournalEntry[];
  monitorEvents?: TestnetMonitorJournalEvent[];
  preview?: BinanceOrderPreview | null;
}): TradeLifecycleTimelineView | null {
  const selected = timelineForLookup(input.ledger, input.lookupId);
  if (!selected) return null;

  const tradeId = selected.tradeId;
  const entries = selected.entries;
  const lead = entries[0] ?? null;
  const decision = decisionFromEntries(entries);
  const decisionLogId = decision?.id ?? lead?.linkedDecisionId ?? null;

  const binance = binanceFromEntries(
    entries,
    input.binanceJournal ?? [],
    tradeId,
    decisionLogId,
  );

  const baseLinkedIds = createLinkedIds({
    tradeId,
    decisionLogId,
    previewId: binance?.previewId ?? input.preview?.previewId ?? null,
    orderId: binance?.exchangeOrderId ?? lead?.linkedOrderId ?? null,
    positionId: binance ? `pos-${binance.symbol}-${binance.side === "BUY" ? "LONG" : "SHORT"}` : null,
    closedTradeId: tradeId,
  });

  const learning = learningFromSnapshot(input.testnetSnapshot ?? null, {
    tradeId,
    decisionLogId: baseLinkedIds.decisionLogId,
    orderId: baseLinkedIds.orderId,
    positionId: baseLinkedIds.positionId,
  });

  const linkedIds = createLinkedIds({
    ...baseLinkedIds,
    learningRecordId: learning?.learningRecordId ?? null,
  });

  const events: TradeTimelineEvent[] = [];

  if (decision) {
    const decisionPayload = {
      decisionLogId: decision.id,
      finalVerdict: decision.finalVerdict,
      marketRegime: decision.marketRegime,
      riskVeto: decision.riskVeto,
      topReasons: decision.topReasons,
      actionPlan: decision.actionPlan,
    };
    events.push({
      eventId: newEventId("AI_SIGNAL_CREATED", decision.timestamp, decision.id.slice(-6)),
      stage: "AI_SIGNAL_CREATED",
      timestamp: decision.timestamp,
      actor: "AI",
      summary: `AI created signal with verdict ${decision.finalVerdict}.`,
      payload: decisionPayload,
      linkedIds,
      riskStatus: decision.riskVeto ? "BLOCKED" : "PASSED",
      error: null,
    });
    events.push({
      eventId: newEventId("DECISION_LOGGED", decision.timestamp, `${decision.id.slice(-5)}d`),
      stage: "DECISION_LOGGED",
      timestamp: decision.timestamp,
      actor: "SYSTEM",
      summary: "Decision persisted to journal/ledger.",
      payload: {
        decisionLogId: decision.id,
        outcomeStatus: decision.outcomeStatus,
      },
      linkedIds,
      riskStatus: decision.riskVeto ? "BLOCKED" : "PASSED",
      error: null,
    });
  }

  const preview = input.preview ?? null;
  if (preview || binance?.previewId) {
    const previewTs = preview?.generatedAt ?? binance?.createdAt ?? lead?.timestamp ?? new Date().toISOString();
    const previewPayload: Record<string, unknown> = preview
      ? {
          previewId: preview.previewId,
          symbol: preview.symbol,
          side: preview.side,
          notionalUsd: preview.notionalUsd,
          estimatedQty: preview.estimatedQty,
          source: preview.source,
          reason: preview.reason,
          riskChecks: preview.riskChecks,
          blocked: preview.blocked,
          blockReasons: preview.blockReasons,
        }
      : {
          previewId: binance?.previewId ?? null,
          source: binance?.source ?? null,
          blockReasons: binance?.blockReasons ?? [],
        };
    events.push({
      eventId: newEventId("ORDER_PREVIEW_CREATED", previewTs, "preview"),
      stage: "ORDER_PREVIEW_CREATED",
      timestamp: previewTs,
      actor:
        preview?.source === "ai_signal" || binance?.source === "ai_signal"
          ? "AI"
          : "USER",
      summary: "Order preview created before execution.",
      payload: previewPayload,
      linkedIds,
      riskStatus: inferRiskStatus(previewPayload),
      error: inferError(previewPayload),
    });

    const riskChecks = preview?.riskChecks ?? [];
    const riskPayload: Record<string, unknown> = {
      previewId: preview?.previewId ?? binance?.previewId ?? null,
      riskChecks,
      blockReasons: preview?.blockReasons ?? binance?.blockReasons ?? [],
    };
    events.push({
      eventId: newEventId("RISK_CHECK_PASSED", previewTs, "risk"),
      stage: "RISK_CHECK_PASSED",
      timestamp: previewTs,
      actor: "SYSTEM",
      summary:
        inferRiskStatus(riskPayload) === "BLOCKED"
          ? "Risk gate blocked order preview."
          : "Risk checks completed and passed.",
      payload: riskPayload,
      linkedIds,
      riskStatus: inferRiskStatus(riskPayload),
      error: inferError(riskPayload),
    });
  }

  if (binance && (binance.operatorNote || binance.source === "manual_test")) {
    events.push({
      eventId: newEventId(
        "HUMAN_CONFIRMED",
        binance.executedAt ?? binance.createdAt,
        "human",
      ),
      stage: "HUMAN_CONFIRMED",
      timestamp: binance.executedAt ?? binance.createdAt,
      actor: "USER",
      summary: "Human confirmation captured (double confirm path).",
      payload: {
        operatorNote: binance.operatorNote,
        previewId: binance.previewId,
      },
      linkedIds,
      riskStatus: "PASSED",
      error: null,
    });
  }

  for (const entry of entries) {
    const payload = entry.payload as Record<string, unknown>;
    if (entry.entryKind === "ORDER" || entry.linkedOrderId || payload.binanceTestnet) {
      if (entry.lifecycleStage === "MONITORING" || entry.lifecycleStage === "OPENED") {
        events.push(
          eventFromLedgerStage({
            stage: "ORDER_EXECUTED",
            entry,
            summary: "Order execution acknowledged by exchange/system.",
            payload,
            linked: linkedIds,
          }),
        );
      }
    }

    if (entry.lifecycleStage === "OPENED" || entry.lifecycleStage === "MONITORING") {
      events.push(
        eventFromLedgerStage({
          stage: "POSITION_OPENED",
          entry,
          summary: "Position opened and linked to this trade.",
          payload,
          linked: linkedIds,
        }),
      );
      events.push(
        eventFromLedgerStage({
          stage: "MONITORING_STARTED",
          entry,
          summary: "Monitoring loop started for open position.",
          payload,
          linked: linkedIds,
        }),
      );
    }

    if (entry.lifecycleStage === "CLOSE_RECOMMENDED") {
      events.push(
        eventFromLedgerStage({
          stage: "CLOSE_RECOMMENDED",
          entry,
          summary: "Close recommendation recorded.",
          payload,
          linked: linkedIds,
          riskStatus: "CAUTION",
        }),
      );
    }

    if (entry.lifecycleStage === "CLOSED") {
      events.push(
        eventFromLedgerStage({
          stage: "POSITION_CLOSED",
          entry,
          summary: "Position closed.",
          payload,
          linked: linkedIds,
        }),
      );
      events.push(
        eventFromLedgerStage({
          stage: "PNL_REALIZED",
          entry,
          summary: "PnL realized after close.",
          payload,
          linked: linkedIds,
        }),
      );
    }

    if (entry.lifecycleStage === "RESOLVED") {
      events.push(
        eventFromLedgerStage({
          stage: "REFLECTION_GENERATED",
          entry,
          summary: "Post-trade reflection snapshot generated.",
          payload,
          linked: linkedIds,
          riskStatus: "PASSED",
        }),
      );
    }

    if (entry.lifecycleStage === "LEARNED") {
      events.push(
        eventFromLedgerStage({
          stage: "LEARNING_COMPLETED",
          entry,
          summary: "Learning loop marked complete.",
          payload,
          linked: linkedIds,
          riskStatus: "PASSED",
        }),
      );
    }
  }

  if (learning) {
    if (learning.reflectionNotes || learning.status === "REFLECTION_READY") {
      events.push({
        eventId: newEventId("REFLECTION_GENERATED", learning.updatedAt, "learning-reflect"),
        stage: "REFLECTION_GENERATED",
        timestamp: learning.updatedAt,
        actor: "SYSTEM",
        summary: "Reflection notes generated for this TESTNET trade.",
        payload: {
          learningRecordId: learning.learningRecordId,
          reflectionNotes: learning.reflectionNotes,
          status: learning.status,
        },
        linkedIds,
        riskStatus: "PASSED",
        error: null,
      });
    }
    if (learning.status === "LEARNED") {
      events.push({
        eventId: newEventId("LEARNING_COMPLETED", learning.updatedAt, "learning-done"),
        stage: "LEARNING_COMPLETED",
        timestamp: learning.updatedAt,
        actor: "SYSTEM",
        summary: "Trade approved for learning set.",
        payload: {
          learningRecordId: learning.learningRecordId,
          includeInLearning: learning.includeInLearning,
          result: learning.result,
        },
        linkedIds,
        riskStatus: "PASSED",
        error: null,
      });
    }
    if (learning.status === "EXCLUDED") {
      events.push({
        eventId: newEventId("LEARNING_COMPLETED", learning.updatedAt, "learning-excluded"),
        stage: "LEARNING_COMPLETED",
        timestamp: learning.updatedAt,
        actor: "USER",
        summary: "Trade excluded from learning.",
        payload: {
          learningRecordId: learning.learningRecordId,
          includeInLearning: false,
          status: learning.status,
        },
        linkedIds,
        riskStatus: "CAUTION",
        error: null,
      });
    }
  }

  events.push(
    ...monitorEventsForTrade(
      input.monitorEvents ?? [],
      linkedIds,
      binance?.symbol ?? lead?.asset ?? null,
    ),
  );

  const finalEvents = sortEvents(dedupeEvents(events));
  if (finalEvents.length === 0) return null;

  return {
    lookupId: input.lookupId,
    tradeId,
    environment: lead?.environment ?? "UNKNOWN",
    symbol: binance?.symbol ?? lead?.asset ?? null,
    strategy: learning?.strategy ?? lead?.strategy ?? null,
    linkedIds,
    events: finalEvents,
  };
}
