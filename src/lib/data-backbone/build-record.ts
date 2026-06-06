import type { DecisionLogEntry } from "@/lib/journal/decision-log-types";
import type { PaperOrder } from "@/lib/paper/paper-order-types";
import type { PerpPaperPosition } from "@/lib/multi-asset/types";
import type { DeskRiskProfile } from "@/lib/desk/desk-risk-policy";
import type { OperatorAction } from "@/lib/operator-action-queue/types";
import type { AutopilotRunResult } from "@/lib/autopilot/types";
import { buildLearningStatus } from "@/lib/autopilot/build-learning-status";
import { buildDeskPortfolioSnapshot } from "@/lib/portfolio/milestones";
import {
  filterProductionEntries,
  filterProductionOrders,
  countProductionResolved,
} from "@/lib/journal/production-filter";
import { summarizePaperPortfolio } from "@/lib/paper/paper-orders";
import { getOrCreateClientId } from "./adapters/local-storage";
import { BACKBONE_VERSION } from "./types";
import type {
  DataSourceKind,
  DeskBackboneRecord,
  DeskDecision,
  DeskModuleState,
  DeskPortfolioSnapshot,
  DeskRiskSnapshot,
  DeskRun,
  DeskTrade,
  TradeBookLabel,
  WriteDeskCycleInput,
} from "./types";
import { evaluateBackboneHealth } from "./health";

function tradeBookLabel(
  order: PaperOrder,
  entry?: DecisionLogEntry,
): TradeBookLabel {
  if (order.isDemoData || entry?.isDemoData) return "DEMO";
  if (order.paperMode === "RELAXED_PAPER") return "PAPER_SHADOW";
  return "PAPER_STRICT";
}

function decisionBookLabel(entry: DecisionLogEntry): TradeBookLabel {
  if (entry.isDemoData || entry.analyzeStatus === "DEMO") return "DEMO";
  return "PAPER_STRICT";
}

export function mapDecision(entry: DecisionLogEntry, tradeIds: string[]): DeskDecision {
  return {
    decisionId: entry.id,
    runId: entry.runId ?? null,
    timestamp: entry.timestamp,
    btcPrice: entry.btcPrice,
    finalVerdict: entry.finalVerdict,
    outcomeStatus: entry.outcomeStatus,
    paperPnl: entry.paperPnl,
    marketRegime: entry.marketRegime,
    riskVeto: entry.riskVeto,
    bookLabel: decisionBookLabel(entry),
    isDemoData: Boolean(entry.isDemoData),
    linkedTradeIds: tradeIds,
  };
}

export function mapTrade(order: PaperOrder, entries: DecisionLogEntry[]): DeskTrade {
  const entry = entries.find((e) => e.id === order.decisionLogId);
  return {
    tradeId: order.id,
    decisionId: order.decisionLogId,
    book: tradeBookLabel(order, entry),
    instrument: order.instrument,
    status: order.status,
    openedAt: order.openedAt,
    closedAt: order.closedAt,
    realizedPnlPct: order.realizedPnlPct,
    notionalUsd: order.notionalUsd,
    isDemoData: Boolean(order.isDemoData || entry?.isDemoData),
  };
}

function buildPortfolioSnapshot(input: {
  entries: DecisionLogEntry[];
  orders: PaperOrder[];
  learningSampleSize: number;
}): DeskPortfolioSnapshot {
  const productionEntries = filterProductionEntries(input.entries);
  const productionOrders = filterProductionOrders(input.orders);
  const desk = buildDeskPortfolioSnapshot(productionEntries, productionOrders);
  const paper = summarizePaperPortfolio(productionOrders);
  const shadow = productionOrders.filter((o) => o.paperMode === "RELAXED_PAPER").length;
  const exposure = productionOrders
    .filter((o) => o.status === "OPEN")
    .reduce((s, o) => s + o.notionalUsd, 0);
  const wins = paper.winCount;
  const closed = paper.closedCount;
  const winRate = closed > 0 ? Math.round((wins / closed) * 100) : 0;

  return {
    generatedAt: new Date().toISOString(),
    paperPnlPct: desk.netLogPaperPnlPct,
    openPaperTrades: paper.openCount,
    closedPaperTrades: paper.closedCount,
    shadowTrades: shadow,
    exposureUsd: exposure,
    drawdownPct: Math.abs(Math.min(0, desk.netLogPaperPnlPct)),
    resolvedLogCount: desk.resolvedLogCount,
    productionResolvedCount: countProductionResolved(input.entries),
    winRatePct: winRate,
    sampleSize: input.learningSampleSize,
  };
}

function buildRunFromAutopilot(result: AutopilotRunResult): DeskRun {
  return {
    runId: result.runId,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    status: result.status,
    mode: result.mode,
    deskStatus: result.deskStatus,
    finalVerdict: result.finalVerdict,
    confidence: result.confidence,
    briefing: result.briefing,
    source: "hybrid",
    writeOk: true,
    errors: result.errors,
  };
}

