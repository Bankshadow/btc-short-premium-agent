import type { BinanceOrderPreview, BinanceTestnetJournalEntry } from "@/lib/exchange/binance/binance-types";
import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { UnifiedLedgerSnapshot } from "@/lib/ledger/types";
import type { TestnetMonitorJournalEvent, TestnetMonitorSnapshot } from "@/lib/testnet-monitor/types";
import type { TradeQualityScore } from "@/lib/trade-quality-score/types";
import { buildTradeLifecycleTimeline } from "@/lib/trade-lifecycle";
import { inferFailureCause, inferOutcomeStatus } from "./infer-failure-cause";
import { sanitizeRecordValue } from "./sanitize-record";
import type {
  BlackBoxSection,
  TradeBlackBoxRecord,
  TradeBlackBoxSections,
  TradeBlackBoxTimelineEntry,
} from "./types";
import { TRADE_BLACK_BOX_SAFETY_NOTICE } from "./types";

function sectionFromStage(stage: string): BlackBoxSection | null {
  const map: Record<string, BlackBoxSection> = {
    AI_SIGNAL_CREATED: "AI_DECISION",
    DECISION_LOGGED: "AI_DECISION",
    ORDER_PREVIEW_CREATED: "PREVIEW",
    RISK_CHECK_PASSED: "RISK_CHECKS",
    HUMAN_CONFIRMED: "ORDER_REQUEST",
    ORDER_EXECUTED: "EXCHANGE_RESPONSE",
    POSITION_OPENED: "POSITION_UPDATES",
    MONITORING_STARTED: "POSITION_UPDATES",
    CLOSE_RECOMMENDED: "CLOSE_EVENT",
    POSITION_CLOSED: "CLOSE_EVENT",
    PNL_REALIZED: "PNL",
    REFLECTION_GENERATED: "REFLECTION",
    LEARNING_COMPLETED: "REFLECTION",
  };
  return map[stage] ?? null;
}

function agentVotesFromDecision(decision: DecisionLogEntry | null): Record<string, unknown>[] | null {
  if (!decision?.agentOutputs?.length) return null;
  return decision.agentOutputs.map((agent) =>
    sanitizeRecordValue({
      agentName: agent.agentName,
      strategyType: agent.strategyType,
      recommendation: agent.recommendation,
      confidence: agent.confidence,
      marketView: agent.marketView,
      reasons: agent.reasons,
      risks: agent.risks,
      proposedAction: agent.proposedAction,
      veto: agent.veto ?? false,
      vetoReasons: agent.vetoReasons ?? [],
    }),
  );
}

function buildSections(input: {
  decision: DecisionLogEntry | null;
  preview: BinanceOrderPreview | null;
  binance: BinanceTestnetJournalEntry | null;
  monitorEvents: TestnetMonitorJournalEvent[];
  learningReflection: Record<string, unknown> | null;
}): TradeBlackBoxSections {
  const decision = input.decision;
  const preview = input.preview;
  const binance = input.binance;

  const marketSnapshot = decision
    ? sanitizeRecordValue({
        timestamp: decision.timestamp,
        btcPrice: decision.btcPrice,
        marketRegime: decision.marketRegime,
        deskRiskProfile: decision.deskRiskProfile ?? null,
        playbookConfidence: decision.playbookConfidence ?? null,
        committeeTradeScore: decision.committeeTradeScore ?? null,
        replaySnapshot: decision.replaySnapshot ?? null,
      })
    : null;

  const aiDecision = decision
    ? sanitizeRecordValue({
        decisionLogId: decision.id,
        timestamp: decision.timestamp,
        finalVerdict: decision.finalVerdict,
        riskVeto: decision.riskVeto,
        topReasons: decision.topReasons,
        actionPlan: decision.actionPlan,
        outcomeStatus: decision.outcomeStatus,
        orderTicket: decision.orderTicket ?? null,
        preMortem: decision.preMortem ?? null,
        operatorOverride: decision.operatorOverride ?? null,
      })
    : null;

  const riskChecks = preview
    ? sanitizeRecordValue({
        previewId: preview.previewId,
        blocked: preview.blocked,
        blockReasons: preview.blockReasons,
        checks: preview.riskChecks,
        requiresDoubleConfirm: preview.requiresDoubleConfirm,
      })
    : binance?.blockReasons?.length
      ? sanitizeRecordValue({
          blockReasons: binance.blockReasons,
          blocked: binance.status === "BLOCKED",
          checks: [],
        })
      : null;

  const previewSection = preview
    ? sanitizeRecordValue({
        previewId: preview.previewId,
        symbol: preview.symbol,
        side: preview.side,
        notionalUsd: preview.notionalUsd,
        estimatedQty: preview.estimatedQty,
        markPrice: preview.markPrice,
        source: preview.source,
        reason: preview.reason,
        blocked: preview.blocked,
        blockReasons: preview.blockReasons,
        generatedAt: preview.generatedAt,
        expiresAt: preview.expiresAt,
      })
    : binance?.previewId
      ? sanitizeRecordValue({
          previewId: binance.previewId,
          symbol: binance.symbol,
          side: binance.side,
          notionalUsd: binance.notionalUsd,
          quantity: binance.quantity,
          source: binance.source,
          reason: binance.reason,
          blockReasons: binance.blockReasons,
        })
      : null;

  const orderRequest = binance
    ? sanitizeRecordValue({
        previewId: binance.previewId,
        symbol: binance.symbol,
        side: binance.side,
        notionalUsd: binance.notionalUsd,
        quantity: binance.quantity,
        source: binance.source,
        operatorNote: binance.operatorNote,
        clientOrderId: binance.clientOrderId,
        decisionLogId: binance.decisionLogId,
        createdAt: binance.createdAt,
      })
    : null;

  const exchangeResponse = binance
    ? sanitizeRecordValue({
        binanceTestnetTradeId: binance.binanceTestnetTradeId,
        status: binance.status,
        exchangeOrderId: binance.exchangeOrderId,
        executedAt: binance.executedAt,
        fillPrice: binance.fillPrice ?? null,
        markPriceAtSubmit: binance.markPriceAtSubmit ?? null,
        slippage: binance.slippage ?? null,
        slippageBps: binance.slippageBps ?? null,
        latencyMs: binance.latencyMs ?? null,
        partialFill: binance.partialFill ?? false,
        duplicateSubmission: binance.duplicateSubmission ?? false,
        retryCount: binance.retryCount ?? 0,
        closeFailed: binance.closeFailed ?? false,
        blockReasons: binance.blockReasons,
      })
    : null;

  const positionUpdates = input.monitorEvents
    .filter((e) =>
      ["POSITION_OPENED", "ORDER_EXECUTED", "ERROR"].includes(e.eventType),
    )
    .map((e) =>
      sanitizeRecordValue({
        eventType: e.eventType,
        timestamp: e.timestamp,
        symbol: e.symbol,
        orderId: e.orderId,
        positionId: e.positionId,
        payload: e.payload,
        error: e.eventType === "ERROR" ? e.payload.error ?? "Monitor error" : null,
      }),
    );

  const closeEvents = input.monitorEvents.filter((e) =>
    ["CLOSE_REQUESTED", "POSITION_CLOSED"].includes(e.eventType),
  );
  const closeEvent =
    closeEvents.length > 0 || binance?.closedAt
      ? sanitizeRecordValue({
          closedAt: binance?.closedAt ?? null,
          closeAttempt: binance?.closeAttempt ?? false,
          closeFailed: binance?.closeFailed ?? false,
          monitorEvents: closeEvents.map((e) => ({
            eventType: e.eventType,
            timestamp: e.timestamp,
            payload: e.payload,
          })),
        })
      : null;

  const pnl =
    binance?.realizedPnl != null || binance?.fees != null
      ? sanitizeRecordValue({
          realizedPnl: binance.realizedPnl,
          fees: binance.fees,
          paperPnl: decision?.paperPnl ?? null,
          resolution: decision?.resolution ?? null,
        })
      : decision?.paperPnl != null
        ? sanitizeRecordValue({
            paperPnl: decision.paperPnl,
            resolution: decision.resolution ?? null,
          })
        : null;

  const reflection: Record<string, unknown> | null = decision?.reflection
    ? (sanitizeRecordValue(decision.reflection) as unknown as Record<string, unknown>)
    : input.learningReflection
      ? (sanitizeRecordValue(input.learningReflection) as unknown as Record<string, unknown>)
      : null;

  return {
    marketSnapshot,
    aiDecision,
    agentVotes: agentVotesFromDecision(decision),
    riskChecks,
    preview: previewSection,
    orderRequest,
    exchangeResponse,
    positionUpdates: positionUpdates.length > 0 ? positionUpdates : null,
    closeEvent,
    pnl,
    reflection,
  };
}