function buildModulesFromAutopilot(result: AutopilotRunResult | null): DeskModuleState[] {
  if (!result) return [];
  return result.modulesRun.map((m) => ({
    moduleId: m.moduleId,
    status: m.status,
    summary: m.summary,
    lastRunAt: result.completedAt,
    shouldDisplayToUser: m.shouldDisplayToUser,
  }));
}

export function buildDeskBackboneRecord(input: {
  entries: DecisionLogEntry[];
  orders: PaperOrder[];
  perpPositions?: PerpPaperPosition[];
  riskProfile: DeskRiskProfile;
  actions?: OperatorAction[];
  autopilotResult?: AutopilotRunResult | null;
  source?: DataSourceKind;
  writeOk?: boolean;
  writeError?: string | null;
  syncStatus?: import("./types").SyncStatus;
  runOverride?: Partial<DeskRun> | null;
}): DeskBackboneRecord {
  const now = new Date().toISOString();
  const learning = buildLearningStatus({
    entries: input.entries,
    orders: input.orders,
    riskProfile: input.riskProfile,
    latestAnalysis: input.autopilotResult?.analyze ?? null,
  });

  const trades = input.orders.map((o) => mapTrade(o, input.entries));
  const tradeIdsByDecision = new Map<string, string[]>();
  for (const t of trades) {
    const prev = tradeIdsByDecision.get(t.decisionId) ?? [];
    tradeIdsByDecision.set(t.decisionId, [...prev, t.tradeId]);
  }

  const decisions = input.entries.map((e) =>
    mapDecision(e, tradeIdsByDecision.get(e.id) ?? []),
  );

  const portfolio = buildPortfolioSnapshot({
    entries: input.entries,
    orders: input.orders,
    learningSampleSize: learning.strategySampleSize,
  });

  const learningSnapshot = {
    generatedAt: now,
    ...learning,
  };

  const blockers = input.autopilotResult?.blockers ?? [];
  const deskStatus = input.autopilotResult?.deskStatus ?? "CAUTION";

  const risk: DeskRiskSnapshot = {
    generatedAt: now,
    deskStatus,
    blockers,
    liveReadinessBlocked: deskStatus === "BLOCKED" || deskStatus === "EMERGENCY",
    backboneHealthy: input.writeOk !== false,
  };

  const run: DeskRun | null = input.autopilotResult
    ? { ...buildRunFromAutopilot(input.autopilotResult), ...input.runOverride }
    : input.runOverride
      ? {
          runId: input.runOverride.runId ?? `manual-${Date.now()}`,
          startedAt: input.runOverride.startedAt ?? now,
          completedAt: input.runOverride.completedAt ?? now,
          status: input.runOverride.status ?? "COMPLETED",
          mode: input.runOverride.mode ?? "ANALYSIS_ONLY",
          deskStatus: input.runOverride.deskStatus ?? deskStatus,
          finalVerdict: input.runOverride.finalVerdict ?? "NONE",
          confidence: input.runOverride.confidence ?? 0,
          briefing: input.runOverride.briefing ?? "",
          source: input.source ?? "localStorage",
          writeOk: input.writeOk !== false,
          errors: input.runOverride.errors ?? (input.writeError ? [input.writeError] : []),
        }
      : null;

  const health = evaluateBackboneHealth({
    lastWriteAt: now,
    syncStatus: input.syncStatus ?? "OFF",
    source: input.source ?? "localStorage",
    portfolio,
    learning: learningSnapshot,
    risk,
    writeOk: input.writeOk !== false,
    writeError: input.writeError ?? null,
  });

  return {
    version: BACKBONE_VERSION,
    clientId: getOrCreateClientId(),
    lastWriteAt: now,
    lastRunId: run?.runId ?? input.autopilotResult?.runId ?? null,
    run,
    decisions,
    trades,
    portfolio,
    learning: learningSnapshot,
    risk,
    actions: (input.actions ?? input.autopilotResult?.actionsCreated ?? []).filter(
      (a) => a.status === "OPEN",
    ),
    modules: buildModulesFromAutopilot(input.autopilotResult ?? null),
    health,
  };
}

export function buildRecordFromCycle(
  legacy: Parameters<typeof buildDeskBackboneRecord>[0],
  cycle: WriteDeskCycleInput,
): DeskBackboneRecord {
  return buildDeskBackboneRecord({
    ...legacy,
    autopilotResult: cycle.autopilotResult ?? legacy.autopilotResult,
    runOverride: cycle.run ?? null,
    writeOk: !cycle.writeError,
    writeError: cycle.writeError ?? null,
    syncStatus: cycle.syncStatus,
    source: cycle.source ?? legacy.source,
  });
}