function buildTimelineFromSections(
  sections: TradeBlackBoxSections,
  lifecycleEvents: Array<{
    stage: string;
    timestamp: string;
    actor: string;
    summary: string;
    payload: Record<string, unknown>;
    error: string | null;
  }>,
): TradeBlackBoxTimelineEntry[] {
  const entries: TradeBlackBoxTimelineEntry[] = [];
  let idx = 0;

  const push = (
    section: BlackBoxSection,
    timestamp: string,
    actor: string,
    summary: string,
    data: Record<string, unknown>,
    error: string | null,
  ) => {
    entries.push({
      entryId: `bb-${section}-${idx++}`,
      section,
      timestamp,
      actor,
      summary,
      data: sanitizeRecordValue(data),
      hasError: Boolean(error),
      error,
    });
  };

  if (sections.marketSnapshot) {
    push(
      "MARKET_SNAPSHOT",
      String(sections.marketSnapshot.timestamp ?? new Date().toISOString()),
      "SYSTEM",
      "Market snapshot at decision time",
      sections.marketSnapshot,
      null,
    );
  }
  if (sections.aiDecision) {
    push(
      "AI_DECISION",
      String(sections.aiDecision.timestamp ?? new Date().toISOString()),
      "AI",
      `AI verdict: ${String(sections.aiDecision.finalVerdict ?? "—")}`,
      sections.aiDecision,
      sections.aiDecision.riskVeto === true ? "Risk veto active" : null,
    );
  }
  if (sections.agentVotes?.length) {
    push(
      "AGENT_VOTES",
      String(sections.aiDecision?.timestamp ?? new Date().toISOString()),
      "AI",
      `${sections.agentVotes.length} agent votes recorded`,
      { votes: sections.agentVotes },
      null,
    );
  }
  if (sections.riskChecks) {
    const blocked = sections.riskChecks.blocked === true;
    push(
      "RISK_CHECKS",
      String(sections.preview?.generatedAt ?? sections.aiDecision?.timestamp ?? new Date().toISOString()),
      "SYSTEM",
      blocked ? "Risk checks blocked the trade" : "Risk checks completed",
      sections.riskChecks,
      blocked ? String((sections.riskChecks.blockReasons as string[])?.[0] ?? "Blocked") : null,
    );
  }
  if (sections.preview) {
    const blocked = sections.preview.blocked === true;
    push(
      "PREVIEW",
      String(sections.preview.generatedAt ?? new Date().toISOString()),
      "SYSTEM",
      "Order preview generated",
      sections.preview,
      blocked ? String((sections.preview.blockReasons as string[])?.[0] ?? "Preview blocked") : null,
    );
  }
  if (sections.orderRequest) {
    push(
      "ORDER_REQUEST",
      String(sections.orderRequest.createdAt ?? new Date().toISOString()),
      "USER",
      "Order request submitted",
      sections.orderRequest,
      null,
    );
  }
  if (sections.exchangeResponse) {
    const failed = sections.exchangeResponse.status === "FAILED";
    push(
      "EXCHANGE_RESPONSE",
      String(sections.exchangeResponse.executedAt ?? new Date().toISOString()),
      "EXCHANGE",
      `Exchange status: ${String(sections.exchangeResponse.status ?? "—")}`,
      sections.exchangeResponse,
      failed ? "Exchange journal status FAILED" : null,
    );
  }
  if (sections.positionUpdates?.length) {
    for (const update of sections.positionUpdates) {
      push(
        "POSITION_UPDATES",
        String(update.timestamp ?? new Date().toISOString()),
        "SYSTEM",
        `Position update: ${String(update.eventType ?? "event")}`,
        update,
        typeof update.error === "string" ? update.error : null,
      );
    }
  }
  if (sections.closeEvent) {
    push(
      "CLOSE_EVENT",
      String(sections.closeEvent.closedAt ?? new Date().toISOString()),
      "SYSTEM",
      sections.closeEvent.closeFailed === true ? "Close failed" : "Close event recorded",
      sections.closeEvent,
      sections.closeEvent.closeFailed === true ? "Close attempt failed" : null,
    );
  }
  if (sections.pnl) {
    push(
      "PNL",
      new Date().toISOString(),
      "SYSTEM",
      "PnL snapshot",
      sections.pnl,
      null,
    );
  }
  if (sections.reflection) {
    push(
      "REFLECTION",
      String(
        (sections.reflection as { generatedAt?: string }).generatedAt ??
          new Date().toISOString(),
      ),
      "AI",
      "Post-trade reflection",
      sections.reflection,
      null,
    );
  }

  for (const event of lifecycleEvents) {
    const section = sectionFromStage(event.stage);
    if (!section) continue;
    const exists = entries.some(
      (e) => e.section === section && e.timestamp === event.timestamp,
    );
    if (exists) continue;
    push(section, event.timestamp, event.actor, event.summary, event.payload, event.error);
  }

  return entries.sort(
    (a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp),
  );
}

function decisionFromLedger(
  ledger: UnifiedLedgerSnapshot,
  decisionLogId: string | null,
): DecisionLogEntry | null {
  if (!decisionLogId) return null;
  for (const entry of ledger.entries) {
    const payload = entry.payload as Record<string, unknown>;
    const decision = payload.decision;
    if (
      decision &&
      typeof decision === "object" &&
      (decision as DecisionLogEntry).id === decisionLogId
    ) {
      return decision as DecisionLogEntry;
    }
  }
  return null;
}

export function buildTradeBlackBox(input: {
  lookupId: string;
  ledger: UnifiedLedgerSnapshot;
  decision?: DecisionLogEntry | null;
  testnetSnapshot?: TestnetMonitorSnapshot | null;
  binanceJournal?: BinanceTestnetJournalEntry[];
  monitorEvents?: TestnetMonitorJournalEvent[];
  preview?: BinanceOrderPreview | null;
  tradeQuality?: TradeQualityScore | null;
  workspaceId?: string;
}): TradeBlackBoxRecord | null {
  const timeline = buildTradeLifecycleTimeline({
    lookupId: input.lookupId,
    ledger: input.ledger,
    testnetSnapshot: input.testnetSnapshot ?? null,
    binanceJournal: input.binanceJournal ?? [],
    monitorEvents: input.monitorEvents ?? [],
    preview: input.preview ?? null,
  });
  if (!timeline) return null;

  const decisionLogId = timeline.linkedIds.decisionLogId;
  const decision =
    input.decision ??
    decisionFromLedger(input.ledger, decisionLogId) ??
    null;

  const binance =
    (input.binanceJournal ?? []).find(
      (j) =>
        j.binanceTestnetTradeId === timeline.tradeId ||
        (decisionLogId && j.decisionLogId === decisionLogId),
    ) ?? null;

  const learning = input.testnetSnapshot?.learningRecords.find(
    (r) =>
      r.closedTradeId === timeline.tradeId ||
      (decisionLogId && r.decisionLogId === decisionLogId),
  );

  const sections = buildSections({
    decision,
    preview: input.preview ?? null,
    binance,
    monitorEvents: (input.monitorEvents ?? []).filter((e) => {
      if (timeline.linkedIds.orderId && e.orderId === timeline.linkedIds.orderId) {
        return true;
      }
      if (decisionLogId && e.decisionLogId === decisionLogId) return true;
      if (timeline.symbol && e.symbol === timeline.symbol) return true;
      return false;
    }),
    learningReflection: learning?.reflectionNotes
      ? { reflectionNotes: learning.reflectionNotes, status: learning.status }
      : null,
  });

  const bbTimeline = buildTimelineFromSections(
    sections,
    timeline.events.map((e) => ({
      stage: e.stage,
      timestamp: e.timestamp,
      actor: e.actor,
      summary: e.summary,
      payload: e.payload,
      error: e.error,
    })),
  );

  const outcomeStatus = inferOutcomeStatus({ sections, timeline: bbTimeline });
  const failureCause = inferFailureCause({
    sections,
    timeline: bbTimeline,
    outcomeStatus,
  });

  const now = new Date().toISOString();
  return {
    blackBoxId: `bb-${timeline.tradeId}`,
    workspaceId: input.workspaceId ?? "server-default",
    tradeId: timeline.tradeId,
    decisionLogId,
    symbol: timeline.symbol,
    strategy: timeline.strategy,
    environment: timeline.environment,
    capturedAt: now,
    updatedAt: now,
    outcomeStatus,
    failureCause,
    timeline: bbTimeline,
    linkedIds: {
      tradeId: timeline.linkedIds.tradeId,
      decisionLogId: timeline.linkedIds.decisionLogId,
      previewId: timeline.linkedIds.previewId,
      orderId: timeline.linkedIds.orderId,
      positionId: timeline.linkedIds.positionId,
      closedTradeId: timeline.linkedIds.closedTradeId,
      learningRecordId: timeline.linkedIds.learningRecordId,
    },
    sections,
    tradeQualityGrade: input.tradeQuality?.grade ?? null,
    safetyNotice: TRADE_BLACK_BOX_SAFETY_NOTICE,
  };
}
